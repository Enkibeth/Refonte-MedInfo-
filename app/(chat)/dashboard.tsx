/**
 * Vue d’ensemble — page d’accueil de l’espace connecté (refonte design 2026-07,
 * principe « dashboard » validé par Hugo).
 *
 * Hero bleu nuit (« Qu’est-ce qui compte aujourd’hui ? »), grille d’outils du rôle
 * à pastilles teintées, rail droit (prochain objectif + activité récente).
 *
 * Honnêteté des chiffres : tout vient des données de l'utilisateur (conversations,
 * passages ECOS, plans de révision) ou du moteur déterministe de révision, via le
 * module pur src/dashboard/overview.ts (testé). Aucune donnée → invitation neutre,
 * jamais un chiffre inventé. Chaque source est fail-soft : son échec masque sa
 * section, il ne casse jamais la page.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import {
  getFeatureMeta,
  isFeatureVisible,
  visibleFeatures,
  type AppFeatureId,
} from '@/ai/routing/featureVisibility';
import { listConversations, type ChatConversation } from '@/chat/history';
import { getSupabaseClient } from '@/db/supabase';
import { listAttempts, type EcosAttemptRow } from '@/ecos/attemptsDb';
import { todayISO } from '@/revision/db/plans';
import { getPlan, listPlans, type RevisionPlanListItem } from '@/revision/db/queries';
import type { ExamType } from '@/revision/types';
import {
  buildRecentActivity,
  conversationsThisWeek,
  formatMinutes,
  greetingWord,
  heroSummary,
  isoWeekNumber,
  planSnapshot,
  relativeLabel,
  shortDateLabel,
  truncateLabel,
  RISK_LABEL,
  type PlanSnapshot,
} from '@/dashboard/overview';
import { Button } from '@/ui/Button';
import type { ChatbotId } from '@/ai/chat/chatContext';
import { CHATBOT_META } from '@/ui/chat/ChatbotSwitcher';
import { featureTint } from '@/ui/featureChips';
import { HeroBackdrop } from '@/ui/HeroBackdrop';
import { Icon } from '@/ui/icons';
import { SeoHead } from '@/ui/SeoHead';
import { SHELL_BREAKPOINT } from '@/ui/shell/AppShell';
import { Skeleton } from '@/ui/Skeleton';
import { tokens } from '@/ui/tokens';

const EXAM_LABELS: Record<ExamType, string> = {
  pass_las: 'le PASS/LAS',
  dfgsm: 'le DFGSM',
  edn: "l’EDN",
  ecos: 'les ECOS',
  custom: "l’examen",
};

/** Copy d'action du CTA secondaire quand il ouvre un outil (repli : libellé de l'outil). */
const TOOL_CTA_LABEL: Partial<Record<AppFeatureId, string>> = {
  document: 'Analyser un document',
  ecos: 'Lancer un ECOS',
  revision: 'Planifier mes révisions',
  audio: 'Dicter un compte rendu',
  presentation: 'Créer une présentation',
  scores: 'Calculer un score',
};

interface NextExam {
  label: string;
  dateIso: string;
}

// ── Activité récente des autres outils (D1, audit chatbot 2026-07) ────────────
// Selects LÉGERS (métadonnées seulement, jamais le contenu) sur les tables
// own-row RLS des outils : chaque source est fail-soft — un échec renvoie [].

interface DocumentAnalysisRow {
  id: string;
  mode: string;
  source_name: string | null;
  created_at: string;
}
interface AudioDocumentRow {
  id: string;
  title: string;
  created_at: string;
}
interface TitledRow {
  id: string;
  title: string | null;
  updated_at: string;
}
interface ArticleDocumentRow extends TitledRow {
  doc_type: string;
}

async function listRecentRows<T>(
  table: string,
  columns: string,
  orderColumn: string,
): Promise<T[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: false })
      .limit(5);
    if (error || !data) return [];
    return data as T[];
  } catch {
    return [];
  }
}

/**
 * Cache mémoire léger du dashboard (stale-while-revalidate) : en navigation
 * aller-retour, les dernières données du MÊME utilisateur s'affichent
 * instantanément (plus de skeletons) pendant que le rafraîchissement réel se
 * fait en arrière-plan. Jamais persisté, jamais partagé entre comptes.
 */
const DASHBOARD_CACHE_TTL_MS = 5 * 60_000;

