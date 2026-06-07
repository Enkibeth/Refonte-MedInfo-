/**
 * ECOS — Examen Clinique Objectif Structuré.
 * Simulation patient–étudiant avec évaluation IA sur grille de correction.
 * Accès réservé aux étudiants en santé (persona student).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { getSupabaseClient } from '@/db/supabase';
import { tokens } from '@/ui/tokens';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { RoleGate } from '@/ui/RoleGate';
import { DictationButton } from '@/ui/DictationButton';
import {
  loadFavorites,
  toggleFavorite as persistToggleFavorite,
  loadSessions,
  addSession,
  clearSessions,
} from '@/lib/ecosStore';
import {
  parseEcosScore,
  computeProgress,
  lastScoreByCase,
  type EcosSession,
} from '@/lib/ecosProgress';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EcosCase {
  id: string;
  titre: string;
  specialite: string;
  duree: number;
  consigneCandidat: string;
  briefPatient: string;
  grilleCorrection: string;
  /** Cas généré localement depuis un import (éphémère, non publié au corpus). */
  imported?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ── Chargement des cas depuis Supabase ──────────────────────────────────────
//
// Les cas vivent désormais dans la table `ecos_cases` (migration 0013), éditable
// depuis le panel admin. La RLS n'expose que les cas publiés (is_published = true).

interface EcosCaseRow {
  id: string;
  slug: string;
  title: string;
  specialty: string;
  duration_minutes: number;
  brief: string;
  patient_profile: { role_brief?: string } | string | null;
  grading_grid: { markdown?: string } | string | null;
}

function mapRow(row: EcosCaseRow): EcosCase {
  const roleBrief =
    typeof row.patient_profile === 'string'
      ? row.patient_profile
      : row.patient_profile?.role_brief ?? '';
  const grilleMarkdown =
    typeof row.grading_grid === 'string'
      ? row.grading_grid
      : row.grading_grid?.markdown ?? '';

  return {
    id: row.slug || row.id,
    titre: row.title,
    specialite: row.specialty,
    duree: row.duration_minutes ?? 10,
    consigneCandidat: row.brief,
    briefPatient: roleBrief,
    grilleCorrection: grilleMarkdown,
  };
}

async function fetchPublishedCases(): Promise<EcosCase[]> {
  const { data, error } = await getSupabaseClient()
    .from('ecos_cases')
    .select('id, slug, title, specialty, duration_minutes, brief, patient_profile, grading_grid')
    .eq('is_published', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as EcosCaseRow));
}

// ── Composants ─────────────────────────────────────────────────────────────

