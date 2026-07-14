/**
 * Écran chat (refonte 2026-06) — streaming AI SDK v6 + rendu interactif des prompts v3.
 *
 *  - 3 chatbots (grand public / étudiant / professionnel) avec switch pour les comptes
 *    étudiant, pro et admin (autorisation réelle côté serveur, /api/chat).
 *  - Réponses parsées (src/ai/chat/parseAssistantMessage) : sources cliquables + badges,
 *    boutons d'approfondissement, formulaire QUESTIONS_PATIENT, boutons INTERACTION,
 *    auto-réflexion repliable, scores cliniques.
 *  - Historique des conversations (Supabase own-row) avec titre + catégorie générés
 *    par IA (/api/chat-meta, défaut Gemini 2.5 Flash).
 *  - Export PDF de la conversation.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isTextUIPart } from 'ai';
import type { UIMessage } from 'ai';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import type { ChatbotId } from '@/ai/chat/chatContext';
import {
  assistantTextForExport,
  parseAssistantMessage,
  type ParsedSource,
} from '@/ai/chat/parseAssistantMessage';
import {
  STARTER_SUGGESTIONS,
  SUGGESTIONS_ROTATION_MS,
  suggestionWindow,
} from '@/ai/chat/starterSuggestions';
import { isGuestMessageUsed, markGuestMessageUsed } from '@/chat/guestTrial';
import {
  createConversation,
  deleteConversation,
  generateConversationMeta,
  listConversations,
  loadMessages,
  saveMessage,
  type ChatConversation,
} from '@/chat/history';
import { exportChatToPdf } from '@/chat/exportChatPdf';
import { PAGE_SEO, breadcrumbJsonLd, webApplicationJsonLd } from '@/seo/meta';
import { SeoHead } from '@/ui/SeoHead';
import { tokens } from '@/ui/tokens';
import { DictationButton } from '@/ui/DictationButton';
import { ToolsMenu } from '@/ui/ToolsMenu';
import { Icon } from '@/ui/icons';
import { Reveal } from '@/ui/Reveal';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { AssistantBlocks, SourcesBlock } from '@/ui/chat/AssistantBlocks';
import { ChatbotSwitcher, CHATBOT_META } from '@/ui/chat/ChatbotSwitcher';
import { HistoryPanel } from '@/ui/chat/HistoryPanel';
import { SourceDetailModal } from '@/ui/chat/SourceDetailModal';

// Suggestions d'amorce (état vide) : 50 questions par chatbot, rotation 3 par 3
// toutes les 30 s — voir src/ai/chat/starterSuggestions.ts.

const DISCLAIMER: Record<ChatbotId, string> = {
  public: 'Information générale — ne remplace pas un avis médical individuel.',
  student: 'Support de révision — ne remplace pas les référentiels ni la pratique encadrée.',
  professional: "Outil d'aide à la décision — la décision finale appartient au clinicien.",
};

// Sur desktop (pointeur précis), Entrée envoie le message et Maj+Entrée insère un
// retour à la ligne — le standard des chats (ChatGPT, Claude). Sur mobile/tactile,
// Entrée garde son rôle de retour à la ligne (l'envoi passe par le bouton).
const ENTER_SENDS =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: fine)').matches;

// Copie d'une réponse : presse-papiers web uniquement (l'app est web-first).
const CAN_COPY =
  Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;

// ── Indicateur de statut (réflexion / recherche de sources / rédaction) ──────────

function PulsingDots() {
  const reduced = useReducedMotion();
  const d0 = useRef(new Animated.Value(0.45)).current;
  const d1 = useRef(new Animated.Value(0.45)).current;
  const d2 = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (reduced) return;
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.45, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
    const anims = [pulse(d0, 0), pulse(d1, 140), pulse(d2, 280)];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [reduced, d0, d1, d2]);

  return (
    <View style={styles.typingRow}>
      {[d0, d1, d2].map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0.45, 1], outputRange: [1, -2] }) }] }]}
        />
      ))}
    </View>
  );
}

type ChatPhase = 'thinking' | 'searching' | 'writing' | 'recovering';

/**
 * Bulle de statut affichée tant que la réponse n'a pas commencé à s'écrire : rassure
 * l'utilisateur que ça charge (réflexion, puis recherche de sources le cas échéant).
 */
function StatusBubble({ phase, toolLabel }: { phase: ChatPhase; toolLabel?: string | null }) {
  const label =
    phase === 'searching'
      ? (toolLabel ?? 'Recherche de sources fiables…')
      : phase === 'writing'
        ? 'Rédaction de la réponse…'
        : phase === 'recovering'
          ? 'Récupération de la réponse…'
          : 'MedInfo réfléchit…';
  const icon =
    phase === 'searching' ? 'search' : phase === 'writing' ? 'sparkles' : phase === 'recovering' ? 'clock' : 'brain';
  return (
    <View style={styles.statusPill} accessibilityLabel={label}>
      <View style={styles.statusIconWrap}>
        <Icon name={icon} size={16} color={tokens.colors.accent} />
      </View>
      <Text style={styles.statusText}>{label}</Text>
      <PulsingDots />
    </View>
  );
}

// ── Message ────────────────────────────────────────────────────────────────────

function messageText(message: UIMessage): string {
  return (message.parts ?? []).filter(isTextUIPart).map((p) => p.text).join('');
}

/**
 * Actions discrètes sous une réponse terminée (copie, régénération de la dernière) —
 * le motif des chats de référence (ChatGPT, Claude) : accessibles sans encombrer le fil.
 */
