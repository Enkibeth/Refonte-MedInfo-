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

// ── Types ─────────────────────────────────────────────────────────────────────

interface EcosCase {
  id: string;
  titre: string;
  specialite: string;
  duree: number;
  consigneCandidat: string;
  briefPatient: string;
  grilleCorrection: string;
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

function CaseCard({ cas, index, onSelect }: { cas: EcosCase; index?: number; onSelect: () => void }) {
  const idx = typeof index === 'number' ? String(index + 1).padStart(2, '0') : null;
  return (
    <TouchableOpacity style={caseStyles.card} onPress={onSelect} accessibilityRole="button">
      <View style={caseStyles.cardHeader}>
        {idx ? <Text style={caseStyles.cardIndex}>[ {idx} ]</Text> : null}
        <View style={caseStyles.badge}>
          <Text style={caseStyles.badgeText}>{cas.duree} MIN</Text>
        </View>
      </View>
      <Text style={caseStyles.cardTitle}>{cas.titre}</Text>
      <Text style={caseStyles.cardSpecialite}>{cas.specialite}</Text>
      <Text style={caseStyles.cardConsigne} numberOfLines={2}>
        {cas.consigneCandidat}
      </Text>
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
    if (persona === 'student') loadCases();
  }, [persona, loadCases]);

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
      setEvaluation(data.evaluation ?? 'Évaluation non disponible.');
    } catch {
      setEvaluation('Une erreur est survenue lors de l\'évaluation.');
    } finally {
      setEvalLoading(false);
    }
  }

  // ── Phase : sélection ──────────────────────────────────────────────────
  if (phase === 'selection') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.selectionContent}>
        <View style={styles.selectionHeader}>
          <Text style={styles.kicker}>/ ECOS — STATION</Text>
          <Text style={styles.selectionTitle}>Simulation ECOS</Text>
          <Text style={styles.selectionSubtitle}>
            Choisissez un cas clinique pour simuler une consultation avec un patient IA et obtenir
            une évaluation sur grille.
          </Text>
        </View>

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
        ) : cases.length === 0 ? (
          <View style={styles.casesState}>
            <Text style={styles.casesStateText}>
              Aucun cas ECOS disponible pour le moment.
            </Text>
          </View>
        ) : (
          cases.map((cas, i) => (
            <CaseCard key={cas.id} cas={cas} index={i} onSelect={() => selectCase(cas)} />
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
          <Text style={styles.kicker}>/ ECOS — PRÉPARATION</Text>
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
              <Text style={[styles.simBubbleRole, m.role !== 'user' && styles.simBubbleRolePatient]}>
                {m.role === 'user' ? 'VOUS' : 'PATIENT'}
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
          <Text style={styles.kicker}>/ ECOS — RÉSULTAT</Text>
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

  kicker: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accent,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
    textTransform: 'uppercase',
    marginBottom: tokens.space.sm,
  },

  // Selection
  selectionContent: { padding: tokens.space.lg, gap: tokens.space.md },
  selectionHeader: { marginBottom: tokens.space.sm },
  selectionTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.bold,
    lineHeight: tokens.type.display.lineHeight,
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
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.accent,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.sm,
    ...tokens.elevation.md,
  },
  casesRetryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: tokens.type.label.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  prepBadge: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.surfacePure,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  prepBadgeText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.text,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
  },
  consigneCard: {
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfacePure,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
  },
  consigneLabel: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
    textTransform: 'uppercase',
  },
  consigneText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  prepInfo: {
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
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
    height: tokens.size.controlLg,
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.accent,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.md,
  },
  startText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: tokens.type.body.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Simulation
  simHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
  },
  simTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  simSubtitle: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  simMessages: { flex: 1 },
  simMessagesContent: { padding: tokens.space.lg, gap: tokens.space.md },
  simBubble: {
    maxWidth: '88%',
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    padding: tokens.space.md,
    gap: 4,
  },
  simBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colors.accent,
  },
  simBubblePatient: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surface,
  },
  simBubbleRole: {
    fontFamily: tokens.font.mono,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    color: tokens.colors.onAccent,
  },
  simBubbleRolePatient: { color: tokens.colors.textMuted },
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
    borderTopWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
  },
  simInputRow: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'flex-end' },
  simInput: {
    flex: 1,
    minHeight: tokens.size.controlMd,
    maxHeight: 100,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfacePure,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
  },
  simSend: {
    width: tokens.size.controlMd,
    height: tokens.size.controlMd,
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.accent,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.select({ web: { boxShadow: '3px 3px 0 0 #16140E' }, default: {} }) as object),
  },
  simSendDisabled: {
    backgroundColor: tokens.colors.surfaceSunken,
    borderColor: tokens.colors.borderSoft,
    ...(Platform.select({ web: { boxShadow: 'none' } as object, default: {} })),
  },
  simSendText: {
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: 20,
  },
  finishButton: {
    height: tokens.size.controlMd,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfacePure,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.text,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    fontWeight: tokens.weight.bold,
  },

  // Evaluation
  evalContent: { padding: tokens.space.lg, gap: tokens.space.md },
  evalHeader: { gap: 4 },
  evalTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  evalSubtitle: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
  },
  evalLoading: { alignItems: 'center', gap: tokens.space.lg, padding: tokens.space['2xl'] },
  evalLoadingText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
  },
  evalResult: {
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfacePure,
    padding: tokens.space.lg,
  },
  retryEcos: {
    height: tokens.size.controlLg,
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.accent,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: tokens.space.sm,
    ...tokens.elevation.md,
  },
  retryEcosText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: tokens.type.label.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Gate
  gateContainer: { flex: 1, justifyContent: 'center', padding: tokens.space.xl, backgroundColor: tokens.colors.background },
  gateCard: {
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfacePure,
    padding: tokens.space.xl,
    alignItems: 'center',
    gap: tokens.space.md,
    ...tokens.elevation.md,
  },
  emoji: { fontSize: 40 },
  gateTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.type.h2.letterSpacing,
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
    fontWeight: tokens.weight.bold,
    fontSize: tokens.type.label.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
    marginTop: tokens.space.sm,
  },
});

const caseStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfacePure,
    padding: tokens.space.lg,
    gap: tokens.space.xs,
    ...tokens.elevation.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardIndex: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
  },
  cardTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
    marginRight: tokens.space.sm,
  },
  badge: {
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.accent,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    fontWeight: tokens.weight.bold,
  },
  cardSpecialite: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    fontWeight: tokens.weight.medium,
  },
  cardConsigne: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
    marginTop: 2,
  },
});

const timerStyles = StyleSheet.create({
  wrap: {
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.surfacePure,
    borderWidth: tokens.border.bold,
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