function CaseCard({
  cas,
  onSelect,
  isFavorite,
  onToggleFavorite,
  lastScore,
}: {
  cas: EcosCase;
  onSelect: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  lastScore?: number | null;
}) {
  return (
    <TouchableOpacity style={caseStyles.card} onPress={onSelect} accessibilityRole="button">
      <View style={caseStyles.cardHeader}>
        <Text style={caseStyles.cardTitle}>{cas.titre}</Text>
        <View style={caseStyles.cardHeaderRight}>
          <View style={caseStyles.badge}>
            <Text style={caseStyles.badgeText}>{cas.duree} min</Text>
          </View>
          <TouchableOpacity
            onPress={onToggleFavorite}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[caseStyles.star, isFavorite && caseStyles.starActive]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={caseStyles.cardSpecialite}>{cas.specialite}</Text>
      <Text style={caseStyles.cardConsigne} numberOfLines={2}>
        {cas.consigneCandidat}
      </Text>
      <View style={caseStyles.cardFooter}>
        {cas.imported ? (
          <View style={caseStyles.importedTag}>
            <Text style={caseStyles.importedTagText}>Importé</Text>
          </View>
        ) : null}
        {lastScore != null ? (
          <Text style={caseStyles.lastScore}>Dernière note : {lastScore}/20</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function Timer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expired = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          if (!expired.current) {
            expired.current = true;
            onExpire();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining < 60;

  return (
    <View style={[timerStyles.wrap, isLow && timerStyles.wrapLow]}>
      <Text style={[timerStyles.text, isLow && timerStyles.textLow]}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </View>
  );
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.progressStat}>
      <Text style={styles.progressStatValue}>{value}</Text>
      <Text style={styles.progressStatLabel}>{label}</Text>
    </View>
  );
}

// ── Écran ECOS ─────────────────────────────────────────────────────────────

type Phase = 'selection' | 'preparation' | 'simulation' | 'evaluation';

export default function EcosScreen() {
  return (
    <RoleGate feature="ecos">
      <EcosScreenInner />
    </RoleGate>
  );
}

function EcosScreenInner() {
  const { persona } = useSession();
  const [phase, setPhase] = useState<Phase>('selection');
  const [selectedCase, setSelectedCase] = useState<EcosCase | null>(null);
  const [cases, setCases] = useState<EcosCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [evaluation, setEvaluation] = useState('');
  const [evalLoading, setEvalLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Favoris + progression (persistance locale, web ; cf. ecosStore).
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sessions, setSessions] = useState<EcosSession[]>([]);
  const sessionSavedRef = useRef(false);

  // Import d'une station → cas fictif (mode "generate").
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setCasesLoading(true);
    setCasesError(null);
    try {
      setCases(await fetchPublishedCases());
    } catch {
      setCasesError('Impossible de charger les cas ECOS. Réessayez.');
    } finally {
      setCasesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (persona === 'student') {
      loadCases();
      setFavorites(loadFavorites());
      setSessions(loadSessions());
    }
  }, [persona, loadCases]);

  function onToggleFavorite(caseId: string) {
    setFavorites(persistToggleFavorite(caseId));
  }

  async function importStation() {
    const source = importText.trim();
    if (source.length < 40 || importLoading) {
      setImportError('Colle une station un peu plus complète (énoncé + grille).');
      return;
    }
    setImportLoading(true);
    setImportError(null);
    try {
      const res = await fetch('/api/ecos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'generate', sourceText: source }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        case?: {
          title?: string;
          specialty?: string;
          duration_minutes?: number;
          brief?: string;
          patient_profile?: { role_brief?: string };
          grading_grid?: { markdown?: string };
        };
        error?: string;
      };
      if (!res.ok || !data.case) {
        throw new Error(data.error ?? 'Génération impossible. Réessayez.');
      }
      const c = data.case;
      const imported: EcosCase = {
        id: `import-${Date.now()}`,
        titre: c.title?.trim() || 'Cas importé',
        specialite: c.specialty?.trim() || 'Cas importé',
        duree:
          Number.isFinite(Number(c.duration_minutes)) && Number(c.duration_minutes) > 0
            ? Math.min(60, Math.round(Number(c.duration_minutes)))
            : 10,
        consigneCandidat: c.brief?.trim() || '',
        briefPatient: c.patient_profile?.role_brief?.trim() || '',
        grilleCorrection: c.grading_grid?.markdown?.trim() || '',
        imported: true,
      };
      setCases((prev) => [imported, ...prev]);
      setImportText('');
      setImportOpen(false);
      selectCase(imported);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setImportLoading(false);
    }
  }

  function pickStationFile() {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,text/plain,text/markdown';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setImportText(String(reader.result ?? ''));
      reader.onerror = () => setImportError('Lecture du fichier impossible.');
      reader.readAsText(file);
    };
    input.click();
  }

  if (persona !== 'student') {
    return (
      <View style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <Text style={styles.emoji}>🩺</Text>
          <Text style={styles.gateTitle}>Réservé aux étudiants</Text>
          <Text style={styles.gateText}>
            Le module ECOS est conçu pour les étudiants en santé. Changez votre profil en
            « Étudiant en santé » pour y accéder.
          </Text>
          <Link href="/(account)/choose-role" style={styles.gateLink}>
            Gérer mon profil
          </Link>
        </View>
      </View>
    );
  }

  function selectCase(cas: EcosCase) {
    setSelectedCase(cas);
    setMessages([]);
    setEvaluation('');
    sessionSavedRef.current = false;
    setPhase('preparation');
  }

  function startSimulation() {
    setPhase('simulation');
    setMessages([{
      role: 'assistant',
      content: '*[L\'examinateur entre dans la salle]* Bonjour, vous pouvez commencer.',
    }]);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || aiLoading || !selectedCase) return;
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setAiLoading(true);

    const systemPrompt = `${selectedCase.briefPatient}

RÈGLES :
- Tu joues uniquement le patient. Réponds en caractère de patient, jamais en tant qu'IA.
- Si l'étudiant sort du cadre médical, recentre sur le motif de consultation.
- Réponses courtes (2-4 phrases), naturelles, sans termes médicaux.`;

    try {
      const res = await fetch('/api/ecos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'simulate',
          systemPrompt,
          messages: newMessages,
        }),
      });

      if (!res.ok) throw new Error('Erreur de réponse.');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Flux indisponible.');

      const decoder = new TextDecoder();
      let reply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
      }

      if (reply.trim()) {
        setMessages((prev) => [...prev, { role: 'assistant', content: reply.trim() }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '[Erreur de communication. Réessayez.]' },
      ]);
    } finally {
      setAiLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  async function finishEcos() {
    if (!selectedCase || messages.length < 2) return;
    setPhase('evaluation');
    setEvalLoading(true);

    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'ÉTUDIANT' : 'PATIENT'}: ${m.content}`)
      .join('\n\n');

    const evalSystemPrompt = `Tu es un examinateur ECOS expert. Évalue l'étudiant en markdown structuré avec ces sections :

## Résultat global
Note estimée sur 20 avec justification courte.

## Points forts
Éléments bien maîtrisés (référence à la grille).

## Axes d'amélioration
Points manquants ou insuffisants (référence à la grille).

## Feedback pédagogique
2-3 conseils pratiques pour progresser.

Sois précis, bienveillant et pédagogique.`;

    try {
      const res = await fetch('/api/ecos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'evaluate',
          systemPrompt: evalSystemPrompt,
          messages: [
            {
              role: 'user',
              content: `Grille de correction du cas "${selectedCase.titre}" :\n\n${selectedCase.grilleCorrection}\n\nTranscription de la simulation :\n\n${transcript}`,
            },
          ],
        }),
      });

      if (!res.ok) throw new Error('Erreur d\'évaluation.');
      const data = await res.json() as { evaluation?: string };
      const evalText = data.evaluation ?? 'Évaluation non disponible.';
      setEvaluation(evalText);

      // Enregistre la session (note /20 extraite) une seule fois — local, web only.
      if (!sessionSavedRef.current) {
        sessionSavedRef.current = true;
        const session: EcosSession = {
          caseId: selectedCase.id,
          caseTitle: selectedCase.titre,
          specialty: selectedCase.specialite,
          score: parseEcosScore(evalText),
          date: new Date().toISOString(),
        };
        setSessions(addSession(session));
      }
    } catch {
      setEvaluation('Une erreur est survenue lors de l\'évaluation.');
    } finally {
      setEvalLoading(false);
    }
  }

  // ── Phase : sélection ──────────────────────────────────────────────────
  if (phase === 'selection') {
    const favSet = new Set(favorites);
    const lastScores = lastScoreByCase(sessions);
    const progress = computeProgress(sessions);
    const visibleCases = showFavoritesOnly
      ? cases.filter((c) => favSet.has(c.id))
      : cases;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.selectionContent}>
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionTitle}>Simulation ECOS</Text>
          <Text style={styles.selectionSubtitle}>
            Choisissez un cas clinique pour simuler une consultation avec un patient IA et obtenir
            une évaluation sur grille.
          </Text>
        </View>

        {progress.total > 0 ? (
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <ProgressStat label="Stations" value={String(progress.total)} />
              <ProgressStat
                label="Moyenne"
                value={progress.averageOn20 != null ? `${progress.averageOn20}/20` : '—'}
              />
              <ProgressStat
                label="Meilleure"
                value={progress.bestOn20 != null ? `${progress.bestOn20}/20` : '—'}
              />
            </View>
            <TouchableOpacity
              onPress={() => setSessions(clearSessions())}
              accessibilityRole="button"
            >
              <Text style={styles.progressClear}>Réinitialiser ma progression</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionChip, importOpen && styles.actionChipActive]}
            onPress={() => setImportOpen((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={[styles.actionChipText, importOpen && styles.actionChipTextActive]}>
              ＋ Importer une station
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionChip, showFavoritesOnly && styles.actionChipActive]}
            onPress={() => setShowFavoritesOnly((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={[styles.actionChipText, showFavoritesOnly && styles.actionChipTextActive]}>
              ★ Favoris{favorites.length ? ` (${favorites.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {importOpen ? (
          <View style={styles.importPanel}>
            <Text style={styles.importHint}>
              Colle une station corrigée (énoncé + grille). L'IA en génère un cas ECOS fictif et
              anonyme, jouable immédiatement. Aucun dossier patient réel.
            </Text>
            <TextInput
              style={styles.importInput}
              value={importText}
              onChangeText={setImportText}
              placeholder="Colle ici l'énoncé et la grille de la station…"
              placeholderTextColor={tokens.colors.textMuted}
              multiline
              editable={!importLoading}
              textAlignVertical="top"
            />
            {Platform.OS === 'web' ? (
              <TouchableOpacity onPress={pickStationFile} accessibilityRole="button">
                <Text style={styles.importFileLink}>📂 …ou importer un fichier .txt / .md</Text>
              </TouchableOpacity>
            ) : null}
            {importError ? <Text style={styles.importError}>{importError}</Text> : null}
            <TouchableOpacity
              style={[styles.importButton, (importLoading || importText.trim().length < 40) && styles.buttonDisabledOpacity]}
              onPress={importStation}
              disabled={importLoading || importText.trim().length < 40}
              accessibilityRole="button"
            >
              {importLoading ? (
                <ActivityIndicator color={tokens.colors.onAccent} size="small" />
              ) : (
                <Text style={styles.importButtonText}>Générer le cas</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {casesLoading ? (
          <View style={styles.casesState}>
            <ActivityIndicator color={tokens.colors.accent} size="large" />
            <Text style={styles.casesStateText}>Chargement des cas…</Text>
          </View>
        ) : casesError ? (
          <View style={styles.casesState}>
            <Text style={styles.casesStateText}>{casesError}</Text>
            <TouchableOpacity style={styles.casesRetry} onPress={loadCases}>
              <Text style={styles.casesRetryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : visibleCases.length === 0 ? (
          <View style={styles.casesState}>
            <Text style={styles.casesStateText}>
              {showFavoritesOnly
                ? 'Aucun cas en favori. Touchez ☆ sur un cas pour l\'ajouter.'
                : 'Aucun cas ECOS disponible pour le moment.'}
            </Text>
          </View>
        ) : (
          visibleCases.map((cas) => (
            <CaseCard
              key={cas.id}
              cas={cas}
              onSelect={() => selectCase(cas)}
              isFavorite={favSet.has(cas.id)}
              onToggleFavorite={() => onToggleFavorite(cas.id)}
              lastScore={lastScores[cas.id]}
            />
          ))
        )}
      </ScrollView>
    );
  }

  // ── Phase : préparation ────────────────────────────────────────────────
  if (phase === 'preparation' && selectedCase) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.prepContent}>
        <View style={styles.prepHeader}>
          <TouchableOpacity onPress={() => setPhase('selection')} style={styles.backButton}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.prepTitle}>{selectedCase.titre}</Text>
          <View style={styles.prepBadge}>
            <Text style={styles.prepBadgeText}>{selectedCase.specialite}</Text>
          </View>
        </View>

        <View style={styles.consigneCard}>
          <Text style={styles.consigneLabel}>Consigne candidat</Text>
          <Text style={styles.consigneText}>{selectedCase.consigneCandidat}</Text>
        </View>

        <View style={styles.prepInfo}>
          <View style={styles.prepInfoItem}>
            <Text style={styles.prepInfoEmoji}>⏱</Text>
            <Text style={styles.prepInfoText}>Durée : {selectedCase.duree} min</Text>
          </View>
          <View style={styles.prepInfoItem}>
            <Text style={styles.prepInfoEmoji}>📋</Text>
            <Text style={styles.prepInfoText}>Évaluation sur grille à la fin</Text>
          </View>
          <View style={styles.prepInfoItem}>
            <Text style={styles.prepInfoEmoji}>🤖</Text>
            <Text style={styles.prepInfoText}>Le patient est joué par l'IA</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.startButton} onPress={startSimulation}>
          <Text style={styles.startText}>Démarrer la simulation</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Phase : simulation ─────────────────────────────────────────────────
  if (phase === 'simulation' && selectedCase) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.simHeader}>
          <View>
            <Text style={styles.simTitle}>{selectedCase.titre}</Text>
            <Text style={styles.simSubtitle}>{selectedCase.specialite}</Text>
          </View>
          <Timer
            totalSeconds={selectedCase.duree * 60}
            onExpire={finishEcos}
          />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.simMessages}
          contentContainerStyle={styles.simMessagesContent}
        >
          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.simBubble,
                m.role === 'user' ? styles.simBubbleUser : styles.simBubblePatient,
              ]}
            >
              <Text style={styles.simBubbleRole}>
                {m.role === 'user' ? 'Vous' : 'Patient'}
              </Text>
              <Text
                style={m.role === 'user' ? styles.simTextUser : styles.simTextPatient}
              >
                {m.content}
              </Text>
            </View>
          ))}
          {aiLoading && (
            <View style={styles.simTyping}>
              <ActivityIndicator color={tokens.colors.accent} size="small" />
              <Text style={styles.simTypingText}>Le patient répond…</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.simFooter}>
          <View style={styles.simInputRow}>
            <DictationButton
              onTranscript={(text) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
              disabled={aiLoading}
            />
            <TextInput
              style={styles.simInput}
              value={input}
              onChangeText={setInput}
              placeholder="Votre question au patient…"
              placeholderTextColor={tokens.colors.textMuted}
              multiline
              editable={!aiLoading}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.simSend, (aiLoading || !input.trim()) && styles.simSendDisabled]}
              onPress={sendMessage}
              disabled={aiLoading || !input.trim()}
            >
              <Text style={styles.simSendText}>→</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.finishButton} onPress={finishEcos}>
            <Text style={styles.finishText}>Terminer et évaluer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Phase : évaluation ─────────────────────────────────────────────────
  if (phase === 'evaluation') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.evalContent}>
        <View style={styles.evalHeader}>
          <Text style={styles.evalTitle}>Évaluation</Text>
          <Text style={styles.evalSubtitle}>{selectedCase?.titre}</Text>
        </View>

        {evalLoading ? (
          <View style={styles.evalLoading}>
            <ActivityIndicator color={tokens.colors.accent} size="large" />
            <Text style={styles.evalLoadingText}>Évaluation en cours…</Text>
          </View>
        ) : (
          <View style={styles.evalResult}>
            <MarkdownRenderer text={evaluation} />
          </View>
        )}

        <TouchableOpacity
          style={styles.retryEcos}
          onPress={() => {
            setPhase('selection');
            setSelectedCase(null);
            setMessages([]);
            setEvaluation('');
          }}
        >
          <Text style={styles.retryEcosText}>Nouvelle simulation</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },

  // Selection
  selectionContent: { padding: tokens.space.lg, gap: tokens.space.md },
  selectionHeader: { marginBottom: tokens.space.sm },
  selectionTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
    lineHeight: tokens.type.h2.lineHeight,
  },
  selectionSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: 4,
  },
  casesState: {
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space['2xl'],
  },
  casesStateText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    textAlign: 'center',
  },
  casesRetry: {
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.sm,
  },
  casesRetryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },

  // Progression
  progressCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  progressRow: { flexDirection: 'row', gap: tokens.space.sm },
  progressStat: {
    flex: 1,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    alignItems: 'center',
  },
  progressStatValue: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
  },
  progressStatLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  progressClear: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },

  // Actions (import + favoris)
  actionsRow: { flexDirection: 'row', gap: tokens.space.sm, flexWrap: 'wrap' },
  actionChip: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 2,
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  actionChipActive: {
    backgroundColor: tokens.colors.accentSurface,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  actionChipText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  actionChipTextActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },

  // Import panel
  importPanel: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  importHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
  },
  importInput: {
    minHeight: 120,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    padding: tokens.space.md,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    color: tokens.colors.text,
  },
  importFileLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  importError: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.caption.fontSize,
  },
  importButton: {
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
  },
  buttonDisabledOpacity: { opacity: 0.45 },
  importButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },

  // Preparation
  prepContent: { padding: tokens.space.lg, gap: tokens.space.md },
  prepHeader: { gap: tokens.space.xs },
  backButton: { marginBottom: tokens.space.xs },
  backText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  prepTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  prepBadge: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  prepBadgeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  consigneCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  consigneLabel: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: tokens.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  consigneText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  prepInfo: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
  },
  prepInfoItem: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  prepInfoEmoji: { fontSize: 18 },
  prepInfoText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
  },
  startButton: {
    height: 52,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
  },
  startText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: tokens.type.body.fontSize,
  },

  // Simulation
  simHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  simTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
  },
  simSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginTop: 2,
  },
  simMessages: { flex: 1 },
  simMessagesContent: { padding: tokens.space.lg, gap: tokens.space.md },
  simBubble: { maxWidth: '88%', borderRadius: tokens.radius.lg, padding: tokens.space.md, gap: 4 },
  simBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colors.accent,
    borderBottomRightRadius: 6,
  },
  simBubblePatient: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderBottomLeftRadius: 6,
  },
  simBubbleRole: {
    fontFamily: tokens.font.mono,
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: tokens.weight.medium,
  },
  simTextUser: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  simTextPatient: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  simTyping: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.sm,
  },
  simTypingText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
  },
  simFooter: {
    padding: tokens.space.md,
    gap: tokens.space.sm,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderColor: tokens.colors.border,
  },
  simInputRow: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'flex-end' },
  simInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
  },
  simSend: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simSendDisabled: { opacity: 0.45 },
  simSendText: {
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: 20,
  },
  finishButton: {
    height: 40,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },

  // Evaluation
  evalContent: { padding: tokens.space.lg, gap: tokens.space.md },
  evalHeader: { gap: 4 },
  evalTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  evalSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
  },
  evalLoading: { alignItems: 'center', gap: tokens.space.lg, padding: tokens.space['2xl'] },
  evalLoadingText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
  },
  evalResult: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    ...tokens.elevation.sm,
  },
  retryEcos: {
    height: 48,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  retryEcosText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },

  // Gate
  gateContainer: { flex: 1, justifyContent: 'center', padding: tokens.space.xl, backgroundColor: tokens.colors.background },
  gateCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.xl,
    alignItems: 'center',
    gap: tokens.space.md,
    ...tokens.elevation.md,
  },
  emoji: { fontSize: 40 },
  gateTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.type.h3.letterSpacing,
    textAlign: 'center',
  },
  gateText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    textAlign: 'center',
    maxWidth: 340,
  },
  gateLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.lg,
    overflow: 'hidden',
    marginTop: tokens.space.sm,
  },
});

const caseStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.xs,
    ...tokens.elevation.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  cardTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    flex: 1,
    marginRight: tokens.space.sm,
  },
  badge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  star: { fontSize: 20, color: tokens.colors.borderStrong },
  starActive: { color: tokens.colors.warningText },
  cardSpecialite: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: tokens.weight.medium,
  },
  cardConsigne: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    marginTop: tokens.space.xs,
  },
  importedTag: {
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 1,
  },
  importedTagText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 10,
    fontWeight: tokens.weight.medium,
  },
  lastScore: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.success,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});

const timerStyles = StyleSheet.create({
  wrap: {
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  wrapLow: { backgroundColor: tokens.colors.dangerBackground, borderColor: tokens.colors.danger },
  text: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
  },
  textLow: { color: tokens.colors.danger },
});
