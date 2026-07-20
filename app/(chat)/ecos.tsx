/**
 * ECOS — Examen Clinique Objectif Structuré.
 * Dashboard d'entraînement (stats globales, filtres, cas classés par thème,
 * historique des passages avec notes) + simulation patient–étudiant et
 * évaluation IA sur grille de correction.
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
import { isAdminUserId } from '@/admin/index';
import { getSupabaseClient } from '@/db/supabase';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { PAGE_SEO, breadcrumbJsonLd, webApplicationJsonLd } from '@/seo/meta';
import { SeoHead } from '@/ui/SeoHead';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { RoleGate } from '@/ui/RoleGate';
import { DictationButton } from '@/ui/DictationButton';
import { exportAnalysisToPdf } from '@/document/exportAnalysisPdf';
import { parseScoreFromEvaluation, scoreTone, formatScore, type ScoreTone } from '@/ecos/score';
import {
  computeEcosStats,
  summarizeAttemptsByCase,
  filterCases,
  groupCasesByTheme,
  listThemes,
  type AttemptLite,
  type StatusFilter,
  type CaseAttemptSummary,
} from '@/ecos/dashboard';
import {
  listAttempts,
  saveAttempt,
  deleteAttempt,
  type EcosAttemptRow,
} from '@/ecos/attemptsDb';

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
  /** Bulle d'erreur UI : jamais envoyée à l'IA ni comptée dans la transcription. */
  error?: boolean;
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

// ── Aides d'affichage note ───────────────────────────────────────────────────

function toneColors(tone: ScoreTone): { fg: string; bg: string } {
  switch (tone) {
    case 'success':
      return { fg: tokens.colors.success, bg: tokens.colors.successBackground };
    case 'warning':
      return { fg: tokens.colors.warningText, bg: tokens.colors.warningBackground };
    case 'danger':
      return { fg: tokens.colors.danger, bg: tokens.colors.dangerBackground };
  }
}

const TONE_LABELS: Record<ScoreTone, string> = {
  success: 'Bien maîtrisé',
  warning: 'Acquis, à consolider',
  danger: 'À retravailler',
};

function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

// ── Composants ─────────────────────────────────────────────────────────────

function ScorePill({ score, prefix }: { score: number | null; prefix?: string }) {
  if (score === null) {
    return (
      <View style={[dashStyles.scorePill, dashStyles.scorePillEmpty]}>
        <Text style={dashStyles.scorePillEmptyText}>{prefix ?? ''}—/20</Text>
      </View>
    );
  }
  const { fg, bg } = toneColors(scoreTone(score));
  return (
    <View style={[dashStyles.scorePill, { backgroundColor: bg }]}>
      <Text style={[dashStyles.scorePillText, { color: fg }]}>
        {prefix ?? ''}
        {formatScore(score)}/20
      </Text>
    </View>
  );
}