function MessageActions({
  text,
  showRegenerate,
  onRegenerate,
}: {
  text: string;
  showRegenerate: boolean;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nettoie le minuteur « Copié » si le message est démonté avant la fin du délai.
  useEffect(
    () => () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    [],
  );
  if (!CAN_COPY && !showRegenerate) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // presse-papiers indisponible : rien à faire, la sélection manuelle reste possible
    }
  };

  return (
    <View style={styles.messageActions}>
      {CAN_COPY ? (
        <TouchableOpacity
          style={styles.messageActionButton}
          onPress={() => void copy()}
          accessibilityRole="button"
          accessibilityLabel="Copier la réponse"
        >
          <Icon
            name={copied ? 'check' : 'copy'}
            size={14}
            color={copied ? tokens.colors.success : tokens.colors.textMuted}
          />
          <Text style={[styles.messageActionText, copied && styles.messageActionTextDone]}>
            {copied ? 'Copié' : 'Copier'}
          </Text>
        </TouchableOpacity>
      ) : null}
      {showRegenerate && onRegenerate ? (
        <TouchableOpacity
          style={styles.messageActionButton}
          onPress={onRegenerate}
          accessibilityRole="button"
          accessibilityLabel="Régénérer la réponse"
        >
          <Icon name="refresh" size={14} color={tokens.colors.textMuted} />
          <Text style={styles.messageActionText}>Régénérer</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Un tour de conversation : question de l'utilisateur en bulle accent à droite,
 * réponse de l'assistant posée pleine largeur sur le fond (contenu d'abord, comme
 * ChatGPT / OpenEvidence) — les blocs internes (sources, propositions) gardent
 * leurs propres cartes.
 */
function MessageRow({
  message,
  onSend,
  disabled,
  onOpenSource,
  isLastAssistant,
  onRegenerate,
}: {
  message: UIMessage;
  onSend: (text: string) => void;
  disabled: boolean;
  onOpenSource: (s: ParsedSource) => void;
  isLastAssistant: boolean;
  onRegenerate: () => void;
}) {
  const isUser = message.role === 'user';
  const text = messageText(message);
  if (!text.trim()) return null;

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.bubbleUser}>
          <Text style={styles.textUser}>{text}</Text>
        </View>
      </View>
    );
  }
  const streamingThisMessage = disabled && isLastAssistant;
  return (
    <View style={styles.assistantRow}>
      <AssistantBlocks text={text} onSend={onSend} disabled={disabled} onOpenSource={onOpenSource} />
      {!streamingThisMessage ? (
        <MessageActions
          // Copier colle la version « texte propre » (références en exposant, légende
          // des sources) — jamais les marqueurs techniques SRCn:: / INTERACTION / CALC.
          text={assistantTextForExport(text)}
          showRegenerate={isLastAssistant && !disabled}
          onRegenerate={onRegenerate}
        />
      ) : null}
    </View>
  );
}

/** A-t-on un appel d'outil (recherche web) en cours dans le dernier message assistant ? */
function hasToolActivity(message: UIMessage | undefined): boolean {
  if (!message) return false;
  return (message.parts ?? []).some((p) => {
    const t = (p as { type?: string }).type ?? '';
    return t.startsWith('tool-') || t === 'dynamic-tool';
  });
}

// Libellés de statut par outil du workflow agents (ADR-0030) : l'utilisateur voit ce que
// l'assistant est en train de déléguer (littérature, essais cliniques, vérif des liens).
const TOOL_STATUS_LABELS: Record<string, string> = {
  europe_pmc_search: 'Recherche dans la littérature scientifique…',
  europe_pmc_article: 'Lecture des études retenues…',
  clinical_trials_search: "Recherche d'essais cliniques…",
  verify_source_links: 'Vérification des liens sources…',
  pubmed_search: 'Recherche PubMed (sous-agent)…',
  web_search: 'Recherche de sources fiables…',
  google_search: 'Recherche de sources fiables…',
};

/** Compacte un texte d'appel d'outil pour la bulle de statut (une ligne courte). */
function truncateStatusDetail(text: string, max = 64): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Libellé dynamique depuis les arguments de l'appel d'outil (latence perçue, 2026-07) :
 * montrer le travail documentaire réel — titre de l'article lu, requête cherchée, nombre
 * de liens vérifiés — rend l'attente légitime. Arguments potentiellement partiels pendant
 * le streaming → repli systématique sur le libellé générique de l'outil.
 */
function toolLabelWithDetail(name: string, input: unknown): string {
  const args = (input ?? null) as
    | { query?: unknown; title?: unknown; urls?: unknown }
    | null;
  if (name === 'europe_pmc_article' && typeof args?.title === 'string' && args.title.trim()) {
    return `Lecture : « ${truncateStatusDetail(args.title)} »`;
  }
  if (
    (name === 'europe_pmc_search' || name === 'clinical_trials_search') &&
    typeof args?.query === 'string' &&
    args.query.trim()
  ) {
    const prefix = name === 'clinical_trials_search' ? 'Essais cliniques' : 'Littérature';
    return `${prefix} : « ${truncateStatusDetail(args.query)} »`;
  }
  if (name === 'verify_source_links' && Array.isArray(args?.urls) && args.urls.length > 0) {
    const n = args.urls.length;
    return `Vérification de ${n} lien${n > 1 ? 's' : ''} sources…`;
  }
  return TOOL_STATUS_LABELS[name] ?? 'Recherche de sources fiables…';
}