interface DashboardCache {
  userId: string;
  ts: number;
  convs: ChatConversation[] | null;
  attempts: EcosAttemptRow[] | null;
  plans: RevisionPlanListItem[] | null;
  snapshot: PlanSnapshot | null;
  nextExam: NextExam | null;
  docs: DocumentAnalysisRow[] | null;
  audios: AudioDocumentRow[] | null;
  decks: TitledRow[] | null;
  cvs: TitledRow[] | null;
  articles: ArticleDocumentRow[] | null;
}

let dashboardCache: DashboardCache | null = null;

function updateDashboardCache(
  userId: string,
  patch: Partial<Omit<DashboardCache, 'userId' | 'ts'>>,
) {
  const base: DashboardCache =
    dashboardCache?.userId === userId
      ? dashboardCache
      : {
          userId,
          ts: 0,
          convs: null,
          attempts: null,
          plans: null,
          snapshot: null,
          nextExam: null,
          docs: null,
          audios: null,
          decks: null,
          cvs: null,
          articles: null,
        };
  dashboardCache = { ...base, ...patch, userId, ts: Date.now() };
}

function freshDashboardCache(userId: string): DashboardCache | null {
  if (!dashboardCache || dashboardCache.userId !== userId) return null;
  return Date.now() - dashboardCache.ts < DASHBOARD_CACHE_TTL_MS ? dashboardCache : null;
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session, user, persona, personalInfo, loading } = useSession();

  const isAdmin = user ? isAdminUserId(user.id) : false;
  const canEcos = isFeatureVisible('ecos', persona, { isAdmin });
  const canRevision = isFeatureVisible('revision', persona, { isAdmin });
  const canDocument = isFeatureVisible('document', persona, { isAdmin });
  const canAudio = isFeatureVisible('audio', persona, { isAdmin });
  const canPresentation = isFeatureVisible('presentation', persona, { isAdmin });
  const canCv = isFeatureVisible('cv-builder', persona, { isAdmin });
  const canArticle = isFeatureVisible('article', persona, { isAdmin });

  // null = en cours de chargement ; [] = chargé (éventuellement vide ou en échec).
  const [convs, setConvs] = useState<ChatConversation[] | null>(null);
  const [attempts, setAttempts] = useState<EcosAttemptRow[] | null>(null);
  const [plans, setPlans] = useState<RevisionPlanListItem[] | null>(null);
  const [snapshot, setSnapshot] = useState<PlanSnapshot | null>(null);
  const [nextExam, setNextExam] = useState<NextExam | null>(null);
  const [docs, setDocs] = useState<DocumentAnalysisRow[] | null>(null);
  const [audios, setAudios] = useState<AudioDocumentRow[] | null>(null);
  const [decks, setDecks] = useState<TitledRow[] | null>(null);
  const [cvs, setCvs] = useState<TitledRow[] | null>(null);
  const [articles, setArticles] = useState<ArticleDocumentRow[] | null>(null);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    // Retour instantané : dernières données connues du même compte, puis
    // rafraîchissement réel en arrière-plan (les setters ci-dessous écrasent).
    const cached = freshDashboardCache(userId);
    if (cached) {
      if (cached.convs) setConvs(cached.convs);
      if (cached.attempts) setAttempts(cached.attempts);
      if (cached.plans) setPlans(cached.plans);
      setSnapshot(cached.snapshot);
      setNextExam(cached.nextExam);
      if (cached.docs) setDocs(cached.docs);
      if (cached.audios) setAudios(cached.audios);
      if (cached.decks) setDecks(cached.decks);
      if (cached.cvs) setCvs(cached.cvs);
      if (cached.articles) setArticles(cached.articles);
    }

    listConversations(userId)
      .then((rows) => {
        if (!alive) return;
        setConvs(rows);
        updateDashboardCache(userId, { convs: rows });
      })
      .catch(() => alive && setConvs((prev) => prev ?? []));

    if (canEcos) {
      listAttempts()
        .then((rows) => {
          if (!alive) return;
          setAttempts(rows);
          updateDashboardCache(userId, { attempts: rows });
        })
        .catch(() => alive && setAttempts((prev) => prev ?? []));
    } else {
      setAttempts([]);
    }

    if (canRevision) {
      (async () => {
        try {
          const rows = await listPlans();
          if (!alive) return;
          setPlans(rows);
          const today = todayISO();
          // Prochain objectif = le plan dont l'examen (à venir) est le plus proche.
          const upcoming = rows
            .filter((p) => p.exam_date >= today)
            .sort((a, b) => a.exam_date.localeCompare(b.exam_date))[0];
          if (!upcoming) {
            // Plus d'examen à venir : purger aussi un éventuel état issu du cache.
            setNextExam(null);
            setSnapshot(null);
            updateDashboardCache(userId, { plans: rows, snapshot: null, nextExam: null });
            return;
          }
          const exam: NextExam = {
            label:
              upcoming.exam_type !== 'custom'
                ? EXAM_LABELS[upcoming.exam_type]
                : `« ${truncateLabel(upcoming.title, 32)} »`,
            dateIso: upcoming.exam_date,
          };
          setNextExam(exam);
          const full = await getPlan(upcoming.id);
          if (!alive) return;
          const snap = full ? planSnapshot(full.plan, today) : null;
          setSnapshot(snap);
          updateDashboardCache(userId, { plans: rows, snapshot: snap, nextExam: exam });
        } catch {
          if (alive) setPlans((prev) => prev ?? []);
        }
      })();
    } else {
      setPlans([]);
    }

    // Activité des autres outils du rôle (D1) : selects légers fail-soft — un
    // échec laisse simplement la source vide, jamais la page cassée.
    const loadInto = <T,>(
      enabled: boolean,
      fetcher: () => Promise<T[]>,
      setter: (rows: T[]) => void,
      cacheKey: 'docs' | 'audios' | 'decks' | 'cvs' | 'articles',
    ) => {
      if (!enabled) {
        setter([]);
        return;
      }
      fetcher()
        .then((rows) => {
          if (!alive) return;
          setter(rows);
          updateDashboardCache(userId, { [cacheKey]: rows });
        })
        .catch(() => alive && setter([]));
    };

    loadInto(
      canDocument,
      () =>
        listRecentRows<DocumentAnalysisRow>(
          'document_analyses',
          'id, mode, source_name, created_at',
          'created_at',
        ),
      (rows) => setDocs(rows),
      'docs',
    );
    loadInto(
      canAudio,
      () => listRecentRows<AudioDocumentRow>('audio_documents', 'id, title, created_at', 'created_at'),
      (rows) => setAudios(rows),
      'audios',
    );
    loadInto(
      canPresentation,
      () => listRecentRows<TitledRow>('presentation_decks', 'id, title, updated_at', 'updated_at'),
      (rows) => setDecks(rows),
      'decks',
    );
    loadInto(
      canCv,
      () => listRecentRows<TitledRow>('cv_documents', 'id, title, updated_at', 'updated_at'),
      (rows) => setCvs(rows),
      'cvs',
    );
    loadInto(
      canArticle,
      () =>
        listRecentRows<ArticleDocumentRow>(
          'article_documents',
          'id, title, doc_type, updated_at',
          'updated_at',
        ),
      (rows) => setArticles(rows),
      'articles',
    );

    return () => {
      alive = false;
    };
  }, [userId, canEcos, canRevision, canDocument, canAudio, canPresentation, canCv, canArticle]);

  // Horloge vivante : salutation et horodatages relatifs (« Hier », « 18:20 »)
  // restent justes si l'onglet reste ouvert — tick chaque minute + retour de focus.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', tick);
      return () => {
        clearInterval(id);
        window.removeEventListener('focus', tick);
      };
    }
    return () => clearInterval(id);
  }, []);
  const activity = useMemo(
    () =>
      buildRecentActivity(
        {
          conversations: convs ?? undefined,
          ecosAttempts: attempts ?? undefined,
          revisionPlans: plans ?? undefined,
          documentAnalyses: docs ?? undefined,
          audioDocuments: audios ?? undefined,
          presentationDecks: decks ?? undefined,
          cvDocuments: cvs ?? undefined,
          articleDocuments: articles ?? undefined,
        },
        6,
      ),
    [convs, attempts, plans, docs, audios, decks, cvs, articles],
  );

  // Visiteur non connecté : la Vue d’ensemble n’existe pas (essai = chat seul).
  if (!loading && !session) return <Redirect href="/(chat)/chat" />;
  if (!user) return null;

  const tools = visibleFeatures(persona, { isAdmin });
  const activityLoading =
    convs === null ||
    (canEcos && attempts === null) ||
    (canRevision && plans === null) ||
    (canDocument && docs === null) ||
    (canAudio && audios === null) ||
    (canPresentation && decks === null) ||
    (canCv && cvs === null) ||
    (canArticle && articles === null);

  const canSwitchChatbots = isAdmin || persona === 'student' || persona === 'professional';
  const firstName = personalInfo?.firstName?.trim() || null;
  const greeting = `${greetingWord(now.getHours())}${firstName ? ` ${firstName}` : ''} · Semaine ${isoWeekNumber(now)}`;

  const subtitle = heroSummary({
    todayMinutes: snapshot ? snapshot.todayMinutes : null,
    lastEcosTitle: attempts?.[0]?.case_title ?? null,
    lastConversationTitle: convs?.[0]?.title ?? null,
  });

  const tiles: Array<{ label: string; value: string }> = snapshot
    ? [
        {
          label: 'Charge prévue',
          value: snapshot.todayMinutes > 0 ? formatMinutes(snapshot.todayMinutes) : 'Libre',
        },
        { label: 'Risque planning', value: RISK_LABEL[snapshot.riskLevel] },
        { label: 'Prochain examen', value: `J-${snapshot.daysLeft}` },
      ]
    : [
        { label: 'Conversations', value: convs ? String(convs.length) : '—' },
        {
          label: 'Dernière activité',
          value: activity[0] ? relativeLabel(activity[0].timestamp, now) : '—',
        },
        // Donnée réelle (7 derniers jours) — jamais une constante décorative.
        {
          label: 'Cette semaine',
          value: convs ? String(conversationsThisWeek(convs, now)) : '—',
        },
      ];

  const secondTool = tools.find((t) => t.id !== 'chat');
  const primaryCta = snapshot
    ? { label: 'Reprendre ma journée', route: '/(chat)/revision' }
    : { label: 'Demander à MedInfo', route: '/(chat)/chat' };
  const secondaryCta = snapshot
    ? { label: 'Demander à MedInfo', route: '/(chat)/chat' }
    : secondTool
      ? { label: TOOL_CTA_LABEL[secondTool.id] ?? secondTool.label, route: secondTool.route }
      : { label: 'Mon compte', route: '/(account)/account' };

  const desktopShell = Platform.OS === 'web' && width >= SHELL_BREAKPOINT;
  const wide = Platform.OS === 'web' && width >= 1180;

  return (
    <View style={styles.screen}>
      <SeoHead title="Vue d’ensemble" path="/dashboard" noindex />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: desktopShell ? tokens.space.xl : Math.max(insets.top, tokens.space.lg) + tokens.space.sm },
        ]}
      >
        <View style={[styles.columns, wide && styles.columnsWide]}>
          {/* ── Colonne principale ── */}
          <View style={styles.mainColumn}>
            {/* Hero « Qu’est-ce qui compte aujourd’hui ? » */}
            <View style={styles.hero}>
              {/* Grille millimétrée + tracé ECG animé (motif métier du design system,
                  coupé sous prefers-reduced-motion) — cf. src/ui/HeroBackdrop. */}
              <HeroBackdrop />
              <View style={styles.greetingPill}>
                <Text style={styles.greetingText}>{greeting}</Text>
              </View>
              <Text style={styles.heroTitle} accessibilityRole="header">
                Qu’est-ce qui compte aujourd’hui ?
              </Text>
              <Text style={styles.heroSubtitle}>{subtitle}</Text>
              <View style={styles.heroActions}>
                <Button
                  label={primaryCta.label}
                  variant="inverse"
                  fullWidth={false}
                  onPress={() => router.push(primaryCta.route as never)}
                />
                <Button
                  label={secondaryCta.label}
                  variant="outlineLight"
                  fullWidth={false}
                  onPress={() => router.push(secondaryCta.route as never)}
                />
              </View>
              <View style={styles.tileRow}>
                {tiles.map((tile) => (
                  <View key={tile.label} style={styles.tile}>
                    <Text style={styles.tileLabel}>{tile.label}</Text>
                    <Text style={styles.tileValue} numberOfLines={1}>
                      {tile.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Grille des outils du rôle */}
            <View style={styles.toolsHead}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Mes outils
              </Text>
              <Text style={styles.sectionSubtitle}>
                Tout ce que ton rôle débloque, au même endroit.
              </Text>
            </View>
            {/* Accès direct aux 3 chatbots (comptes étudiant/pro/admin) — le
                deep-link ?bot= est géré par app/(chat)/chat.tsx, autorisation
                réelle inchangée côté serveur (allowedChatbotsFor). */}
            {canSwitchChatbots ? (
              <View style={styles.chatbotRow}>
                {(['public', 'student', 'professional'] as ChatbotId[]).map((id) => {
                  const meta = CHATBOT_META[id];
                  return (
                    <Pressable
                      key={id}
                      onPress={() => router.push(`/(chat)/chat?bot=${id}` as never)}
                      accessibilityRole="link"
                      accessibilityLabel={`Ouvrir le chat ${meta.label}`}
                      style={({ hovered }: { hovered?: boolean }) => [
                        styles.chatbotChip,
                        hovered && styles.chatbotChipHovered,
                      ]}
                    >
                      <Icon name={meta.icon} size={15} color={tokens.colors.accentDeep} />
                      <Text style={styles.chatbotChipText}>Chat {meta.shortLabel.toLowerCase()}</Text>
                      <Icon name="arrowRight" size={13} color={tokens.colors.textMuted} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <View style={styles.toolsGrid}>
              {tools.map((tool) => {
                const tint = featureTint(tool.id);
                return (
                  <Pressable
                    key={tool.id}
                    onPress={() => router.push(tool.route as never)}
                    accessibilityRole="link"
                    accessibilityLabel={tool.label}
                    style={({ hovered }: { hovered?: boolean }) => [
                      styles.toolCard,
                      hovered && styles.toolCardHovered,
                    ]}
                  >
                    <View style={[styles.toolChip, { backgroundColor: tint.bg }]}>
                      <Icon name={tool.icon} size={20} color={tint.fg} />
                    </View>
                    <Text style={styles.toolTitle}>{tool.label}</Text>
                    <Text style={styles.toolDescription} numberOfLines={2}>
                      {tool.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Rail droit ── */}
          <View style={[styles.rail, wide && styles.railWide]}>
            {snapshot && nextExam ? (
              <View style={styles.railCard}>
                <View style={styles.railPill}>
                  <Text style={styles.railPillText}>Prochain objectif</Text>
                </View>
                <View style={styles.objectiveRow}>
                  <Text style={styles.objectiveNumber}>{snapshot.daysLeft}</Text>
                  <View style={styles.objectiveMeta}>
                    <Text style={styles.objectiveLabel}>jours avant {nextExam.label}</Text>
                    <Text style={styles.objectiveDate}>{shortDateLabel(nextExam.dateIso)}</Text>
                  </View>
                </View>
                <View
                  style={styles.progressTrack}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: snapshot.progressPercent }}
                >
                  <View style={[styles.progressFill, { width: `${snapshot.progressPercent}%` }]} />
                </View>
                <Text style={styles.objectiveCaption}>
                  {snapshot.progressPercent} % du programme accompli · risque{' '}
                  {RISK_LABEL[snapshot.riskLevel].toLowerCase()}
                </Text>
                <Button
                  label="Voir mon planning"
                  variant="secondary"
                  onPress={() => router.push('/(chat)/revision' as never)}
                />
              </View>
            ) : (
              <View style={styles.railCard}>
                <View style={styles.railPill}>
                  <Text style={styles.railPillText}>Raccourcis</Text>
                </View>
                {[
                  {
                    key: 'chat',
                    label: 'Nouvelle conversation',
                    icon: 'messageCircle' as const,
                    route: '/(chat)/chat',
                  },
                  ...(canRevision
                    ? [
                        {
                          key: 'revision',
                          label: 'Créer mon plan de révision',
                          icon: 'calendarCheck' as const,
                          route: '/(chat)/revision',
                        },
                      ]
                    : []),
                  {
                    key: 'account',
                    label: 'Compléter mon profil',
                    icon: 'userRound' as const,
                    route: '/(account)/account',
                  },
                ].map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => router.push(item.route as never)}
                    accessibilityRole="link"
                    style={({ hovered }: { hovered?: boolean }) => [
                      styles.shortcutRow,
                      hovered && styles.shortcutRowHovered,
                    ]}
                  >
                    <View style={styles.shortcutIcon}>
                      <Icon name={item.icon} size={16} color={tokens.colors.accentDeep} />
                    </View>
                    <Text style={styles.shortcutLabel}>{item.label}</Text>
                    <Icon name="arrowRight" size={14} color={tokens.colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.railCard}>
              <Text style={styles.railTitle} accessibilityRole="header">
                Activité récente
              </Text>
              {activityLoading ? (
                <View style={styles.activitySkeletons}>
                  <Skeleton height={38} radius={tokens.radius.md} />
                  <Skeleton height={38} radius={tokens.radius.md} />
                  <Skeleton height={38} radius={tokens.radius.md} />
                </View>
              ) : activity.length === 0 ? (
                <Text style={styles.emptyText}>
                  Ton activité apparaîtra ici dès ta première conversation ou ton premier outil
                  utilisé.
                </Text>
              ) : (
                activity.map((entry, i) => {
                  const tint = featureTint(entry.feature);
                  const meta = getFeatureMeta(entry.feature);
                  return (
                    <Pressable
                      key={entry.key}
                      onPress={() => router.push(entry.route as never)}
                      accessibilityRole="link"
                      style={({ hovered }: { hovered?: boolean }) => [
                        styles.activityRow,
                        i > 0 && styles.activityRowDivided,
                        hovered && styles.shortcutRowHovered,
                      ]}
                    >
                      <View style={[styles.activityChip, { backgroundColor: tint.bg }]}>
                        <Icon name={meta?.icon ?? 'messageCircle'} size={15} color={tint.fg} />
                      </View>
                      <View style={styles.activityText}>
                        <Text style={styles.activityTitle} numberOfLines={1}>
                          {entry.title}
                        </Text>
                        {entry.detail ? (
                          <Text style={styles.activityDetail} numberOfLines={1}>
                            {entry.detail}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.activityTime}>{relativeLabel(entry.timestamp, now)}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space['3xl'],
  },
  columns: {
    width: '100%',
    maxWidth: 1160,
    gap: tokens.space.xl,
  },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 1, minWidth: 0, gap: tokens.space.lg },

  // ── Hero ──
  hero: {
    backgroundColor: tokens.colors.accentDarker,
    borderRadius: tokens.radius.xl,
    padding: tokens.space.xl,
    gap: tokens.space.md,
    overflow: 'hidden',
    ...tokens.elevation.lg,
  },
  greetingPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  greetingText: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.88)',
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  heroTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.h1.fontSize,
    lineHeight: tokens.type.h1.lineHeight,
    letterSpacing: tokens.type.h1.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  heroSubtitle: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.82)',
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    maxWidth: 560,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
    marginTop: tokens.space.xs,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
    marginTop: tokens.space.sm,
  },
  tile: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    gap: 2,
  },
  tileLabel: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.62)',
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  tileValue: {
    fontFamily: tokens.font.display,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    fontWeight: tokens.weight.bold,
  },

  // ── Outils ──
  toolsHead: { gap: 2, marginTop: tokens.space.sm },
  sectionTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  sectionSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
  },
  // Rangée d'accès direct aux 3 chatbots (étudiant / pro / admin).
  chatbotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
  },
  chatbotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
  },
  chatbotChipHovered: {
    borderColor: tokens.colors.borderStrong,
    transform: [{ translateY: -1 }],
    ...tokens.elevation.md,
  },
  chatbotChipText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  toolCard: {
    flexGrow: 1,
    flexBasis: 220,
    maxWidth: '100%',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
  },
  toolCardHovered: {
    borderColor: tokens.colors.borderStrong,
    transform: [{ translateY: -1 }],
    ...tokens.elevation.md,
  },
  toolChip: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
  },
  toolDescription: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
  },

  // ── Rail droit ──
  rail: { gap: tokens.space.lg },
  railWide: { width: 330 },
  railCard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.lg,
    gap: tokens.space.md,
    ...tokens.elevation.sm,
  },
  railPill: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.accentSurface,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  railPillText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  railTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.space.md,
  },
  objectiveNumber: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  objectiveMeta: { flex: 1, gap: 1, paddingBottom: tokens.space.xs },
  objectiveLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  objectiveDate: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  progressTrack: {
    height: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurfaceStrong,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accent,
  },
  objectiveCaption: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.md,
    ...tokens.motion.transitionWeb,
  },
  shortcutRowHovered: { backgroundColor: tokens.colors.surfaceHover },
  shortcutIcon: {
    width: 30,
    height: 30,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  activitySkeletons: { gap: tokens.space.sm },
  emptyText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.sm + 2,
    borderRadius: tokens.radius.md,
  },
  activityRowDivided: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  activityChip: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: { flex: 1, gap: 1, minWidth: 0 },
  activityTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  activityDetail: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  activityTime: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
  },
});