function StatTile({
  label,
  value,
  suffix,
  hint,
  valueColor,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  valueColor?: string;
}) {
  return (
    <View style={dashStyles.statTile}>
      <Text style={dashStyles.statLabel}>{label}</Text>
      <Text style={[dashStyles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
        {suffix ? <Text style={dashStyles.statSuffix}>{suffix}</Text> : null}
      </Text>
      {hint ? <Text style={dashStyles.statHint}>{hint}</Text> : null}
    </View>
  );
}

function CaseCard({
  cas,
  summary,
  onSelect,
}: {
  cas: EcosCase;
  summary: CaseAttemptSummary | undefined;
  onSelect: () => void;
}) {
  const done = (summary?.attempts ?? 0) > 0;
  return (
    <TouchableOpacity style={caseStyles.card} onPress={onSelect} accessibilityRole="button">
      <View style={caseStyles.cardHeader}>
        <Text style={caseStyles.cardTitle}>{cas.titre}</Text>
        <View style={caseStyles.badge}>
          <Text style={caseStyles.badgeText}>{cas.duree} min</Text>
        </View>
      </View>
      <Text style={caseStyles.cardConsigne} numberOfLines={2}>
        {cas.consigneCandidat}
      </Text>
      <View style={caseStyles.cardFooter}>
        {done && summary ? (
          <>
            <ScorePill score={summary.best} prefix="Meilleure : " />
            <Text style={caseStyles.cardMeta}>
              {summary.attempts} {summary.attempts > 1 ? 'passages' : 'passage'}
              {summary.last !== null ? ` · dernière ${formatScore(summary.last)}/20` : ''}
            </Text>
          </>
        ) : (
          <View style={caseStyles.todoPill}>
            <Text style={caseStyles.todoPillText}>À faire</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function Timer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expired = useRef(false);

  // Le callback est gardé dans une ref : l'intervalle ci-dessous ne dépend donc
  // PAS de `onExpire`. Sans ça, `onExpire` (recréé à chaque rendu du parent) relançait
  // l'intervalle à chaque frappe dans la zone de saisie → le compte à rebours se figeait.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          if (!expired.current) {
            expired.current = true;
            onExpireRef.current();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
    <>
      {/* SEO par feature (2026-07) : titre/description/canonical + fiche WebApplication,
          rendus pour tous (y compris visiteurs) — RoleGate ne gate que le contenu. */}
      <SeoHead
        title={PAGE_SEO.ecos.title}
        description={PAGE_SEO.ecos.description}
        path={PAGE_SEO.ecos.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Simulation ECOS', path: PAGE_SEO.ecos.path },
          ]),
          webApplicationJsonLd({
            name: 'Simulation ECOS — MedInfo AI',
            description: PAGE_SEO.ecos.description,
            path: PAGE_SEO.ecos.path,
          }),
        ]}
      />
      <RoleGate feature="ecos">
        <EcosScreenInner />
      </RoleGate>
    </>
  );
}

function EcosScreenInner() {
  const { persona, user } = useSession();
  const [phase, setPhase] = useState<Phase>('selection');
  const [selectedCase, setSelectedCase] = useState<EcosCase | null>(null);
  const [cases, setCases] = useState<EcosCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<EcosAttemptRow[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [evaluation, setEvaluation] = useState('');
  const [evalLoading, setEvalLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [viewedAttempt, setViewedAttempt] = useState<EcosAttemptRow | null>(null);
  // Filtres du dashboard
  const [query, setQuery] = useState('');
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const scrollRef = useRef<ScrollView>(null);

  // Évaluation affichée : passage historique consulté OU évaluation fraîche.
  const evalMarkdown = viewedAttempt ? viewedAttempt.evaluation : evaluation;
  const evalScore = viewedAttempt ? viewedAttempt.score : parseScoreFromEvaluation(evaluation);
  const evalCaseTitle = viewedAttempt ? viewedAttempt.case_title : selectedCase?.titre ?? '';

  const evalTitle = () => `Évaluation ECOS — ${evalCaseTitle}`.trim();

  async function copyEvaluation() {
    if (!evalMarkdown) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(evalMarkdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* presse-papiers indisponible */
    }
  }

  function handleExportEval() {
    if (!evalMarkdown) return;
    exportAnalysisToPdf({ title: evalTitle(), markdown: evalMarkdown });
  }

  const loadDashboard = useCallback(async () => {
    setCasesLoading(true);
    setCasesError(null);
    try {
      // L'historique est best-effort : son échec ne bloque pas l'entraînement.
      const [loadedCases, loadedAttempts] = await Promise.all([
        fetchPublishedCases(),
        listAttempts().catch(() => [] as EcosAttemptRow[]),
      ]);
      setCases(loadedCases);
      setAttempts(loadedAttempts);
    } catch {
      setCasesError('Impossible de charger le dashboard ECOS. Réessayez.');
    } finally {
      setCasesLoading(false);
    }
  }, []);

  // Même règle que RoleGate/CLAUDE.md : étudiants ET admins (quelle que soit leur
  // persona active) accèdent au module — le garde interne enfermait les admins.
  const canUseEcos = persona === 'student' || (user ? isAdminUserId(user.id) : false);

  useEffect(() => {
    if (canUseEcos) loadDashboard();
  }, [canUseEcos, loadDashboard]);

  if (!canUseEcos) {
    return (
      <View style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <View style={styles.iconBadge}>
            <Icon name="stethoscope" size={26} color={tokens.colors.accentDeep} />
          </View>
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
    setViewedAttempt(null);
    setPhase('preparation');
  }

  function backToDashboard() {
    setPhase('selection');
    setSelectedCase(null);
    setMessages([]);
    setEvaluation('');
    setViewedAttempt(null);
    setSaveError(false);
  }

  function openAttempt(attempt: EcosAttemptRow) {
    setViewedAttempt(attempt);
    setSelectedCase(null);
    setEvaluation('');
    setSaveError(false);
    setPhase('evaluation');
  }

  async function removeViewedAttempt() {
    if (!viewedAttempt) return;
    const ok =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Supprimer ce passage de ton historique ? La note et l’évaluation seront perdues.')
        : true;
    if (!ok) return;
    try {
      await deleteAttempt(viewedAttempt.id);
      setAttempts((prev) => prev.filter((a) => a.id !== viewedAttempt.id));
      backToDashboard();
    } catch {
      /* suppression impossible (hors-ligne ?) — l'historique restera inchangé */
    }
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
    // Les bulles d'erreur UI sont retirées de l'historique envoyé au « patient »
    // (et de l'affichage : le nouvel essai les remplace).
    const newMessages: Message[] = [
      ...messages.filter((m) => !m.error),
      { role: 'user', content: text },
    ];
    setMessages(newMessages);
    setAiLoading(true);

    // On n'envoie QUE la fiche de rôle du cas : les RÈGLES de comportement du patient
    // (anti « faux positif ») sont appliquées côté serveur via le prompt `ecos_patient`.
    const systemPrompt = selectedCase.briefPatient;

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
      let started = false;

      // Affichage au fil du flux : la bulle du patient se remplit en direct
      // (au lieu d'apparaître d'un bloc à la fin).
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        if (!reply) continue;
        if (!started) {
          started = true;
          setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        } else {
          setMessages((prev) => {
            const copy = prev.slice();
            copy[copy.length - 1] = { role: 'assistant', content: reply };
            return copy;
          });
        }
        scrollRef.current?.scrollToEnd({ animated: false });
      }

      // Flux terminé sans un seul octet : traite comme une erreur au lieu de
      // laisser la question de l'étudiant sans réponse ni explication.
      if (!started) throw new Error('Réponse vide.');

      // Normalise la version finale (trim) une fois le flux terminé.
      setMessages((prev) => {
        const copy = prev.slice();
        copy[copy.length - 1] = { role: 'assistant', content: reply.trim() };
        return copy;
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '[Erreur de communication. Réessayez.]', error: true },
      ]);
    } finally {
      setAiLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  // Demande de fin par l'étudiant (bouton) : garde-fous + confirmation, car ça clôt
  // la station. L'expiration du chrono, elle, appelle finishEcos() directement.
  function requestFinish() {
    if (!selectedCase) return;
    const userTurns = messages.filter((m) => m.role === 'user').length;
    if (userTurns === 0) {
      setInput('');
      return;
    }
    const ok =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(
            "Terminer la simulation et lancer l'évaluation ? Tu ne pourras plus échanger avec le patient.",
          )
        : true;
    if (ok) void finishEcos();
  }

  // Expiration du chrono : s'il n'y a rien à évaluer (aucun tour étudiant), on
  // revient au dashboard — sinon l'écran restait figé sans aucune sortie.
  function handleTimerExpire() {
    const userTurns = messages.filter((m) => m.role === 'user').length;
    if (userTurns === 0) {
      setSelectedCase(null);
      setMessages([]);
      setInput('');
      setPhase('selection');
      return;
    }
    void finishEcos();
  }

  async function finishEcos() {
    if (!selectedCase || messages.length < 2) return;
    setPhase('evaluation');
    setEvalLoading(true);
    setViewedAttempt(null);
    setSaveError(false);

    // Les bulles d'erreur UI ne font pas partie de la prestation évaluée.
    const transcript = messages
      .filter((m) => !m.error)
      .map((m) => `${m.role === 'user' ? 'ÉTUDIANT' : 'PATIENT'}: ${m.content}`)
      .join('\n\n');

    // Le cadre d'évaluation complet (sections + format de note « **Note : X/20** »)
    // vient du prompt serveur `ecos_evaluate` (promptStore, éditable panel admin) ;
    // on n'envoie ici que le contexte de la station.
    const evalSystemPrompt = `Contexte : station ECOS « ${selectedCase.titre} » (${selectedCase.specialite}). L'étudiant vient de terminer la simulation ; évalue sa performance à partir de la grille de correction fournie.`;

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
      const text = data.evaluation ?? 'Évaluation non disponible.';
      setEvaluation(text);

      // Archivage du passage (note extraite déterministe, jamais inventée) —
      // best-effort : l'évaluation reste affichée même si l'insert échoue.
      if (user && data.evaluation) {
        try {
          const saved = await saveAttempt({
            userId: user.id,
            caseSlug: selectedCase.id,
            caseTitle: selectedCase.titre,
            specialty: selectedCase.specialite,
            score: parseScoreFromEvaluation(text),
            evaluation: text,
          });
          setAttempts((prev) => [saved, ...prev]);
        } catch {
          setSaveError(true);
        }
      }
    } catch {
      setEvaluation('Une erreur est survenue lors de l\'évaluation.');
    } finally {
      setEvalLoading(false);
    }
  }

  // ── Phase : sélection (dashboard) ──────────────────────────────────────
  if (phase === 'selection') {
    const attemptLites: AttemptLite[] = attempts.map((a) => ({
      caseSlug: a.case_slug,
      score: a.score,
      createdAt: a.created_at,
    }));
    const stats = computeEcosStats(cases.map((c) => c.id), attemptLites);
    const summaries = summarizeAttemptsByCase(attemptLites);
    const themes = listThemes(cases);
    const filtered = filterCases(cases, { query, theme: themeFilter, status: statusFilter }, summaries);
    const groups = groupCasesByTheme(filtered);
    const hasFilters = query.trim() !== '' || themeFilter !== null || statusFilter !== 'all';
    const recentAttempts = attempts.slice(0, 8);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.selectionContent}>
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionTitle}>Dashboard ECOS</Text>
          <Text style={styles.selectionSubtitle}>
            Entraîne-toi sur des stations fictives avec un patient joué par l'IA, suis tes notes
            et repère les thèmes à retravailler.
          </Text>
        </View>

        {casesLoading ? (
          <View style={styles.casesState}>
            <ActivityIndicator color={tokens.colors.accent} size="large" />
            <Text style={styles.casesStateText}>Chargement du dashboard…</Text>
          </View>
        ) : casesError ? (
          <View style={styles.casesState}>
            <Text style={styles.casesStateText}>{casesError}</Text>
            <TouchableOpacity style={styles.casesRetry} onPress={loadDashboard}>
              <Text style={styles.casesRetryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Stats globales */}
            <View style={dashStyles.statsRow}>
              <StatTile label="Cas disponibles" value={String(stats.casesAvailable)} />
              <StatTile
                label="Passages"
                value={String(stats.attemptsCount)}
                hint={
                  stats.attemptsCount > 0
                    ? `${stats.casesAttempted}/${stats.casesAvailable} cas couverts`
                    : 'Lance ta première station'
                }
              />
              <StatTile
                label="Note globale"
                value={stats.averageScore !== null ? formatScore(stats.averageScore) : '—'}
                suffix="/20"
                valueColor={
                  stats.averageScore !== null
                    ? toneColors(scoreTone(stats.averageScore)).fg
                    : undefined
                }
                hint="moyenne de tous tes passages"
              />
              <StatTile
                label="Meilleure note"
                value={stats.bestScore !== null ? formatScore(stats.bestScore) : '—'}
                suffix="/20"
                valueColor={
                  stats.bestScore !== null ? toneColors(scoreTone(stats.bestScore)).fg : undefined
                }
              />
            </View>

            {/* Filtres */}
            <View style={dashStyles.filters}>
              <View style={dashStyles.searchRow}>
                <Icon name="search" size={16} color={tokens.colors.textMuted} />
                <TextInput
                  style={dashStyles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Rechercher un cas, un thème…"
                  placeholderTextColor={tokens.colors.textMuted}
                />
                {query !== '' && (
                  <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Effacer la recherche">
                    <Icon name="x" size={16} color={tokens.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={dashStyles.segmentRow}>
                {([
                  ['all', 'Tous'],
                  ['todo', 'À faire'],
                  ['done', 'Déjà passés'],
                ] as [StatusFilter, string][]).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[dashStyles.segment, statusFilter === value && dashStyles.segmentActive]}
                    onPress={() => setStatusFilter(value)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        dashStyles.segmentText,
                        statusFilter === value && dashStyles.segmentTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {themes.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={dashStyles.themeRow}
                >
                  <TouchableOpacity
                    style={[dashStyles.themeChip, themeFilter === null && dashStyles.themeChipActive]}
                    onPress={() => setThemeFilter(null)}
                  >
                    <Text
                      style={[
                        dashStyles.themeChipText,
                        themeFilter === null && dashStyles.themeChipTextActive,
                      ]}
                    >
                      Tous les thèmes
                    </Text>
                  </TouchableOpacity>
                  {themes.map((theme) => (
                    <TouchableOpacity
                      key={theme}
                      style={[dashStyles.themeChip, themeFilter === theme && dashStyles.themeChipActive]}
                      onPress={() => setThemeFilter(themeFilter === theme ? null : theme)}
                    >
                      <Text
                        style={[
                          dashStyles.themeChipText,
                          themeFilter === theme && dashStyles.themeChipTextActive,
                        ]}
                      >
                        {theme}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Cas classés par thème */}
            {cases.length === 0 ? (
              <View style={styles.casesState}>
                <Text style={styles.casesStateText}>Aucun cas ECOS disponible pour le moment.</Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.casesState}>
                <Text style={styles.casesStateText}>Aucun cas ne correspond à ces filtres.</Text>
                <TouchableOpacity
                  style={styles.casesRetry}
                  onPress={() => {
                    setQuery('');
                    setThemeFilter(null);
                    setStatusFilter('all');
                  }}
                >
                  <Text style={styles.casesRetryText}>Réinitialiser les filtres</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {hasFilters && (
                  <Text style={dashStyles.resultCount}>
                    {filtered.length} {filtered.length > 1 ? 'cas affichés' : 'cas affiché'}
                  </Text>
                )}
                {groups.map((group) => (
                  <View key={group.theme} style={dashStyles.themeSection}>
                    <View style={dashStyles.themeHeader}>
                      <Text style={dashStyles.themeTitle}>{group.theme}</Text>
                      <Text style={dashStyles.themeCount}>{group.cases.length}</Text>
                    </View>
                    {group.cases.map((cas) => (
                      <CaseCard
                        key={cas.id}
                        cas={cas}
                        summary={summaries.get(cas.id)}
                        onSelect={() => selectCase(cas)}
                      />
                    ))}
                  </View>
                ))}
              </>
            )}

            {/* Historique des passages */}
            {recentAttempts.length > 0 && (
              <View style={dashStyles.historySection}>
                <View style={dashStyles.themeHeader}>
                  <Text style={dashStyles.themeTitle}>Derniers passages</Text>
                  <Text style={dashStyles.themeCount}>{attempts.length}</Text>
                </View>
                <View style={dashStyles.historyCard}>
                  {recentAttempts.map((attempt, index) => (
                    <TouchableOpacity
                      key={attempt.id}
                      style={[dashStyles.historyRow, index > 0 && dashStyles.historyRowBorder]}
                      onPress={() => openAttempt(attempt)}
                      accessibilityRole="button"
                      accessibilityLabel={`Voir l'évaluation de ${attempt.case_title}`}
                    >
                      <ScorePill score={attempt.score} />
                      <View style={dashStyles.historyInfo}>
                        <Text style={dashStyles.historyTitle} numberOfLines={1}>
                          {attempt.case_title}
                        </Text>
                        <Text style={dashStyles.historyMeta}>
                          {attempt.specialty ? `${attempt.specialty} · ` : ''}
                          {formatDay(attempt.created_at)}
                        </Text>
                      </View>
                      <Icon name="arrowRight" size={16} color={tokens.colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  }

  // ── Phase : préparation ────────────────────────────────────────────────
  if (phase === 'preparation' && selectedCase) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.prepContent}>
        <View style={styles.prepHeader}>
          <TouchableOpacity onPress={backToDashboard} style={styles.backButton}>
            <Text style={styles.backText}>← Retour au dashboard</Text>
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
            <Icon name="clock" size={18} color={tokens.colors.accentDeep} />
            <Text style={styles.prepInfoText}>Durée : {selectedCase.duree} min</Text>
          </View>
          <View style={styles.prepInfoItem}>
            <Icon name="fileText" size={18} color={tokens.colors.accentDeep} />
            <Text style={styles.prepInfoText}>Évaluation sur grille à la fin</Text>
          </View>
          <View style={styles.prepInfoItem}>
            <Icon name="sparkles" size={18} color={tokens.colors.accentDeep} />
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
            onExpire={handleTimerExpire}
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
          {aiLoading && messages[messages.length - 1]?.role === 'user' && (
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
          <TouchableOpacity style={styles.finishButton} onPress={requestFinish}>
            <Text style={styles.finishText}>Terminer et évaluer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Phase : évaluation (fraîche ou passage historique) ─────────────────
  if (phase === 'evaluation') {
    const heroTone = evalScore !== null ? scoreTone(evalScore) : null;
    const heroColors = heroTone ? toneColors(heroTone) : null;
    const replayCase = viewedAttempt
      ? cases.find((c) => c.id === viewedAttempt.case_slug) ?? null
      : null;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.evalContent}>
        <View style={styles.evalHeader}>
          <Text style={styles.evalTitle}>Évaluation</Text>
          <Text style={styles.evalSubtitle}>
            {evalCaseTitle}
            {viewedAttempt ? ` · ${formatDay(viewedAttempt.created_at)}` : ''}
          </Text>
        </View>

        {evalLoading ? (
          <View style={styles.evalLoading}>
            <ActivityIndicator color={tokens.colors.accent} size="large" />
            <Text style={styles.evalLoadingText}>Évaluation en cours…</Text>
          </View>
        ) : (
          <>
            {evalScore !== null && heroColors && heroTone && (
              <View style={[dashStyles.scoreHero, { backgroundColor: heroColors.bg }]}>
                <Text style={[dashStyles.scoreHeroValue, { color: heroColors.fg }]}>
                  {formatScore(evalScore)}
                  <Text style={dashStyles.scoreHeroMax}>/20</Text>
                </Text>
                <Text style={[dashStyles.scoreHeroLabel, { color: heroColors.fg }]}>
                  {TONE_LABELS[heroTone]}
                </Text>
              </View>
            )}

            {saveError && (
              <Text style={dashStyles.saveErrorText}>
                Ce passage n'a pas pu être enregistré dans ton historique (connexion ?). La note
                reste affichée ci-dessous.
              </Text>
            )}

            <View style={styles.evalResult}>
              <View style={styles.evalActions}>
                <TouchableOpacity
                  onPress={() => void copyEvaluation()}
                  accessibilityRole="button"
                  accessibilityLabel="Copier l'évaluation"
                  style={styles.evalAction}
                >
                  <Text style={styles.evalActionText}>{copied ? 'Copié ✓' : 'Copier'}</Text>
                </TouchableOpacity>
                {Platform.OS === 'web' ? (
                  <TouchableOpacity
                    onPress={handleExportEval}
                    accessibilityRole="button"
                    accessibilityLabel="Exporter l'évaluation en PDF"
                    style={styles.evalAction}
                  >
                    <Text style={styles.evalActionText}>Export PDF</Text>
                  </TouchableOpacity>
                ) : null}
                {viewedAttempt ? (
                  <TouchableOpacity
                    onPress={() => void removeViewedAttempt()}
                    accessibilityRole="button"
                    accessibilityLabel="Supprimer ce passage de l'historique"
                    style={styles.evalAction}
                  >
                    <Text style={[styles.evalActionText, { color: tokens.colors.danger }]}>
                      Supprimer
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <MarkdownRenderer text={evalMarkdown} />
            </View>
          </>
        )}

        {replayCase && (
          <TouchableOpacity style={styles.retryEcos} onPress={() => selectCase(replayCase)}>
            <Text style={styles.retryEcosText}>Repasser ce cas</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={viewedAttempt ? dashStyles.backToDashSecondary : styles.retryEcos}
          onPress={backToDashboard}
        >
          <Text
            style={viewedAttempt ? dashStyles.backToDashSecondaryText : styles.retryEcosText}
          >
            Retour au dashboard
          </Text>
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
  // Colonnes de lecture centrées (~800 px) : cohérentes avec le chat sur desktop.
  selectionContent: { padding: tokens.space.lg, gap: tokens.space.md, width: '100%', maxWidth: 800, alignSelf: 'center' },
  selectionHeader: { marginBottom: tokens.space.sm },
  selectionTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
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

  // Preparation
  prepContent: { padding: tokens.space.lg, gap: tokens.space.md, width: '100%', maxWidth: 800, alignSelf: 'center' },
  prepHeader: { gap: tokens.space.xs },
  backButton: { marginBottom: tokens.space.xs },
  backText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  prepTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
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
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
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
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  simSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginTop: 2,
  },
  simMessages: { flex: 1 },
  simMessagesContent: { padding: tokens.space.lg, gap: tokens.space.md, width: '100%', maxWidth: 800, alignSelf: 'center' },
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
    fontSize: tokens.type.micro.fontSize,
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
    fontSize: tokens.type.h3.fontSize,
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
  evalContent: { padding: tokens.space.lg, gap: tokens.space.md, width: '100%', maxWidth: 800, alignSelf: 'center' },
  evalHeader: { gap: 4 },
  evalTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
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
  evalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.space.xs,
    marginBottom: tokens.space.sm,
  },
  evalAction: {
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 6,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  evalActionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
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
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.semibold,
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

// Dashboard (stats, filtres, thèmes, historique) + hero de note.
const dashStyles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: 150,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: 4,
    ...tokens.elevation.sm,
  },
  statLabel: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  statValue: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h1.fontSize,
    lineHeight: tokens.type.h1.lineHeight,
    letterSpacing: tokens.type.h1.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  statSuffix: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    fontWeight: tokens.weight.medium,
    letterSpacing: 0,
  },
  statHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
  },

  // Filtres
  filters: { gap: tokens.space.sm, marginTop: tokens.space.xs },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
    paddingVertical: 0,
    height: '100%',
  },
  segmentRow: {
    flexDirection: 'row',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    borderRadius: tokens.radius.sm,
    paddingVertical: tokens.space.sm,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: tokens.colors.surface,
    ...tokens.elevation.sm,
  },
  segmentText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  segmentTextActive: {
    color: tokens.colors.text,
    fontWeight: tokens.weight.semibold,
  },
  themeRow: { gap: tokens.space.sm, paddingVertical: 2 },
  themeChip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 2,
  },
  themeChipActive: {
    backgroundColor: tokens.colors.accent,
    borderColor: tokens.colors.accent,
  },
  themeChipText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  themeChipTextActive: {
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
  },
  resultCount: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },

  // Sections par thème
  themeSection: { gap: tokens.space.sm, marginTop: tokens.space.sm },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  themeTitle: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  themeCount: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.medium,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 1,
    overflow: 'hidden',
  },

  // Pastille de note
  scorePill: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.sm + 2,
    paddingVertical: 3,
  },
  scorePillText: {
    fontFamily: tokens.font.mono,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
  },
  scorePillEmpty: {
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  scorePillEmptyText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },

  // Historique
  historySection: { gap: tokens.space.sm, marginTop: tokens.space.md },
  historyCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    ...tokens.elevation.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  historyRowBorder: {
    borderTopWidth: 1,
    borderColor: tokens.colors.border,
  },
  historyInfo: { flex: 1, gap: 1 },
  historyTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  historyMeta: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },

  // Hero de note (phase évaluation)
  scoreHero: {
    borderRadius: tokens.radius.lg,
    alignItems: 'center',
    paddingVertical: tokens.space.xl,
    gap: 2,
  },
  scoreHeroValue: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  scoreHeroMax: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.medium,
    letterSpacing: 0,
  },
  scoreHeroLabel: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  saveErrorText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.warningText,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
  },
  backToDashSecondary: {
    height: 48,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  backToDashSecondaryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
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
  cardTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.semibold,
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
    marginTop: tokens.space.sm,
    flexWrap: 'wrap',
  },
  cardMeta: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  todoPill: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.sm + 2,
    paddingVertical: 3,
  },
  todoPillText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accentDeep,
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
