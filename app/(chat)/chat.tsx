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
  useWindowDimensions,
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
import { isFeatureVisible } from '@/ai/routing/featureVisibility';
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
  renameConversation,
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
import { QcmLauncher } from '@/ui/chat/QcmCard';
import { ChatbotSwitcher, CHATBOT_META } from '@/ui/chat/ChatbotSwitcher';
import { ConversationList, HistoryPanel } from '@/ui/chat/HistoryPanel';
import { CountrySelector } from '@/ui/chat/CountrySelector';
import { coerceCountry, type CountryCode } from '@/ai/chat/country';
import { ResponseControls } from '@/ui/chat/ResponseControls';
import { coerceResponseMode, type ResponseMode } from '@/ai/chat/responseMode';
import { summarizeChatProgress, type ChatProgressStep } from '@/ai/chat/progress';
import { coerceChatOutputTools, type ChatOutputTool } from '@/ai/chat/outputTools';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  type ChatAttachment,
} from '@/ai/chat/attachment';
import { SourceDetailModal } from '@/ui/chat/SourceDetailModal';
import { SHELL_BREAKPOINT } from '@/ui/shell/AppShell';

// Suggestions d'amorce (état vide) : 50 questions par chatbot, rotation 3 par 3
// toutes les 30 s — voir src/ai/chat/starterSuggestions.ts.

const DISCLAIMER: Record<ChatbotId, string> = {
  public: 'Information générale — ne remplace pas un avis médical individuel.',
  student: 'Support de révision — ne remplace pas les référentiels ni la pratique encadrée.',
  professional: "Outil d'aide à la décision — la décision finale appartient au clinicien.",
};

// Titre de l'état vide décliné par chatbot (le sous-titre vient de CHATBOT_META).
const EMPTY_TITLE: Record<ChatbotId, string> = {
  public: 'Posez votre question santé',
  student: 'Que veux-tu réviser aujourd’hui ?',
  professional: 'Quelle est votre question clinique ?',
};
const EMPTY_TITLE_NAMED: Record<ChatbotId, string> = {
  public: 'comment puis-je vous aider ?',
  student: 'que veux-tu réviser aujourd’hui ?',
  professional: 'quelle est votre question clinique ?',
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
    // Live region : les lecteurs d'écran sont informés des changements de phase
    // (réflexion → recherche de sources → rédaction) sans focus manuel.
    <View style={styles.statusPill} accessibilityLabel={label} accessibilityLiveRegion="polite">
      <View style={styles.statusIconWrap}>
        <Icon name={icon} size={16} color={tokens.colors.accent} />
      </View>
      <Text style={styles.statusText}>{label}</Text>
      <PulsingDots />
    </View>
  );
}

/**
 * Trace de progression du workflow evidence-first (latence PERÇUE, audit 2026-07, item H) :
 * au lieu d'une seule ligne qui « tourne », l'utilisateur voit les étapes déjà franchies
 * s'empiler (recherche → lecture → vérification), ce qui rend l'attente légitime et donne
 * un sentiment d'avancement. Données déjà présentes dans le flux (parts d'appel d'outil) —
 * aucun appel réseau ajouté. La phase en cours reste affichée par la bulle de statut.
 */