/** Libellé du DERNIER outil appelé dans le message assistant en cours, sinon null. */
function activeToolLabel(message: UIMessage | undefined): string | null {
  const parts = message?.parts ?? [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i] as { type?: string; toolName?: string; input?: unknown };
    const t = p.type ?? '';
    const name = t === 'dynamic-tool' ? p.toolName : t.startsWith('tool-') ? t.slice(5) : null;
    if (name) return toolLabelWithDetail(name, p.input);
  }
  return null;
}

// ── Écran principal ────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { user, session, persona, personalInfo, loading: authLoading } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAdmin = user ? isAdminUserId(user.id) : false;

  // Essai sans inscription (2026-06) : un visiteur non connecté découvre les 3 onglets
  // de chatbot et dispose d'UN message gratuit (indicateur 1/1 → 0/1), puis l'UI
  // propose inscription / connexion. Verrou serveur correspondant dans /api/chat.
  const isGuest = !authLoading && !session;
  const [guestUsed, setGuestUsed] = useState(false);
  useEffect(() => {
    if (isGuest) setGuestUsed(isGuestMessageUsed());
  }, [isGuest]);
  const guestLocked = isGuest && guestUsed;

  const canSwitch = isAdmin || persona === 'student' || persona === 'professional';
  const availableChatbots: ChatbotId[] =
    canSwitch || isGuest ? ['public', 'student', 'professional'] : ['public'];
  const defaultChatbot: ChatbotId =
    persona === 'student' || persona === 'professional' ? persona : 'public';

  const [chatbot, setChatbot] = useState<ChatbotId>(defaultChatbot);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [detailSource, setDetailSource] = useState<ParsedSource | null>(null);

  // Le profil charge après le premier rendu : aligne le chatbot par défaut une fois connu.
  // Un paramètre ?bot=… (cartes de l'accueil) prime s'il est autorisé pour ce compte.
  const { bot, conversation: conversationParam } = useLocalSearchParams<{
    bot?: string;
    conversation?: string;
  }>();
  const personaInitialized = useRef(false);
  // Dernière valeur de ?bot= déjà appliquée : chaque valeur du paramètre ne bascule
  // le chatbot qu'une fois (un switch manuel ultérieur ne doit pas être écrasé).
  const appliedBotParamRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if ((persona || isGuest) && !personaInitialized.current) {
      personaInitialized.current = true;
      appliedBotParamRef.current = bot;
      const requested = bot as ChatbotId | undefined;
      const allowed = isGuest || isAdmin || persona === 'student' || persona === 'professional'
        ? (['public', 'student', 'professional'] as ChatbotId[])
        : (['public'] as ChatbotId[]);
      setChatbot(requested && allowed.includes(requested) ? requested : defaultChatbot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, isGuest, bot]);

  // Refs lues par le transport et les callbacks (jamais d'état React capturé périmé).
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = session?.access_token ?? null;
  const chatbotRef = useRef<ChatbotId>(chatbot);
  chatbotRef.current = chatbot;
  const personalInfoRef = useRef(personalInfo);
  personalInfoRef.current = personalInfo;
  const conversationIdRef = useRef<string | null>(null);
  const titleGeneratedRef = useRef(false);
  const firstUserTextRef = useRef('');
  // Régénération en cours : le serveur REMPLACE alors la dernière réponse archivée
  // au lieu d'en ajouter une seconde (sinon la conversation rouverte montre les deux).
  const regenerateRef = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: (): Record<string, string> =>
          tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        body: () => ({
          chatbot: chatbotRef.current,
          personalInfo: personalInfoRef.current ?? undefined,
          // Résilience hors-ligne : le serveur archive la réponse dans cette conversation
          // même si la page est suspendue pendant le streaming (voir /api/chat).
          conversationId: conversationIdRef.current ?? undefined,
          regenerate: regenerateRef.current || undefined,
        }),
      }),
    [],
  );

  const refreshConversations = useCallback(async () => {
    if (!user) {
      setConversationsLoading(false);
      return;
    }
    setConversations(await listConversations(user.id));
    setConversationsLoading(false);
  }, [user]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  // Une réponse est-elle attendue (envoyée mais pas encore archivée/affichée en entier) ?
  // Sert à la reprise après suspension de la page (iOS coupe le flux quand on quitte Safari).
  const awaitingRef = useRef(false);

  const { messages, sendMessage, status, error, setMessages, regenerate, clearError, stop } = useChat({
    transport,
    onFinish: async ({ message }) => {
      awaitingRef.current = false;
      regenerateRef.current = false;
      const text = messageText(message);
      const convId = conversationIdRef.current;
      if (!convId || !user?.id || !text.trim()) return;
      // La réponse est archivée par le SERVEUR (/api/chat onFinish) — le client ne
      // sauvegarde plus que le titre/catégorie et rafraîchit la liste.
      if (!titleGeneratedRef.current && tokenRef.current) {
        titleGeneratedRef.current = true;
        await generateConversationMeta(convId, tokenRef.current, firstUserTextRef.current, text.slice(0, 1500));
      }
      void refreshConversations();
    },
  });

  const statusRef = useRef(status);
  statusRef.current = status;

  const isLoading = status === 'streaming' || status === 'submitted';
  const canSend = !isLoading && input.trim().length > 0 && !guestLocked;

  // ── Auto-scroll du fil (fluidité type ChatGPT) ─────────────────────────────────
  // Le fil suit la réponse pendant le streaming tant que l'utilisateur est en bas ;
  // s'il remonte pour relire, on arrête de suivre et un bouton « revenir en bas »
  // apparaît au-dessus du composer.
  const scrollRef = useRef<ScrollView>(null);
  const followRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const handleThreadScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distance = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const near = distance < 120;
    followRef.current = near;
    setAtBottom(near);
  }, []);

  const scrollToBottom = useCallback((animated = true) => {
    followRef.current = true;
    setAtBottom(true);
    scrollRef.current?.scrollToEnd({ animated });
  }, []);

  const handleThreadGrow = useCallback(() => {
    if (followRef.current) scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  // ── Reprise après coupure (page suspendue / réseau) ────────────────────────────
  // La génération continue côté serveur et la réponse est archivée dans l'historique :
  // on la récupère depuis Supabase au lieu de la perdre.
  const [recovering, setRecovering] = useState(false);
  // Arrêt volontaire pendant le streaming : note honnête « la réponse complète est
  // dans l'historique » (le serveur va au bout et archive — résilience hors-ligne).
  const [stoppedNotice, setStoppedNotice] = useState(false);

  const recoverFromHistory = useCallback(async (): Promise<boolean> => {
    const convId = conversationIdRef.current;
    if (!convId) return false;
    const stored = await loadMessages(convId);
    const last = stored[stored.length - 1];
    if (!last || last.role !== 'assistant') return false;
    setMessages(
      stored.map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: 'text' as const, text: m.content }],
      })),
    );
    clearError();
    awaitingRef.current = false;
    return true;
  }, [setMessages, clearError]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Poll l'historique (~1 min) : la génération serveur peut encore être en cours.
    const poll = async (attempt: number) => {
      if (cancelled || !awaitingRef.current) {
        setRecovering(false);
        return;
      }
      const busy = statusRef.current === 'streaming' || statusRef.current === 'submitted';
      if (!busy && (await recoverFromHistory())) {
        setRecovering(false);
        return;
      }
      if (attempt >= 15) {
        setRecovering(false);
        return;
      }
      timer = setTimeout(() => void poll(attempt + 1), 4000);
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!awaitingRef.current || !conversationIdRef.current) return;
      setRecovering(true);
      void poll(0);
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [recoverFromHistory]);

  // Réessayer après erreur : la réponse a pu aboutir côté serveur malgré la coupure —
  // on vérifie d'abord l'historique, sinon on renvoie la même requête (sans re-saisie).
  const handleRetry = useCallback(async () => {
    setRecovering(true);
    const recovered = await recoverFromHistory();
    setRecovering(false);
    if (recovered) return;
    clearError();
    awaitingRef.current = true;
    // Réessayer relance la même question : la réponse partielle éventuellement déjà
    // archivée doit être remplacée, pas doublée.
    regenerateRef.current = true;
    void regenerate();
  }, [recoverFromHistory, clearError, regenerate]);

  // Rotation des suggestions d'amorce : 3 questions à la fois, renouvelées toutes
  // les 30 s tant que l'état vide est affiché (50 questions par chatbot).
  const [suggestionTick, setSuggestionTick] = useState(0);
  const showEmptyState = messages.length === 0 && !isLoading;
  useEffect(() => {
    if (!showEmptyState) return;
    const id = setInterval(() => setSuggestionTick((t) => t + 1), SUGGESTIONS_ROTATION_MS);
    return () => clearInterval(id);
  }, [showEmptyState]);
  const starters = useMemo(
    () => suggestionWindow(STARTER_SUGGESTIONS[chatbot], suggestionTick),
    [chatbot, suggestionTick],
  );

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant'),
    [messages],
  );

  // ── Classification des erreurs serveur (au lieu d'une bannière générique) ──────
  // 401 `signup_required` : essai invité épuisé côté serveur (localStorage purgé…)
  // ou session expirée pour un compte connecté — deux parcours différents.
  const errorKind: 'guest' | 'session' | 'generic' | null = useMemo(() => {
    if (!error) return null;
    if (String(error.message ?? '').includes('signup_required')) {
      return isGuest ? 'guest' : 'session';
    }
    return 'generic';
  }, [error, isGuest]);

  // Refus serveur de l'essai invité → aligner l'indicateur client (0/1) : la carte
  // CTA inscription/connexion prend le relais de la bannière d'erreur.
  useEffect(() => {
    if (errorKind !== 'guest') return;
    markGuestMessageUsed();
    setGuestUsed(true);
    clearError();
  }, [errorKind, clearError]);

  // Sources de la dernière réponse (onglet global dans l'en-tête).
  const latestSources = useMemo(
    () => (lastAssistant ? parseAssistantMessage(messageText(lastAssistant)).sources : []),
    [lastAssistant],
  );

  // Phase de chargement : pendant l'attente (submitted) ou tant qu'aucun texte n'est encore
  // arrivé, on montre une bulle de statut (réflexion → recherche de sources → rédaction).
  const lastAssistantText = lastAssistant ? messageText(lastAssistant) : '';
  const showStatus =
    status === 'submitted' || (status === 'streaming' && lastAssistantText.trim().length === 0);
  const phase: ChatPhase =
    status === 'submitted'
      ? 'thinking'
      : hasToolActivity(lastAssistant)
        ? 'searching'
        : 'writing';

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Essai sans inscription : un seul message gratuit, l'indicateur passe à 0/1.
      if (isGuest) {
        if (guestUsed) return;
        markGuestMessageUsed();
        setGuestUsed(true);
      }

      // Historique : crée la conversation au premier message (comptes connectés).
      if (user && !conversationIdRef.current) {
        const id = await createConversation(user.id, chatbotRef.current);
        if (id) {
          conversationIdRef.current = id;
          setConversationId(id);
          titleGeneratedRef.current = false;
          firstUserTextRef.current = trimmed;
        }
      }
      if (user && conversationIdRef.current) {
        void saveMessage(conversationIdRef.current, user.id, 'user', trimmed);
      }
      awaitingRef.current = true;
      regenerateRef.current = false;
      setStoppedNotice(false);
      sendMessage({ text: trimmed });
      // Envoyer ramène toujours le fil en bas, même si on relisait plus haut.
      scrollToBottom();
    },
    [sendMessage, user, isGuest, guestUsed, scrollToBottom],
  );

  const handleSend = () => {
    if (!canSend) return;
    const text = input;
    setInput('');
    void sendText(text);
  };

  // Entrée = envoyer sur desktop (Maj+Entrée = nouvelle ligne) ; sans effet sur tactile.
  const handleInputKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (!ENTER_SENDS) return;
    const native = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
    const shift = native.shiftKey ?? (e as unknown as { shiftKey?: boolean }).shiftKey ?? false;
    if (native.key === 'Enter' && !shift) {
      (e as unknown as { preventDefault?: () => void }).preventDefault?.();
      handleSend();
    }
  };

  // Arrêt volontaire de la génération : on n'attend plus la réponse (pas de reprise
  // depuis l'historique) — le texte déjà écrit reste affiché. Le serveur, lui, mène
  // la génération au bout et l'archive : on le dit honnêtement (note sous le fil).
  const handleStop = () => {
    awaitingRef.current = false;
    if (user && conversationIdRef.current) setStoppedNotice(true);
    void stop();
  };

  const handleRegenerate = useCallback(() => {
    awaitingRef.current = true;
    regenerateRef.current = true;
    setStoppedNotice(false);
    void regenerate();
  }, [regenerate]);

  const startNewConversation = useCallback(
    (nextChatbot?: ChatbotId) => {
      // Une génération encore en cours ne doit pas continuer d'écrire dans le
      // nouveau fil, ni laisser la reprise hors-ligne armée sur l'ancien.
      if (statusRef.current === 'streaming' || statusRef.current === 'submitted') void stop();
      awaitingRef.current = false;
      regenerateRef.current = false;
      setStoppedNotice(false);
      setMessages([]);
      conversationIdRef.current = null;
      setConversationId(null);
      titleGeneratedRef.current = false;
      firstUserTextRef.current = '';
      setSourcesOpen(false);
      setHistoryOpen(false);
      if (nextChatbot) setChatbot(nextChatbot);
    },
    [setMessages, stop],
  );

  const handleSwitchChatbot = (next: ChatbotId) => {
    if (next === chatbot) return;
    // Changer de chatbot = changer d'interlocuteur : on repart sur une conversation propre.
    startNewConversation(next);
  };

  // Lien profond ?bot=… reçu alors que l'écran est déjà monté (menu Chatbots du header,
  // footer) : sans cet effet, le paramètre n'était lu qu'au premier rendu et le clic
  // ne faisait rien. Chaque nouvelle valeur est appliquée une seule fois.
  useEffect(() => {
    if (!personaInitialized.current || bot === appliedBotParamRef.current) return;
    appliedBotParamRef.current = bot;
    const requested = bot as ChatbotId | undefined;
    if (!requested || requested === chatbotRef.current) return;
    if (!availableChatbots.includes(requested)) return;
    startNewConversation(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot]);

  const openConversation = useCallback(
    async (c: ChatConversation) => {
      // Même garde que startNewConversation : le flux en cours ne doit pas venir
      // s'écrire dans la conversation qu'on ouvre.
      if (statusRef.current === 'streaming' || statusRef.current === 'submitted') void stop();
      awaitingRef.current = false;
      regenerateRef.current = false;
      setStoppedNotice(false);
      const stored = await loadMessages(c.id);
      setMessages(
        stored.map((m) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: 'text' as const, text: m.content }],
        })),
      );
      conversationIdRef.current = c.id;
      setConversationId(c.id);
      titleGeneratedRef.current = Boolean(c.title);
      firstUserTextRef.current = stored.find((m) => m.role === 'user')?.content ?? '';
      if (availableChatbots.includes(c.chatbot)) setChatbot(c.chatbot);
      setHistoryOpen(false);
    },
    [availableChatbots, setMessages, stop],
  );

  // Deep-link ?conversation=… (activité récente du dashboard) : rouvre la
  // conversation visée dès que la liste est chargée. Même patron que ?bot= :
  // chaque valeur n'est appliquée qu'une fois (une navigation manuelle ultérieure
  // dans l'historique ne doit pas être écrasée).
  const appliedConversationParamRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!conversationParam || conversationParam === appliedConversationParamRef.current) return;
    if (conversationsLoading) return;
    appliedConversationParamRef.current = conversationParam;
    const target = conversations.find((c) => c.id === conversationParam);
    if (target && target.id !== conversationIdRef.current) void openConversation(target);
  }, [conversationParam, conversationsLoading, conversations, openConversation]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (conversationIdRef.current === id) startNewConversation();
      void refreshConversations();
    },
    [refreshConversations, startNewConversation],
  );

  const handleExportPdf = () => {
    const conv = conversations.find((c) => c.id === conversationId);
    exportChatToPdf({
      title: conv?.title ?? 'Conversation MedInfo AI',
      chatbotLabel: CHATBOT_META[chatbot].label,
      messages: messages
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: messageText(m) }))
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim()),
    });
  };

  const meta = CHATBOT_META[chatbot];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <SeoHead
        title={PAGE_SEO.chat.title}
        description={PAGE_SEO.chat.description}
        path={PAGE_SEO.chat.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Chat santé IA', path: PAGE_SEO.chat.path },
          ]),
          webApplicationJsonLd({
            name: 'Chat santé IA — MedInfo AI',
            description: PAGE_SEO.chat.description,
            path: PAGE_SEO.chat.path,
          }),
        ]}
      />
      {/* ── En-tête ── */}
      <View style={[styles.chatHeader, { paddingTop: tokens.space.md + insets.top }]}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            Chat {meta.label.toLowerCase()}
          </Text>
          <Text style={styles.chatSubtitle} numberOfLines={1}>
            {meta.description}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {latestSources.length > 0 ? (
            <TouchableOpacity
              style={[styles.sourcesPill, sourcesOpen && styles.sourcesPillActive]}
              onPress={() => setSourcesOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={`Sources (${latestSources.length})`}
            >
              <Icon name="bookOpen" size={16} color={sourcesOpen ? tokens.colors.onAccent : tokens.colors.accentDeep} />
              <Text style={[styles.sourcesPillText, sourcesOpen && styles.sourcesPillTextActive]}>
                {latestSources.length}
              </Text>
            </TouchableOpacity>
          ) : null}
          {messages.length > 0 ? (
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleExportPdf}
              accessibilityRole="button"
              accessibilityLabel="Exporter la conversation en PDF"
            >
              <Icon name="download" size={17} color={tokens.colors.accentDeep} />
            </TouchableOpacity>
          ) : null}
          {user ? (
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setHistoryOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Historique des conversations"
            >
              <Icon name="clock" size={17} color={tokens.colors.accentDeep} />
            </TouchableOpacity>
          ) : null}
          {messages.length > 0 ? (
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => startNewConversation()}
              accessibilityRole="button"
              accessibilityLabel="Nouvelle conversation"
            >
              <Icon name="plus" size={18} color={tokens.colors.accentDeep} />
            </TouchableOpacity>
          ) : null}
          <ToolsMenu />
        </View>
      </View>

      {/* ── Switch de chatbot (étudiant / pro / admin) ── */}
      {availableChatbots.length > 1 ? (
        <View style={styles.switcherRow}>
          <ChatbotSwitcher
            chatbots={availableChatbots}
            value={chatbot}
            onChange={handleSwitchChatbot}
            disabled={isLoading}
          />
        </View>
      ) : null}

      {/* ── Bandeau essai sans inscription (1 message gratuit) ── */}
      {isGuest ? (
        <View style={styles.guestBanner}>
          <Icon name="sparkles" size={15} color={tokens.colors.accentDeep} />
          <Text style={styles.guestBannerText} numberOfLines={2}>
            {guestUsed
              ? 'Message d’essai utilisé — créez un compte gratuit pour continuer.'
              : 'Testez MedInfo AI : envoyez votre premier message sans inscription.'}
          </Text>
          <View style={[styles.guestBadge, guestUsed && styles.guestBadgeUsed]}>
            <Text style={[styles.guestBadgeText, guestUsed && styles.guestBadgeTextUsed]}>
              {guestUsed ? '0/1' : '1/1'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Onglet sources global ── */}
      {sourcesOpen && latestSources.length > 0 ? (
        <ScrollView style={styles.sourcesPane} contentContainerStyle={styles.sourcesPaneContent}>
          <SourcesBlock sources={latestSources} startOpen onOpenSource={setDetailSource} />
        </ScrollView>
      ) : null}

      <HistoryPanel
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversations={conversations}
        activeId={conversationId}
        onSelect={(c) => void openConversation(c)}
        onDelete={(id) => void handleDeleteConversation(id)}
        onNew={() => startNewConversation()}
        loading={conversationsLoading}
      />

      {/* ── Fil de messages ── */}
      <View style={styles.threadWrap}>
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={[styles.messagesContent, showEmptyState && styles.messagesContentEmpty]}
        onScroll={handleThreadScroll}
        scrollEventThrottle={80}
        onContentSizeChange={handleThreadGrow}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && !isLoading ? (
          <Reveal style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Icon name={meta.icon} size={30} color={tokens.colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>
              {personalInfo?.firstName
                ? `Bonjour ${personalInfo.firstName}, comment puis-je vous aider ?`
                : 'Posez votre première question'}
            </Text>
            <Text style={styles.emptyText}>{meta.description}.</Text>
            <View style={styles.starterColumn}>
              {starters.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.starterChip}
                  onPress={() => void sendText(s)}
                  disabled={guestLocked}
                  accessibilityRole="button"
                >
                  <Text style={styles.starterChipText}>{s}</Text>
                  <Icon name="arrowRight" size={14} color={tokens.colors.accent} />
                </TouchableOpacity>
              ))}
            </View>
          </Reveal>
        ) : null}

        {messages.map((m) => (
          <Reveal key={m.id}>
            <MessageRow
              message={m}
              onSend={(t) => void sendText(t)}
              disabled={isLoading}
              onOpenSource={setDetailSource}
              isLastAssistant={m.role === 'assistant' && m.id === lastAssistant?.id}
              onRegenerate={handleRegenerate}
            />
          </Reveal>
        ))}
        {(showStatus || recovering) && (
          <StatusBubble phase={recovering ? 'recovering' : phase} toolLabel={activeToolLabel(lastAssistant)} />
        )}

        {/* ── Proposition d'inscription / connexion en fin d'essai gratuit ── */}
        {guestLocked && !isLoading ? (
          <Reveal>
            <View style={styles.guestCtaCard}>
              <Text style={styles.guestCtaTitle}>Continuez la conversation</Text>
              <Text style={styles.guestCtaText}>
                Votre message d’essai gratuit a été utilisé (0/1). Créez un compte gratuit ou
                connectez-vous pour poser toutes vos questions, conserver cette réponse et
                retrouver tout votre historique.
              </Text>
              <View style={styles.guestCtaActions}>
                <TouchableOpacity
                  style={styles.guestCtaPrimary}
                  onPress={() => router.push('/(auth)/sign-in?mode=signup' as never)}
                  accessibilityRole="button"
                  accessibilityLabel="Créer un compte gratuit"
                >
                  <Text style={styles.guestCtaPrimaryText}>Créer un compte gratuit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.guestCtaSecondary}
                  onPress={() => router.push('/(auth)/sign-in' as never)}
                  accessibilityRole="button"
                  accessibilityLabel="Se connecter"
                >
                  <Text style={styles.guestCtaSecondaryText}>Se connecter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Reveal>
        ) : null}

        {/* ── Note honnête après un arrêt volontaire (le serveur archive la réponse
            complète — résilience hors-ligne) ── */}
        {stoppedNotice && !isLoading && !error ? (
          <View style={styles.stoppedNotice} accessibilityLiveRegion="polite">
            <Icon name="clock" size={14} color={tokens.colors.textMuted} />
            <Text style={styles.stoppedNoticeText}>
              Génération arrêtée — la réponse complète restera disponible dans l’historique.
            </Text>
          </View>
        ) : null}

        {error && !recovering && errorKind === 'session' && (
          <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>
              Votre session a expiré — reconnectez-vous pour continuer la conversation.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => router.push('/(auth)/sign-in' as never)}
              accessibilityRole="button"
              accessibilityLabel="Se reconnecter"
            >
              <Icon name="userRound" size={14} color={tokens.colors.onAccent} />
              <Text style={styles.retryButtonText}>Se reconnecter</Text>
            </TouchableOpacity>
          </View>
        )}
        {error && !recovering && errorKind === 'generic' && (
          <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>
              Une erreur est survenue — la réponse a peut-être été interrompue.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void handleRetry()}
              accessibilityRole="button"
              accessibilityLabel="Réessayer la dernière question"
            >
              <Icon name="refresh" size={14} color={tokens.colors.onAccent} />
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Bouton « revenir en bas » (fil remonté pendant/après une réponse) ── */}
      {!atBottom && !showEmptyState ? (
        <TouchableOpacity
          style={styles.scrollDownButton}
          onPress={() => scrollToBottom()}
          accessibilityRole="button"
          accessibilityLabel="Revenir en bas de la conversation"
        >
          <Icon name="chevronDown" size={18} color={tokens.colors.accentDeep} />
        </TouchableOpacity>
      ) : null}
      </View>

      {/* ── Composer (zone de saisie unifiée : texte + dictée + envoi/stop) ── */}
      <View style={[styles.composerZone, isGuest && { paddingBottom: tokens.space.sm + insets.bottom }]}>
        <View style={[styles.composer, inputFocused && styles.composerFocused]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={
              guestLocked
                ? 'Créez un compte gratuit pour continuer…'
                : chatbot === 'student'
                  ? 'Une notion, un item EDN, un mécanisme…'
                  : chatbot === 'professional'
                    ? 'Votre question clinique…'
                    : 'Posez une question sur la santé…'
            }
            placeholderTextColor={tokens.colors.textMuted}
            multiline
            editable={!guestLocked}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            onKeyPress={handleInputKeyPress}
          />
          <View style={styles.composerActions}>
            {!isGuest ? (
              <DictationButton
                onTranscript={(text) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
                disabled={isLoading}
              />
            ) : null}
            <View style={styles.composerSpacer} />
            {isLoading ? (
              <Pressable
                onPress={handleStop}
                accessibilityRole="button"
                accessibilityLabel="Arrêter la génération"
                style={({ pressed }: { pressed: boolean }) => [
                  styles.sendButton,
                  styles.stopButton,
                  pressed && styles.sendButtonPressed,
                ]}
              >
                <Icon name="stop" size={17} color={tokens.colors.onAccent} />
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Envoyer le message"
                style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
                  styles.sendButton,
                  !canSend && styles.sendButtonDisabled,
                  canSend && hovered && styles.sendButtonHover,
                  canSend && focused && styles.sendButtonFocus,
                  canSend && pressed && styles.sendButtonPressed,
                ]}
              >
                <Icon name="arrowUp" size={20} color={canSend ? tokens.colors.onAccent : tokens.colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
        <Text style={styles.disclaimer}>{DISCLAIMER[chatbot]}</Text>
      </View>

      <SourceDetailModal source={detailSource} onClose={() => setDetailSource(null)} />
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  headerTitleBlock: { flex: 1, flexShrink: 1, minWidth: 0, marginRight: tokens.space.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, flexShrink: 0 },
  headerIconButton: {
    width: tokens.size.iconButton,
    height: tokens.size.iconButton,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    ...tokens.motion.transitionWeb,
  },
  headerIconButtonActive: {
    backgroundColor: tokens.colors.accent,
    borderColor: tokens.colors.accent,
  },
  // Bouton Sources : pastille texte « livre + N » (plus lisible qu'un rond + badge).
  sourcesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: tokens.size.iconButton,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    ...tokens.motion.transitionWeb,
  },
  sourcesPillActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  sourcesPillText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
  },
  sourcesPillTextActive: { color: tokens.colors.onAccent },
  chatTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  chatSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginTop: 2,
  },
  switcherRow: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  // ── Essai sans inscription (bandeau + indicateur 1/1 → 0/1) ──
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.accentSurface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  guestBannerText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  guestBadge: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 3,
    backgroundColor: tokens.colors.accent,
  },
  guestBadgeUsed: { backgroundColor: tokens.colors.borderStrong },
  guestBadgeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
  },
  guestBadgeTextUsed: { color: tokens.colors.textSubtle },

  // ── Carte d'invitation inscription / connexion (fin d'essai) ──
  guestCtaCard: {
    alignSelf: 'stretch',
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    marginTop: tokens.space.sm,
  },
  guestCtaTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  guestCtaText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  guestCtaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
    marginTop: tokens.space.xs,
  },
  guestCtaPrimary: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm + 2,
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
  },
  guestCtaPrimaryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  guestCtaSecondary: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm + 2,
    ...tokens.motion.transitionWeb,
  },
  guestCtaSecondaryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },

  sourcesPane: {
    backgroundColor: tokens.colors.surfaceAlt,
    maxHeight: 360,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  sourcesPaneContent: { paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.sm },
  threadWrap: { flex: 1 },
  messages: { flex: 1 },
  // Colonne de lecture centrée (~800 px) : le fil reste lisible sur desktop au lieu
  // de s'étirer sur toute la largeur ; sans effet sur mobile.
  messagesContent: {
    padding: tokens.space.lg,
    gap: tokens.space.lg,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  // État vide : accroche + suggestions centrées verticalement (comme les chats de référence).
  messagesContentEmpty: { flexGrow: 1, justifyContent: 'center' },

  scrollDownButton: {
    position: 'absolute',
    bottom: tokens.space.md,
    alignSelf: 'center',
    width: 38,
    height: 38,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.elevation.md,
    ...tokens.motion.transitionWeb,
  },

  emptyState: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.xl,
    gap: tokens.space.sm,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.xs,
  },
  emptyTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    textAlign: 'center',
  },
  starterColumn: { gap: tokens.space.sm, marginTop: tokens.space.md, alignSelf: 'stretch' },
  starterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
  },
  starterChipText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 19,
  },

  // Question de l'utilisateur : bulle accent compacte à droite (repère visuel du tour).
  userRow: { alignItems: 'flex-end' },
  bubbleUser: {
    maxWidth: '85%',
    borderRadius: tokens.radius.xl,
    borderBottomRightRadius: tokens.radius.xs,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.accent,
    ...tokens.elevation.sm,
  },
  textUser: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },

  // Réponse assistant : posée pleine largeur sur le fond, sans bulle bordée —
  // le contenu (texte, sources, propositions) occupe l'espace de lecture.
  assistantRow: { alignSelf: 'stretch', gap: tokens.space.sm },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.lg,
  },
  messageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs + 2,
    paddingVertical: tokens.space.xs,
    ...tokens.motion.transitionWeb,
  },
  messageActionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  messageActionTextDone: { color: tokens.colors.success },

  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  statusIconWrap: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs + 2 },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.textMuted,
  },

  stoppedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  stoppedNoticeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },

  errorBanner: {
    backgroundColor: tokens.colors.dangerBackground,
    borderRadius: tokens.radius.md,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.danger,
    padding: tokens.space.lg,
  },
  errorText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.label.fontSize,
  },
  retryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    marginTop: tokens.space.md,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    ...tokens.motion.transitionWeb,
  },
  retryButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },

  // ── Composer unifié (motif ChatGPT/Claude : une carte, texte + actions) ──
  composerZone: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.xs,
    paddingBottom: tokens.space.sm,
    gap: tokens.space.xs + 2,
  },
  composer: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.sm,
    paddingTop: tokens.space.xs,
    paddingBottom: tokens.space.sm,
    gap: tokens.space.xs,
    ...tokens.elevation.md,
    ...tokens.motion.transitionWeb,
  },
  composerFocused: {
    borderColor: tokens.colors.accent,
    ...tokens.focus.ring,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.xs,
  },
  composerSpacer: { flex: 1 },
  input: {
    minHeight: 36,
    maxHeight: 140,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    color: tokens.colors.text,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    // Le focus est porté par la carte du composer, pas par le champ lui-même.
    ...(Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }) as object),
  },
  disclaimer: {
    fontFamily: tokens.font.sans,
    textAlign: 'center',
    fontSize: tokens.type.caption.fontSize,
    color: tokens.colors.textMuted,
    paddingHorizontal: tokens.space.lg,
  },
  sendButton: {
    width: tokens.size.controlMd,
    height: tokens.size.controlMd,
    borderRadius: tokens.radius.pill,
    // CTA principal du chat : même bleu électrique que les boutons primaires (2026-07).
    backgroundColor: tokens.colors.accentVivid,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
  },
  sendButtonHover: { backgroundColor: tokens.colors.accentVividStrong, transform: [{ translateY: -1 }], ...tokens.elevation.md },
  sendButtonFocus: tokens.focus.ring,
  sendButtonPressed: { transform: [{ scale: 0.94 }], opacity: 0.95 },
  sendButtonDisabled: {
    backgroundColor: tokens.colors.borderStrong,
    ...Platform.select({ web: { boxShadow: 'none' } as object, default: {} }),
  },
  // Pendant la génération, le bouton d'envoi devient un bouton d'arrêt (encre sombre).
  stopButton: { backgroundColor: tokens.colors.text },
});