function ProgressTrace({ steps }: { steps: ChatProgressStep[] }) {
  if (steps.length === 0) return null;
  return (
    <View style={styles.progressTrace} accessibilityLabel="Étapes de recherche effectuées">
      {steps.map((s, i) => (
        <View key={`${s.tool}-${i}`} style={styles.progressRow}>
          <Icon name="check" size={12} color={tokens.colors.success} />
          <Text style={styles.progressText}>
            {s.label}
            {s.count > 1 ? ` (${s.count})` : ''}
          </Text>
        </View>
      ))}
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

/** Type MIME d'un fichier joint (déclaré par le navigateur, sinon déduit de l'extension). */
function guessAttachmentMediaType(name: string, declared: string): string {
  const clean = (declared || '').toLowerCase().split(';')[0].trim();
  if (clean) return clean;
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    md: 'text/markdown',
    csv: 'text/csv',
    txt: 'text/plain',
  };
  return map[ext] ?? '';
}

// ── Écran principal ────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { user, session, persona, personalInfo, loading: authLoading } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const isAdmin = user ? isAdminUserId(user.id) : false;

  // Desktop shell (≥ 1024 px, session) : l'historique devient une colonne
  // persistante à gauche du fil (motif ChatGPT/Claude) au lieu d'une modale.
  const desktopShell = Platform.OS === 'web' && width >= SHELL_BREAKPOINT && !!session;

  // Contrôles de réponse (profondeur + outils) : sur petit écran (mobile), on n'affiche
  // PAS la rangée segmentée au-dessus du composer — on la remplace par deux boutons-icônes
  // (🧠 profondeur + 🧰 outils) DANS la barre du composer, pour gagner de la hauteur de
  // chat (demande Hugo). Au-delà, la rangée complète a la place de s'afficher.
  const compactControls = width < 700;

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
  // Pièce jointe : réservée aux comptes vérifiés étudiant/pro (+ admin), web only
  // (extraction/lecture du fichier côté navigateur). Le serveur regarde la persona.
  const canAttach = Platform.OS === 'web' && !!session && canSwitch;
  const availableChatbots: ChatbotId[] =
    canSwitch || isGuest ? ['public', 'student', 'professional'] : ['public'];
  const defaultChatbot: ChatbotId =
    persona === 'student' || persona === 'professional' ? persona : 'public';

  const [chatbot, setChatbot] = useState<ChatbotId>(defaultChatbot);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // Desktop/grand écran : masquer la colonne d'historique pour gagner de la place
  // pendant la conversation (préférence persistée, web only).
  const [historyCollapsed, setHistoryCollapsed] = useState<boolean>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('medinfo:chatHistoryCollapsed') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('medinfo:chatHistoryCollapsed', historyCollapsed ? '1' : '0');
    } catch {
      // best-effort : la préférence n'est pas critique
    }
  }, [historyCollapsed]);
  // Pays d'exercice : oriente les sources privilégiées par l'assistant (envoyé dans
  // le body de /api/chat, persistance localStorage web only).
  const [country, setCountry] = useState<CountryCode | null>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    try {
      return coerceCountry(window.localStorage.getItem('medinfo:chatCountry'));
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !country) return;
    try {
      window.localStorage.setItem('medinfo:chatCountry', country);
    } catch {
      // best-effort
    }
  }, [country]);

  // Réglages de réponse (2026-07) : profondeur (rapide/classique/complexe) + outils de
  // sortie optionnels (diagramme, points clés, tableau comparatif). Envoyés dans le body
  // de /api/chat, persistés en localStorage (web only). Aucun droit : cf. serveur.
  const [responseMode, setResponseMode] = useState<ResponseMode>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return 'standard';
    try {
      return coerceResponseMode(window.localStorage.getItem('medinfo:chatResponseMode'));
    } catch {
      return 'standard';
    }
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('medinfo:chatResponseMode', responseMode);
    } catch {
      // best-effort
    }
  }, [responseMode]);

  const [outputTools, setOutputTools] = useState<ChatOutputTool[]>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
    try {
      return coerceChatOutputTools(JSON.parse(window.localStorage.getItem('medinfo:chatTools') ?? '[]'));
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('medinfo:chatTools', JSON.stringify(outputTools));
    } catch {
      // best-effort
    }
  }, [outputTools]);

  // Pièce jointe (document) — réservé aux comptes vérifiés étudiant/pro (+ admin), web only.
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [detailSource, setDetailSource] = useState<ParsedSource | null>(null);

  // Notice transitoire de bascule de chatbot (B4/B5) : dit ce qui vient de se
  // passer (fil précédent archivé, chatbot d'origine indisponible…), auto-effacée.
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);
  const switchNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSwitchNotice = useCallback((text: string, ms = 6000) => {
    setSwitchNotice(text);
    if (switchNoticeTimerRef.current) clearTimeout(switchNoticeTimerRef.current);
    switchNoticeTimerRef.current = setTimeout(() => setSwitchNotice(null), ms);
  }, []);
  useEffect(
    () => () => {
      if (switchNoticeTimerRef.current) clearTimeout(switchNoticeTimerRef.current);
    },
    [],
  );

  // Suggestion de l'outil Analyse de document (C4) : quand un utilisateur qui y a
  // droit colle un très long texte dans le chat public. Heuristique 100 % client.
  const [docHintDismissed, setDocHintDismissed] = useState(false);

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
  const countryRef = useRef(country);
  countryRef.current = country;
  const responseModeRef = useRef(responseMode);
  responseModeRef.current = responseMode;
  const outputToolsRef = useRef(outputTools);
  outputToolsRef.current = outputTools;
  const attachmentRef = useRef(attachment);
  attachmentRef.current = attachment;
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
          country: countryRef.current ?? undefined,
          responseMode: responseModeRef.current,
          tools: outputToolsRef.current.length > 0 ? outputToolsRef.current : undefined,
          attachment: attachmentRef.current ?? undefined,
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
  const canSend = !isLoading && (input.trim().length > 0 || !!attachment) && !guestLocked;

  // C4 : un long texte collé dans le chat public ressemble à un document (compte
  // rendu, ordonnance…) — l'outil Analyse de document est fait pour ça.
  const showDocHint =
    chatbot === 'public' &&
    !docHintDismissed &&
    isFeatureVisible('document', persona, { isAdmin }) &&
    !isGuest &&
    (input.length > 1500 || (input.match(/\n/g)?.length ?? 0) > 12);

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
  // Suspendue au survol/focus (E2 : le contenu ne change jamais sous le curseur)
  // et sous prefers-reduced-motion (contenu qui tourne = mouvement).
  const [suggestionTick, setSuggestionTick] = useState(0);
  const [suggestionsPaused, setSuggestionsPaused] = useState(false);
  const showEmptyState = messages.length === 0 && !isLoading;
  useEffect(() => {
    if (!showEmptyState || suggestionsPaused || reducedMotion) return;
    const id = setInterval(() => setSuggestionTick((t) => t + 1), SUGGESTIONS_ROTATION_MS);
    return () => clearInterval(id);
  }, [showEmptyState, suggestionsPaused, reducedMotion]);
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
      const att = attachmentRef.current;
      if (!trimmed && !att) return;
      // Marqueur visible/archivé de la pièce jointe ; le fichier lui-même part dans
      // le body (transitoire, jamais stocké).
      const displayText = att ? `${trimmed}${trimmed ? '\n\n' : ''}📎 ${att.name}` : trimmed;

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
          firstUserTextRef.current = displayText;
        }
      }
      if (user && conversationIdRef.current) {
        void saveMessage(conversationIdRef.current, user.id, 'user', displayText);
      }
      awaitingRef.current = true;
      regenerateRef.current = false;
      setStoppedNotice(false);
      sendMessage({ text: displayText });
      // La pièce jointe (lue par le transport ci-dessus) ne vaut que pour ce message.
      if (att) {
        setAttachment(null);
        setAttachError(null);
      }
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

  // Sélection d'un document (web only) : input DOM éphémère → lecture base64 côté client.
  // Le fichier ne quitte l'appareil qu'au moment de l'envoi (body de /api/chat) et n'est
  // jamais stocké côté serveur (seule la réponse est archivée).
  const pickAttachment = () => {
    if (typeof document === 'undefined') return;
    setAttachError(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ATTACHMENT_ACCEPT;
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > ATTACHMENT_MAX_BYTES) {
        setAttachError('Fichier trop volumineux (maximum 6 Mo).');
        return;
      }
      const mediaType = guessAttachmentMediaType(file.name, file.type);
      if (!mediaType) {
        setAttachError('Format non pris en charge (PDF, image ou texte).');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : '';
        if (!base64) {
          setAttachError('Lecture du fichier impossible.');
          return;
        }
        setAttachment({ name: file.name || 'Document', mediaType, dataBase64: base64 });
      };
      reader.onerror = () => setAttachError('Lecture du fichier impossible.');
      reader.readAsDataURL(file);
    };
    input.click();
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
    const hadThread = messages.length > 0;
    // Changer de chatbot = changer d'interlocuteur : on repart sur une conversation propre.
    startNewConversation(next);
    // B4 : dire ce qui vient de se passer au lieu d'un reset silencieux.
    if (hadThread) {
      showSwitchNotice(
        user
          ? `Conversation précédente enregistrée dans l’historique — nouveau fil ${CHATBOT_META[next].label.toLowerCase()}.`
          : `Nouveau fil ${CHATBOT_META[next].label.toLowerCase()}.`,
      );
    }
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
      if (availableChatbots.includes(c.chatbot)) {
        setChatbot(c.chatbot);
      } else {
        // B5 : conversation issue d'un chatbot que ce compte ne peut plus utiliser —
        // le dire, plutôt que de poursuivre silencieusement avec le chatbot courant.
        showSwitchNotice(
          `Cette conversation vient du chat ${CHATBOT_META[c.chatbot]?.label.toLowerCase() ?? c.chatbot}, non disponible avec votre rôle — la suite utilisera le chat ${CHATBOT_META[chatbotRef.current].label.toLowerCase()}.`,
          9000,
        );
      }
      setHistoryOpen(false);
    },
    [availableChatbots, setMessages, stop, showSwitchNotice],
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

  // Renommage manuel d'une conversation (E3) — le titre IA reste le défaut.
  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      await renameConversation(id, title);
      void refreshConversations();
    },
    [refreshConversations],
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
      <View style={styles.screenRow}>
      {/* ── Colonne d'historique persistante (desktop shell, D5) ── */}
      {desktopShell && user && !historyCollapsed ? (
        <View style={styles.historyRail}>
          <View style={styles.historyRailHeader}>
            <Icon name="clock" size={16} color={tokens.colors.accentDeep} />
            <Text style={styles.historyRailTitle}>Historique</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => setHistoryCollapsed(true)}
              accessibilityRole="button"
              accessibilityLabel="Masquer l’historique"
              style={styles.historyCollapseBtn}
            >
              <Icon name="panelLeft" size={16} color={tokens.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ConversationList
            conversations={conversations}
            activeId={conversationId}
            onSelect={(c) => void openConversation(c)}
            onDelete={(id) => void handleDeleteConversation(id)}
            onRename={(id, title) => void handleRenameConversation(id, title)}
            onNew={() => startNewConversation()}
            loading={conversationsLoading}
          />
        </View>
      ) : null}

      <View style={styles.screenMain}>
      {/* ── En-tête ── */}
      <View style={[styles.chatHeader, { paddingTop: tokens.space.md + insets.top }]}>
        {desktopShell && user && historyCollapsed ? (
          <TouchableOpacity
            onPress={() => setHistoryCollapsed(false)}
            accessibilityRole="button"
            accessibilityLabel="Afficher l’historique"
            style={[styles.headerIconButton, { marginRight: tokens.space.sm }]}
          >
            <Icon name="panelLeft" size={17} color={tokens.colors.accentDeep} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerTitleBlock}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            Chat {meta.label.toLowerCase()}
          </Text>
          <Text style={styles.chatSubtitle} numberOfLines={1}>
            {meta.description}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <CountrySelector value={country} onChange={setCountry} />
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
          {user && !desktopShell ? (
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

      {/* ── Notice transitoire de bascule (B4/B5) ── */}
      {switchNotice ? (
        <View style={styles.switchNotice} accessibilityLiveRegion="polite">
          <Icon name="check" size={13} color={tokens.colors.accentDeep} />
          <Text style={styles.switchNoticeText} numberOfLines={2}>
            {switchNotice}
          </Text>
        </View>
      ) : null}

      {/* ── Bandeau essai sans inscription (1 message gratuit) — masqué sur l'état
          vide, qui porte sa propre pastille d'essai (C3, hauteur mobile) ── */}
      {isGuest && !showEmptyState ? (
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

      {!desktopShell ? (
        <HistoryPanel
          visible={historyOpen}
          onClose={() => setHistoryOpen(false)}
          conversations={conversations}
          activeId={conversationId}
          onSelect={(c) => void openConversation(c)}
          onDelete={(id) => void handleDeleteConversation(id)}
          onRename={(id, title) => void handleRenameConversation(id, title)}
          onNew={() => startNewConversation()}
          loading={conversationsLoading}
        />
      ) : null}

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
                ? `Bonjour ${personalInfo.firstName}, ${EMPTY_TITLE_NAMED[chatbot]}`
                : EMPTY_TITLE[chatbot]}
            </Text>
            <Text style={styles.emptyText}>{meta.description}.</Text>
            {/* Pastille d'essai invité : remplace le bandeau du haut sur l'état vide. */}
            {isGuest ? (
              <View style={styles.trialPill}>
                <Icon name="sparkles" size={13} color={tokens.colors.accentDeep} />
                <Text style={styles.trialPillText}>
                  {guestUsed
                    ? 'Essai utilisé (0/1) : créez un compte gratuit pour continuer'
                    : 'Essai gratuit : 1 message sans inscription (1/1)'}
                </Text>
              </View>
            ) : null}
            {/* La rotation des suggestions se suspend au survol : le contenu ne
                change jamais sous le curseur au moment du clic. */}
            <Pressable
              style={styles.starterColumn}
              onHoverIn={() => setSuggestionsPaused(true)}
              onHoverOut={() => setSuggestionsPaused(false)}
            >
              {starters.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.starterChip, guestLocked && styles.starterChipDisabled]}
                  onPress={() => void sendText(s)}
                  disabled={guestLocked}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: guestLocked }}
                >
                  <Text style={styles.starterChipText}>{s}</Text>
                  <Icon name="arrowRight" size={14} color={tokens.colors.accent} />
                </TouchableOpacity>
              ))}
            </Pressable>
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
          <View style={styles.statusStack}>
            {!recovering ? (
              <ProgressTrace steps={summarizeChatProgress(lastAssistant?.parts)} />
            ) : null}
            <StatusBubble phase={recovering ? 'recovering' : phase} toolLabel={activeToolLabel(lastAssistant)} />
          </View>
        )}

        {/* ── Passerelles étudiant : prolonger la révision avec les outils du rôle ── */}
        {chatbot === 'student' && !isLoading && lastAssistant && user ? (
          <View style={styles.bridgeRow}>
            <Text style={styles.bridgeLabel}>Continuer avec</Text>
            {isFeatureVisible('ecos', persona, { isAdmin }) ? (
              <TouchableOpacity
                style={styles.bridgeChip}
                onPress={() => router.push('/(chat)/ecos' as never)}
                accessibilityRole="link"
                accessibilityLabel="S'entraîner sur un cas ECOS"
              >
                <Icon name="stethoscope" size={14} color={tokens.colors.accentDeep} />
                <Text style={styles.bridgeChipText}>S’entraîner (ECOS)</Text>
              </TouchableOpacity>
            ) : null}
            {isFeatureVisible('revision', persona, { isAdmin }) ? (
              <TouchableOpacity
                style={styles.bridgeChip}
                onPress={() => router.push('/(chat)/revision' as never)}
                accessibilityRole="link"
                accessibilityLabel="Planifier mes révisions"
              >
                <Icon name="calendarCheck" size={14} color={tokens.colors.accentDeep} />
                <Text style={styles.bridgeChipText}>Planifier (Révisions)</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* ── Section QCM (chat étudiant) : mini-examen type EDN généré à la demande ── */}
        {chatbot === 'student' && !isLoading && lastAssistant && user ? (
          <QcmLauncher
            token={tokenRef.current}
            buildContext={() => {
              const reversed = [...messages].reverse();
              const lastUser = reversed.find((m) => m.role === 'user');
              const parts: string[] = [];
              if (lastUser) {
                parts.push(`Question de l'étudiant : ${messageText(lastUser).slice(0, 1500)}`);
              }
              parts.push(`Réponse du cours : ${assistantTextForExport(lastAssistantText).slice(0, 3500)}`);
              return { context: parts.join('\n\n') };
            }}
          />
        ) : null}

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
              Génération arrêtée. La réponse complète restera disponible dans l’historique.
            </Text>
          </View>
        ) : null}

        {error && !recovering && errorKind === 'session' && (
          <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>
              Votre session a expiré : reconnectez-vous pour continuer la conversation.
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
              Une erreur est survenue ; la réponse a peut-être été interrompue.
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
        {showDocHint ? (
          <View style={styles.docHint}>
            <Icon name="fileText" size={14} color={tokens.colors.accentDeep} />
            <Text style={styles.docHintText} numberOfLines={2}>
              Long document ? L’outil Analyse de document résume comptes rendus et ordonnances.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(chat)/document' as never)}
              accessibilityRole="link"
              accessibilityLabel="Ouvrir l'outil Analyse de document"
              style={styles.docHintAction}
            >
              <Text style={styles.docHintActionText}>Ouvrir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDocHintDismissed(true)}
              accessibilityRole="button"
              accessibilityLabel="Masquer la suggestion"
              style={styles.docHintClose}
            >
              <Icon name="x" size={13} color={tokens.colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}
        {attachment ? (
          <View style={styles.attachmentChip}>
            <Icon name="paperclip" size={14} color={tokens.colors.accentDeep} />
            <Text style={styles.attachmentName} numberOfLines={1}>
              {attachment.name}
            </Text>
            <Pressable
              onPress={() => setAttachment(null)}
              accessibilityRole="button"
              accessibilityLabel="Retirer le document"
              hitSlop={8}
            >
              <Icon name="x" size={14} color={tokens.colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
        {attachError ? <Text style={styles.attachError}>{attachError}</Text> : null}
        {/* Écran large : rangée complète au-dessus du composer. Sur mobile, les mêmes
            réglages passent dans la barre du composer (variante inline ci-dessous). */}
        {!guestLocked && !compactControls ? (
          <ResponseControls
            mode={responseMode}
            onModeChange={setResponseMode}
            tools={outputTools}
            onToolsChange={setOutputTools}
            disabled={isLoading}
            variant="bar"
          />
        ) : null}
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
            {canAttach ? (
              <Pressable
                onPress={pickAttachment}
                accessibilityRole="button"
                accessibilityLabel="Joindre un document"
                disabled={isLoading}
                style={styles.attachButton}
              >
                <Icon name="paperclip" size={18} color={tokens.colors.accentDeep} />
              </Pressable>
            ) : null}
            {!isGuest ? (
              <DictationButton
                onTranscript={(text) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
                disabled={isLoading}
              />
            ) : null}
            {/* Mobile : profondeur (🧠) + outils (🧰) compacts, intégrés à la barre. */}
            {!guestLocked && compactControls ? (
              <ResponseControls
                mode={responseMode}
                onModeChange={setResponseMode}
                tools={outputTools}
                onToolsChange={setOutputTools}
                disabled={isLoading}
                variant="inline"
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
      </View>
      </View>

      <SourceDetailModal source={detailSource} onClose={() => setDetailSource(null)} />
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  // Desktop shell : colonne d'historique persistante + écran de chat (D5).
  screenRow: { flex: 1, flexDirection: 'row', minHeight: 0 },
  screenMain: { flex: 1, minWidth: 0 },
  historyRail: {
    width: 300,
    backgroundColor: tokens.colors.surface,
    borderRightWidth: 1,
    borderColor: tokens.colors.border,
    paddingTop: tokens.space.lg,
    paddingHorizontal: tokens.space.md,
    gap: tokens.space.md,
  },
  historyRailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.xs,
  },
  historyRailTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
  },
  historyCollapseBtn: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Notice transitoire de bascule de chatbot (B4/B5).
  switchNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.accentSurface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  switchNoticeText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },

  // Pastille d'essai invité sur l'état vide (C3).
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs + 2,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 2,
    marginTop: tokens.space.xs,
  },
  trialPillText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },

  // Suggestion de l'outil Analyse de document (C4).
  docHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  docHintText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
  },
  docHintAction: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 1,
    ...tokens.motion.transitionWeb,
  },
  docHintActionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  docHintClose: {
    width: 26,
    height: 26,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  // Essai invité épuisé : les chips restent visibles mais clairement inertes (C2).
  starterChipDisabled: { opacity: 0.45 },
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

  statusStack: { alignSelf: 'flex-start', gap: tokens.space.xs },
  progressTrace: {
    alignSelf: 'flex-start',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.sm,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs },
  progressText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
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

  // Passerelles étudiant (chat → ECOS / Révisions) : rangée discrète après la réponse.
  bridgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
  },
  bridgeLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  bridgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs + 2,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 2,
    ...tokens.motion.transitionWeb,
  },
  bridgeChipText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
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
  attachButton: {
    width: tokens.size.iconButton,
    height: tokens.size.iconButton,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 2,
    marginBottom: tokens.space.sm,
  },
  attachmentName: {
    flexShrink: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  attachError: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.caption.fontSize,
    marginBottom: tokens.space.sm,
  },
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
