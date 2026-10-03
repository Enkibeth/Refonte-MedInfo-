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
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type ViewStyle,
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
  shuffledStarterSuggestions,
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
import { SessionRecovery } from '@/ui/RoleGate';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons';
import { Reveal } from '@/ui/Reveal';
import { Touchable } from '@/ui/Touchable';
import { toolbarButtonStyles, toolbarContentColor } from '@/ui/toolbarButton';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { AssistantBlocks, SourcesBlock } from '@/ui/chat/AssistantBlocks';
import { QcmLauncher } from '@/ui/chat/QcmCard';
import { ChatbotSwitcher, CHATBOT_META } from '@/ui/chat/ChatbotSwitcher';
import { ConversationList, HistoryPanel } from '@/ui/chat/HistoryPanel';
import { CountrySelector } from '@/ui/chat/CountrySelector';
import { coerceCountry, type CountryCode } from '@/ai/chat/country';
import { ResponseControls } from '@/ui/chat/ResponseControls';
import { COMPOSER_ICON_SIZE, composerButtonStyles, composerIconColor } from '@/ui/chat/composerButton';
import { coerceResponseMode, type ResponseMode } from '@/ai/chat/responseMode';
import {
  LONG_WAIT_MS,
  elapsedLabel,
  inFlightAssistant,
  summarizeChatProgress,
  type ChatProgressStep,
} from '@/ai/chat/progress';
import { coerceChatOutputTools, type ChatOutputTool } from '@/ai/chat/outputTools';
import { shouldReplaceWithArchived, archiveMatchesTurn, turnOutcome } from '@/chat/resume';
import { createSubmissionGate } from '@/chat/submission';
import { chatPhaseLabel, phaseFromParts, streamingSources, type ChatPhase } from '@/ai/chat/statusPhases';
import { ChatStatusRing } from '@/ui/chat/ChatStatusRing';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  withAttachmentMarker,
  type ChatAttachment,
} from '@/ai/chat/attachment';
import { SourceDetailModal } from '@/ui/chat/SourceDetailModal';
import { useClientState } from '@/ui/hydration';
import { mi } from '@/ui/responsive';
import { useWindowWidth } from '@/ui/useWindowWidth';
import { FOCUS_TEXT_SIZE, readChatFocusPref, setChatFocus, useChatFocus } from '@/chat/focusMode';
import { MarkdownTextSizeContext } from '@/ui/MarkdownRenderer';
import { ChatMobileHeader } from '@/ui/chat/ChatMobileHeader';

// Suggestions d'amorce (état vide) : 50 questions par chatbot, rotation 3 par 3
// toutes les 30 s — voir src/ai/chat/starterSuggestions.ts.

/** Zone de saisie : une ligne (corps 24 px + marges 2 × 8 px) à vide, 140 px au plus. */
const INPUT_MIN_HEIGHT = 40;
const INPUT_MAX_HEIGHT = 140;

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

// ── Préférences locales du chat (web) : lues après l'hydratation, cf. useClientState ──

function readStoredItem(key: string): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const readHistoryCollapsed = () => readStoredItem('medinfo:chatHistoryCollapsed') === '1';
const readStoredCountry = () => coerceCountry(readStoredItem('medinfo:chatCountry'));
const readStoredResponseMode = () => coerceResponseMode(readStoredItem('medinfo:chatResponseMode'));
function readStoredOutputTools(): ChatOutputTool[] {
  try {
    return coerceChatOutputTools(JSON.parse(readStoredItem('medinfo:chatTools') ?? '[]'));
  } catch {
    return [];
  }
}

/** Reprise après coupure : intervalle et nombre d'essais (~4 min au total). */
const RECOVERY_INTERVAL_MS = 4000;
const RECOVERY_MAX_ATTEMPTS = 60;

const ALL_CHATBOTS: ChatbotId[] = ['public', 'student', 'professional'];

/** Élément réservé mais pas encore affiché : hors lecture d'écran et hors interaction. */
const PENDING_A11Y = {
  pointerEvents: 'none' as const,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};

/**
 * « Arrêter » prend la place d'« Envoyer » : le second clic d'un double clic (ou d'un
 * double tap) tombait sur Arrêter et coupait la réponse aussitôt — l'essai invité était
 * alors consommé sans réponse. Un arrêt dans ce court délai après l'envoi est ignoré.
 */
const STOP_GUARD_MS = 500;

/**
 * Bloc de statut affiché tant que la réponse n'a pas commencé à s'écrire : l'anneau
 * (ChatStatusRing) porte la phase en cours — raisonnement → recherche sur Internet →
 * rédaction — et le compteur d'attente.
 */
function StatusBubble({
  phase,
  toolLabel,
  startedAt,
  guest,
}: {
  phase: ChatPhase;
  guest: boolean;
  toolLabel?: string | null;
  /** Horodatage du début d'attente : alimente le compteur de secondes. */
  startedAt?: number | null;
}) {
  const label = chatPhaseLabel(phase, toolLabel);

  // Compteur de secondes : une attente CHIFFRÉE se supporte bien mieux qu'un spinner
  // muet — l'utilisateur voit que ça avance et sait à quoi s'en tenir.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const waited = startedAt ? now - startedAt : 0;
  const elapsed = elapsedLabel(waited);

  return (
    <View>
      {/* L'anneau porte lui-même la live region : les lecteurs d'écran sont informés des
          changements de phase (raisonnement → recherche → rédaction) sans focus manuel. */}
      <ChatStatusRing phase={phase} label={label} elapsed={elapsed} />
      {/* Attente longue : la génération va au bout côté serveur, l'utilisateur n'a pas
          besoin de rester sur la page (et surtout pas de relancer). */}
      {waited >= LONG_WAIT_MS && phase !== 'recovering' ? (
        <Text style={styles.statusHint}>
          {guest ? 'La réponse prend plus de temps. Gardez cet onglet ouvert : l’essai invité ne dispose pas d’historique.' : 'La réponse prend plus de temps. En cas de coupure, nous vérifierons si une réponse a été enregistrée dans cette conversation.'}
        </Text>
      ) : null}
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
    <View style={styles.progressTrace} accessibilityLabel="Étapes de recherche effectuées" {...(Platform.OS === 'web' ? { title: 'Étapes de recherche effectuées' } : {})}>
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
  onExport,
}: {
  text: string;
  showRegenerate: boolean;
  onRegenerate?: () => void;
  onExport: () => void;
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
    <View testID="response-actions" style={styles.messageActions}>
      {CAN_COPY ? (
        <Touchable
          style={styles.messageActionButton}
          onPress={() => void copy()}
          accessibilityRole="button"
          accessibilityLabel="Copier la réponse" {...(Platform.OS === 'web' ? { title: 'Copier la réponse' } : {})}
        >
          <Icon
            name={copied ? 'check' : 'copy'}
            size={14}
            color={copied ? tokens.colors.success : tokens.colors.textMuted}
          />
          <Text style={[styles.messageActionText, copied && styles.messageActionTextDone]}>
            {copied ? 'Copié' : 'Copier'}
          </Text>
        </Touchable>
      ) : null}
      {showRegenerate && onRegenerate ? (
        <Touchable
          style={styles.messageActionButton}
          onPress={onRegenerate}
          accessibilityRole="button"
          accessibilityLabel="Régénérer la réponse" {...(Platform.OS === 'web' ? { title: 'Régénérer la réponse' } : {})}
        >
          <Icon name="refresh" size={14} color={tokens.colors.textMuted} />
          <Text style={styles.messageActionText}>Régénérer</Text>
        </Touchable>
      ) : null}
      <Touchable style={styles.messageActionButton} onPress={onExport} accessibilityRole="button" accessibilityLabel="Exporter la réponse en PDF" {...(Platform.OS === 'web' ? { title: 'Exporter la réponse en PDF' } : {})}>
        <Icon name="download" size={tokens.size.iconSm} color={tokens.colors.textMuted} />
        <Text style={styles.messageActionText}>Exporter</Text>
      </Touchable>
    </View>
  );
}

/**
 * Un tour de conversation : question de l'utilisateur en bulle accent à droite,
 * réponse de l'assistant posée pleine largeur sur le fond (contenu d'abord, comme
 * ChatGPT / OpenEvidence) — les blocs internes (sources, propositions) gardent
 * leurs propres cartes.
 */
const MessageRow = memo(function MessageRow({
  message,
  onSend,
  disabled,
  onOpenSource,
  isLastAssistant,
  streaming,
  onRegenerate,
  onExport,
}: {
  message: UIMessage;
  onSend: (text: string) => void;
  disabled: boolean;
  onOpenSource: (s: ParsedSource) => void;
  isLastAssistant: boolean;
  streaming: boolean;
  onRegenerate: () => void;
  onExport: (message: UIMessage) => void;
}) {
  const isUser = message.role === 'user';
  const text = messageText(message);
  const textSize = useContext(MarkdownTextSizeContext);
  if (!text.trim()) return null;

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.bubbleUser}>
          <Text style={[styles.textUser, textSize]}>{text}</Text>
        </View>
      </View>
    );
  }
  const streamingThisMessage = streaming;
  return (
    <View testID="assistant-message" style={styles.assistantRow}>
      <AssistantBlocks
        text={text}
        onSend={onSend}
        disabled={disabled}
        streaming={streaming}
        onOpenSource={onOpenSource}
      />
      {!streamingThisMessage ? (
        <MessageActions
          // Copier colle la version « texte propre » (références en exposant, légende
          // des sources) — jamais les marqueurs techniques SRCn:: / INTERACTION / CALC.
          text={assistantTextForExport(text)}
          showRegenerate={isLastAssistant && !disabled}
          onRegenerate={onRegenerate}
          onExport={() => onExport(message)}
        />
      ) : null}
    </View>
  );
});

// Libellé de statut par outil. Depuis le retour à la base (ADR-0037), le chat n'a plus
// qu'un outil : la recherche web du provider. La table reste indexée par nom pour rester
// robuste aux variantes de nommage entre providers.
const TOOL_STATUS_LABELS: Record<string, string> = {
  web_search: 'Recherche de sources fiables…',
  web_search_preview: 'Recherche de sources fiables…',
  google_search: 'Recherche de sources fiables…',
};

/** Compacte un texte d'appel d'outil pour la bulle de statut (une ligne courte). */
function truncateStatusDetail(text: string, max = 64): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Libellé dynamique depuis les arguments de l'appel d'outil (latence perçue) : montrer la
 * requête réellement cherchée rend l'attente légitime. Arguments potentiellement partiels
 * pendant le streaming → repli systématique sur le libellé générique de l'outil.
 */
function toolLabelWithDetail(name: string, input: unknown): string {
  const args = (input ?? null) as { query?: unknown } | null;
  if (typeof args?.query === 'string' && args.query.trim()) {
    return `Recherche : « ${truncateStatusDetail(args.query)} »`;
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
  const {
    user,
    session,
    persona,
    personalInfo,
    chatCountry: profileCountry,
    updateChatCountry,
    loading: authLoading,
    bootDegraded,
  } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const width = useWindowWidth();
  const reducedMotion = useReducedMotion();
  const compactHeader = width < tokens.layout.compact;
  const isAdmin = user ? isAdminUserId(user.id) : false;

  // Desktop shell (≥ 1024 px, session) : l'historique devient une colonne
  // persistante à gauche du fil (motif ChatGPT/Claude) au lieu d'une modale.
  const desktopShell = Platform.OS === 'web' && width >= tokens.layout.wide && !!session;

  // Contrôles de réponse (profondeur + outils) : sur petit écran (mobile), on n'affiche
  // PAS la rangée segmentée au-dessus du composer — on la remplace par deux boutons-icônes
  // (🧠 profondeur + 🧰 outils) DANS la barre du composer, pour gagner de la hauteur de
  // chat (demande Hugo). Au-delà, la rangée complète a la place de s'afficher.

  // Essai sans inscription (2026-06) : un visiteur non connecté découvre les 3 onglets
  // de chatbot et dispose d'UN message gratuit (indicateur 1/1 → 0/1), puis l'UI
  // propose inscription / connexion. Verrou serveur correspondant dans /api/chat.
  // Amorçage dégradé (session probable mais pas encore récupérée, cf. bootGuard) : ce
  // n'est PAS un visiteur — on ne lui applique ni l'essai gratuit ni la carte d'inscription
  // (l'écran de récupération prend le relais plus bas).
  const sessionRecovering = bootDegraded && !session;
  const isGuest = !authLoading && !session && !sessionRecovering;
  const [guestUsed, setGuestUsed] = useState(false);
  useEffect(() => {
    if (isGuest) setGuestUsed(isGuestMessageUsed());
  }, [isGuest]);
  const guestLocked = isGuest && guestUsed;

  const canSwitch = isAdmin || persona === 'student' || persona === 'professional';
  // Pièce jointe : réservée aux comptes vérifiés étudiant/pro (+ admin), web only
  // (extraction/lecture du fichier côté navigateur). Le serveur regarde la persona.
  const canAttach = Platform.OS === 'web' && !!session && canSwitch;
  // Mémorisé : la liste sert de dépendance à openConversation (sinon recréé à chaque rendu).
  const availableChatbots = useMemo<ChatbotId[]>(
    () => (canSwitch || isGuest ? ALL_CHATBOTS : ['public']),
    [canSwitch, isGuest],
  );
  const switcherPending = authLoading && availableChatbots.length <= 1;
  const showSwitcher = availableChatbots.length > 1 || switcherPending;
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);
  // Plein écran (demande Hugo) : fil + saisie seuls, texte à la taille de Messages (17 px).
  const focus = useChatFocus();
  useEffect(() => {
    if (readChatFocusPref()) setChatFocus(true, false);
    return () => setChatFocus(false, false);
  }, []);
  const toggleFocus = useCallback(() => {
    const next = !focus;
    setChatFocus(next);
    // Ordinateur / Android : on demande aussi le vrai plein écran du navigateur (masque les
    // barres). iPhone : API absente pour une page (Safari ne l'accorde qu'aux vidéos) — le
    // mode reste « immersif » dans la page, ce qui suffit pour la lecture.
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    try {
      if (next && document.fullscreenEnabled && !document.fullscreenElement) {
        void document.documentElement.requestFullscreen().catch(() => {});
      } else if (!next && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Refus du navigateur : le mode immersif reste actif.
    }
  }, [focus]);
  const defaultChatbot: ChatbotId =
    persona === 'student' || persona === 'professional' ? persona : 'public';

  const [chatbot, setChatbot] = useState<ChatbotId>(defaultChatbot);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // Desktop/grand écran : masquer la colonne d'historique pour gagner de la place
  // pendant la conversation (préférence persistée, web only).
  // Préférences lues après l'hydratation (cf. useClientState) et jamais réécrites avant.
  const [historyCollapsed, setHistoryCollapsed, historyPrefReady] = useClientState(readHistoryCollapsed, false);
  useEffect(() => {
    if (!historyPrefReady || Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('medinfo:chatHistoryCollapsed', historyCollapsed ? '1' : '0');
    } catch {
      // best-effort : la préférence n'est pas critique
    }
  }, [historyCollapsed, historyPrefReady]);
  // Pays d'exercice : oriente les sources privilégiées par l'assistant (envoyé dans
  // le body de /api/chat). Persisté au PROFIL depuis 2026-07 (migration 0043) — le
  // localStorage seul était perdu à chaque changement d'appareil/navigateur ; il reste
  // le repli des visiteurs non connectés et l'amorce avant l'hydratation du profil.
  const [country, setCountry] = useClientState<CountryCode | null>(readStoredCountry, null);
  // Le profil fait foi dès qu'il est chargé (synchronisation entre appareils) ; s'il
  // n'a encore AUCUN pays mais qu'un choix local existe (utilisateur d'avant la
  // migration), on remonte ce choix au profil une fois pour toutes.
  const countryMigratedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !session) return;
    if (profileCountry) {
      setCountry(profileCountry);
    } else if (country && !countryMigratedRef.current) {
      countryMigratedRef.current = true;
      void updateChatCountry(country);
    }
    // `country` volontairement hors dépendances : cet effet ne réagit qu'à
    // l'hydratation du profil, jamais aux changements locaux (gérés par onChange).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profileCountry, updateChatCountry]);
  // Choix explicite de l'utilisateur : état local + localStorage + profil (best-effort).
  const handleCountryChange = useCallback(
    (code: CountryCode) => {
      setCountry(code);
      if (session) void updateChatCountry(code);
    },
    [session, updateChatCountry, setCountry],
  );
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
  const [responseMode, setResponseMode, responseModeReady] = useClientState<ResponseMode>(readStoredResponseMode, 'standard');
  useEffect(() => {
    if (!responseModeReady || Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('medinfo:chatResponseMode', responseMode);
    } catch {
      // best-effort
    }
  }, [responseMode, responseModeReady]);

  const [outputTools, setOutputTools, outputToolsReady] = useClientState<ChatOutputTool[]>(readStoredOutputTools, []);
  useEffect(() => {
    if (!outputToolsReady || Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('medinfo:chatTools', JSON.stringify(outputTools));
    } catch {
      // best-effort
    }
  }, [outputTools, outputToolsReady]);

  // Pièce jointe (document) — réservé aux comptes vérifiés étudiant/pro (+ admin), web only.
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  // Pièce jointe du DERNIER tour envoyé (mémoire de l'onglet seulement, jamais stockée) :
  // « Réessayer » et « Régénérer » rejouent ce tour document compris. Avant, le document
  // quittait la mémoire dès l'envoi : un réessai ne transmettait plus que son nom et le
  // modèle répondait « je ne vois pas le contenu de IMG_0847.png » (retour Hugo 2026-10).
  const turnAttachmentRef = useRef<ChatAttachment | null>(null);
  // Tour terminé sans aucune réponse rédigée (réflexion qui épuise le plafond de sortie,
  // flux coupé sans archive) : sans ce signal, l'écran restait muet — ni réponse, ni
  // erreur, ni bouton « Réessayer » — et l'utilisateur en était réduit à envoyer « ? ».
  const [unansweredTurn, setUnansweredTurn] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [detailSource, setDetailSource] = useState<ParsedSource | null>(null);
  const openSourceDetail = useCallback((s: ParsedSource) => setDetailSource(s), []);

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
          // Le document du tour envoyé (et rejoué par Réessayer/Régénérer), pas celui du
          // composeur : le composeur est vidé dès l'envoi.
          attachment: turnAttachmentRef.current ?? undefined,
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
  const submissionGate = useRef(createSubmissionGate());
  const turnEpoch = useRef(0);
  const [preparing, setPreparing] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<UIMessage | null>(null);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const draftRef = useRef('');
  /** Instant avant lequel « Arrêter » ignore un clic (voir STOP_GUARD_MS). */
  const stopGuardUntilRef = useRef(0);
  useEffect(() => () => { submissionGate.current.cancel(); turnEpoch.current++; }, []);
  const awaitingRef = useRef(false);
  /** Une génération était-elle en cours au moment où l'app est passée en arrière-plan ? */
  const generatedWhileHiddenRef = useRef(false);
  /** Reprise depuis l'historique (définie plus bas, appelée depuis `onFinish`). */
  const startRecoveryRef = useRef<() => void>(() => {});

  /** Tour sans réponse : le signaler, et rendre son document au composeur pour la suite. */
  const markTurnUnanswered = useCallback(() => {
    setUnansweredTurn(true);
    // Un message tapé ensuite (« ? ») renverra ainsi le document, au lieu de son seul nom.
    const turnAttachment = turnAttachmentRef.current;
    if (turnAttachment && !attachmentRef.current) setAttachment(turnAttachment);
  }, []);

  /** Tour enfin répondu : retirer du composeur le document qu'on y avait rendu. */
  const settleTurn = useCallback(() => {
    setUnansweredTurn(false);
    if (attachmentRef.current && attachmentRef.current === turnAttachmentRef.current) setAttachment(null);
  }, []);

  const { messages, sendMessage, status, error, setMessages, regenerate, clearError, stop } = useChat({
    transport,
    onFinish: async ({ message, isAbort, isDisconnect, isError, finishReason }) => {
      if (isAbort || isDisconnect || isError || !awaitingRef.current) return;
      const text = messageText(message);
      const outcome = turnOutcome(text, finishReason);
      if (outcome === 'interrupted' && conversationIdRef.current) {
        // Flux clos sans un mot ni fragment final : coupé en route. La génération continue
        // côté serveur et sera archivée — on va l'y chercher (l'échec est signalé si rien
        // n'arrive dans la fenêtre de reprise).
        startRecoveryRef.current();
        return;
      }
      awaitingRef.current = false;
      regenerateRef.current = false;
      if (outcome !== 'answered') {
        // Réponse vide (ex. réflexion qui a épuisé le plafond de sortie) : rien ne sera
        // archivé, rien à attendre — le dire et proposer « Réessayer ».
        markTurnUnanswered();
        return;
      }
      settleTurn();
      const convId = conversationIdRef.current;
      if (!convId || !user?.id) return;
      // La réponse est archivée par le SERVEUR (/api/chat onFinish) — le client ne
      // sauvegarde plus que le titre/catégorie et rafraîchit la liste.
      if (!titleGeneratedRef.current && tokenRef.current) {
        titleGeneratedRef.current = true;
        await generateConversationMeta(convId, tokenRef.current, firstUserTextRef.current, text.slice(0, 1500));
      }
      void refreshConversations();
    },
  });

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const statusRef = useRef(status);
  statusRef.current = status;

  const isLoading = preparing || status === 'streaming' || status === 'submitted';
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
  const lastScrollOffsetRef = useRef(0);
  const [atBottom, setAtBottom] = useState(true);

  // Seul un geste VERS LE HAUT arrête le suivi. Un défilement programmé animé (« Revenir en
  // bas ») émet des positions intermédiaires loin du bas : les compter comme une lecture
  // arrêtait le suivi dès que la réponse grandissait pendant l'animation.
  const handleThreadScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distance = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const movedUp = contentOffset.y < lastScrollOffsetRef.current - 1;
    lastScrollOffsetRef.current = contentOffset.y;
    if (distance < tokens.space.lg) {
      followRef.current = true;
      setAtBottom(true);
    } else if (movedUp || !followRef.current) {
      followRef.current = false;
      setAtBottom(false);
    }
  }, []);

  /** Position réelle du fil et distance au bas (web) : sert à voir une remontée pas encore signalée. */
  const threadMetrics = useCallback((): { top: number; distance: number } | null => {
    if (Platform.OS !== 'web') return null;
    const node = scrollRef.current?.getScrollableNode?.() as
      | { scrollTop?: unknown; scrollHeight?: unknown; clientHeight?: unknown }
      | null
      | undefined;
    const { scrollTop, scrollHeight, clientHeight } = node ?? {};
    if (typeof scrollTop !== 'number' || typeof scrollHeight !== 'number' || typeof clientHeight !== 'number') return null;
    return { top: scrollTop, distance: scrollHeight - clientHeight - scrollTop };
  }, []);
  const threadScrollTop = useCallback(() => threadMetrics()?.top ?? null, [threadMetrics]);

  const scrollToBottom = useCallback((animated = true) => {
    followRef.current = true;
    setAtBottom(true);
    scrollRef.current?.scrollToEnd({ animated: animated && !reducedMotion });
    lastScrollOffsetRef.current = threadScrollTop() ?? lastScrollOffsetRef.current;
  }, [reducedMotion, threadScrollTop]);

  // `onScroll` est limité à 80 ms alors qu'un flux rapide fait grandir le fil toutes les
  // ~30 ms : une remontée de l'utilisateur pas encore signalée était aussitôt annulée par
  // le suivi (fil ramené en bas, surtout sur mobile). On compare donc la position réelle
  // à la dernière connue avant de suivre. Deux déplacements ne sont pas des gestes de
  // l'utilisateur : un contenu qui rétrécit (régénération, nouveau fil) et une zone de
  // lecture qui s'agrandit alors que le fil est en bas (fenêtre agrandie, bandeau qui
  // disparaît : le navigateur abaisse la position pour rester en bas). D'où la distance au
  // bas mesurée AVANT cette croissance : seule une vraie remontée l'éloigne du bas.
  const lastContentHeightRef = useRef(0);
  const handleThreadGrow = useCallback((_width: number, height: number) => {
    const growth = height - lastContentHeightRef.current;
    lastContentHeightRef.current = height;
    if (!followRef.current) return;
    const m = threadMetrics();
    if (m && growth >= 0 && m.top < lastScrollOffsetRef.current - 1 && m.distance - growth >= tokens.space.lg) {
      followRef.current = false;
      setAtBottom(false);
      return;
    }
    scrollRef.current?.scrollToEnd({ animated: false });
    lastScrollOffsetRef.current = threadScrollTop() ?? lastScrollOffsetRef.current;
  }, [threadMetrics, threadScrollTop]);

  // ── Reprise après coupure (page suspendue / réseau) ────────────────────────────
  // Cadence et durée de la reprise : ~4 min, largement au-delà du pire cas de génération
  // evidence-first observé (l'ancienne fenêtre de 60 s abandonnait trop tôt).

  // La génération continue côté serveur et la réponse est archivée dans l'historique :
  // on la récupère depuis Supabase au lieu de la perdre.
  const [recovering, setRecovering] = useState(false);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryRunningRef = useRef(false);
  const recoveryCancelledRef = useRef(false);
  // Arrêt volontaire pendant le streaming : note honnête « la réponse complète est
  // dans l'historique » (le serveur va au bout et archive — résilience hors-ligne).
  const [stoppedNotice, setStoppedNotice] = useState(false);

  const recoverFromHistory = useCallback(async (): Promise<boolean> => {
    const convId = conversationIdRef.current;
    if (!convId) return false;
    const epoch = turnEpoch.current;
    const stored = await loadMessages(convId);
    if (epoch !== turnEpoch.current || convId !== conversationIdRef.current || recoveryCancelledRef.current) return false;
    const local = messagesRef.current.map(m => ({ role: m.role, content: messageText(m) }));
    if (!archiveMatchesTurn(local, stored)) return false;
    setMessages(
      stored.map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: 'text' as const, text: m.content }],
      })),
    );
    clearError();
    awaitingRef.current = false;
    settleTurn();
    return true;
  }, [setMessages, clearError, settleTurn]);

  // Fenêtre de reprise : une réponse evidence-first peut demander bien plus d'une minute
  // (recherche → lecture → vérification → rédaction). L'ancienne fenêtre de 60 s abandonnait
  // AVANT que le serveur n'ait fini, et l'utilisateur retrouvait une erreur alors que sa
  // réponse arrivait quelques secondes plus tard. ~4 min couvrent le pire cas observé.
  const startRecovery = useCallback(() => {
    if (!awaitingRef.current || !conversationIdRef.current) return;
    if (recoveryRunningRef.current) return;
    recoveryRunningRef.current = true;
    const epoch = turnEpoch.current;
    setRecovering(true);

    const stop = () => {
      recoveryRunningRef.current = false;
      setRecovering(false);
    };

    const poll = async (attempt: number) => {
      if (recoveryCancelledRef.current || !awaitingRef.current || epoch !== turnEpoch.current) return stop();
      // Le flux tourne encore (retour rapide dans l'onglet) : on le laisse finir.
      const busy = statusRef.current === 'streaming' || statusRef.current === 'submitted';
      if (!busy && (await recoverFromHistory())) return stop();
      if (attempt >= RECOVERY_MAX_ATTEMPTS) {
        // Rien d'archivé dans la fenêtre : le dire (bannière « Réessayer ») plutôt que de
        // laisser un écran muet quand le flux s'est clos sans erreur. `awaitingRef` reste
        // armé : un retour dans l'onglet relance la reprise, comme avant.
        if (!busy) markTurnUnanswered();
        return stop();
      }
      recoveryTimerRef.current = setTimeout(() => void poll(attempt + 1), RECOVERY_INTERVAL_MS);
    };
    void poll(0);
  }, [recoverFromHistory, markTurnUnanswered]);
  startRecoveryRef.current = startRecovery;

  /**
   * Resynchronisation SILENCIEUSE au retour de veille.
   *
   * `startRecovery` ne se déclenche que si une réponse est encore attendue. Or iOS peut
   * couper le flux SANS erreur : `useChat` repasse en « prêt » avec une réponse tronquée à
   * l'écran, et plus rien ne va chercher la version complète — l'utilisateur reste devant
   * un texte coupé au milieu d'une phrase, sans le moindre signal. On compare donc la
   * dernière réponse affichée à celle archivée par le serveur, et on la remplace si
   * l'archive est manifestement la même réponse en plus complet (module pur testé).
   */
  const resyncLastAnswer = useCallback(async () => {
    const convId = conversationIdRef.current;
    if (!convId) return;
    // Une génération est en cours : on la laisse finir, elle fait autorité.
    if (['streaming', 'submitted'].includes(statusRef.current)) return;

    const epoch = turnEpoch.current;
    const stored = await loadMessages(convId);
    if (epoch !== turnEpoch.current || convId !== conversationIdRef.current || recoveryCancelledRef.current) return;
    if (['streaming', 'submitted'].includes(statusRef.current)) return;
    const archived = stored[stored.length - 1];
    if (!archived || archived.role !== 'assistant') return;

    let replaced = false;
    setMessages((current) => {
      if (epoch !== turnEpoch.current || convId !== conversationIdRef.current) return current;
      if (!archiveMatchesTurn(current.map(m => ({ role: m.role, content: messageText(m) })), stored)) return current;
      const last = current[current.length - 1];
      if (!last || last.role !== 'assistant') return current;
      if (messageText(last).trim() === archived.content.trim()) { generatedWhileHiddenRef.current = false; return current; }
      if (!shouldReplaceWithArchived(messageText(last), archived.content)) return current;
      replaced = true;
      return [
        ...current.slice(0, -1),
        { ...last, parts: [{ type: 'text' as const, text: archived.content }] },
      ];
    });
    if (replaced) { clearError(); generatedWhileHiddenRef.current = false; }
  }, [setMessages, clearError]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    recoveryCancelledRef.current = false;

    let resyncTimer: ReturnType<typeof setTimeout> | undefined;
    const checkArchive = async (epoch: number, attempt = 0) => {
      if (recoveryCancelledRef.current || epoch !== turnEpoch.current) return;
      await resyncLastAnswer();
      if (attempt < RECOVERY_MAX_ATTEMPTS && generatedWhileHiddenRef.current && epoch === turnEpoch.current) {
        resyncTimer = setTimeout(() => void checkArchive(epoch, attempt + 1), RECOVERY_INTERVAL_MS);
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      startRecovery();
      // Le flux a pu mourir sans erreur pendant l'absence : on complète en silence.
      if (generatedWhileHiddenRef.current) {
        clearTimeout(resyncTimer);
        void checkArchive(turnEpoch.current);
      }
    };

    // Mémorise qu'une génération était en cours au moment où l'on quitte l'app : c'est la
    // seule situation où une réponse tronquée peut apparaître sans erreur.
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return;
      if (statusRef.current === 'streaming' || statusRef.current === 'submitted') {
        generatedWhileHiddenRef.current = true;
      }
    };
    document.addEventListener('visibilitychange', onHidden);

    document.addEventListener('visibilitychange', onVisible);
    // Retour depuis le cache arrière/avant (iOS) : `visibilitychange` ne se déclenche pas
    // toujours, `pageshow` si.
    window.addEventListener('pageshow', onVisible);
    // Onglet déjà visible au montage (l'app a été rouverte sur cet écran) : on tente aussi.
    onVisible();

    return () => {
      recoveryCancelledRef.current = true;
      clearTimeout(resyncTimer);
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [startRecovery, resyncLastAnswer]);

  // Le flux a cassé alors qu'une réponse était attendue : la génération continue côté
  // serveur (keepAlive) — on va la chercher SANS attendre que l'utilisateur clique
  // « Réessayer », qui relancerait un appel LLM pour rien.
  useEffect(() => {
    if (!error || !awaitingRef.current || !conversationIdRef.current) return;
    startRecovery();
  }, [error, startRecovery]);

  // Réessayer après erreur : la réponse a pu aboutir côté serveur malgré la coupure —
  // on vérifie d'abord l'historique, sinon on renvoie la même requête (sans re-saisie).
  const handleRetry = useCallback(async () => {
    if (recoveryRunningRef.current || statusRef.current === 'streaming' || statusRef.current === 'submitted') return;
    const epoch = turnEpoch.current;
    setRecovering(true);
    const recovered = await recoverFromHistory();
    setRecovering(false);
    if (epoch !== turnEpoch.current) return;
    if (recovered) return;
    clearError();
    setUnansweredTurn(false);
    awaitingRef.current = true;
    // Réessayer relance la même question, document du tour compris (turnAttachmentRef) : la
    // réponse éventuellement déjà archivée pour ce tour est remplacée, pas doublée.
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
  // Ordre aléatoire tiré APRÈS l'hydratation (un tirage au premier rendu donnerait un HTML
  // différent du pré-rendu → erreur React #418) ; en attendant, les suggestions restent
  // invisibles pour ne pas afficher l'ordre fixe puis le remplacer sous les yeux.
  const [starterOrder, , starterOrderReady] = useClientState(shuffledStarterSuggestions, STARTER_SUGGESTIONS);
  const starters = useMemo(
    () => suggestionWindow(starterOrder[chatbot], suggestionTick),
    [starterOrder, chatbot, suggestionTick],
  );

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant'),
    [messages],
  );

  // Message assistant EN COURS de génération (≠ dernière réponse affichée) : tant que la
  // nouvelle réponse n'a pas commencé, il n'y en a pas — la bulle de statut ne doit donc
  // montrer AUCUNE étape, et surtout pas celles du tour précédent.
  const activeAssistant = useMemo(() => inFlightAssistant(messages) ?? undefined, [messages]);

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
    () => (!isLoading && lastAssistant ? parseAssistantMessage(messageText(lastAssistant)).sources : []),
    [lastAssistant, isLoading],
  );
  // Phase de chargement : pendant l'attente (submitted) ou tant qu'aucun texte n'est encore
  // arrivé, on montre une bulle de statut (réflexion → recherche de sources → rédaction).
  const lastAssistantText = activeAssistant ? messageText(activeAssistant) : '';
  const showStatus =
    preparing || status === 'submitted' || (status === 'streaming' && lastAssistantText.trim().length === 0);

  // Début de l'attente : posé au passage en « submitted », remis à zéro à la fin.
  const [waitStartedAt, setWaitStartedAt] = useState<number | null>(null);
  useEffect(() => {
    if (preparing || status === 'submitted') setWaitStartedAt((prev) => prev ?? Date.now());
    else if (status !== 'streaming') setWaitStartedAt(null);
  }, [status, preparing]);
  useEffect(() => {
    if (recovering) setWaitStartedAt((prev) => prev ?? Date.now());
  }, [recovering]);
  // Un seul appel LLM (ADR-0037) : la réponse est en réflexion, puis en recherche web si
  // le provider en déclenche une, puis en rédaction dès le premier fragment de texte.
  const phase: ChatPhase = preparing ? 'thinking' : phaseFromParts(activeAssistant?.parts);
  const foundSources = useMemo(() => streamingSources(activeAssistant?.parts), [activeAssistant]);

  // Fin de réponse annoncée aux lecteurs d'écran (région polie, masquée à l'écran) : le texte
  // diffusé fragment par fragment n'est volontairement PAS lu au fil de l'eau (il submergerait
  // la synthèse vocale) ; la bulle de statut annonce déjà les phases d'attente.
  const [responseAnnouncement, setResponseAnnouncement] = useState('');
  const previousStatusRef = useRef(status);
  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = status;
    if (status === 'submitted') setResponseAnnouncement('');
    else if ((previous === 'streaming' || previous === 'submitted') && status === 'ready') {
      setResponseAnnouncement('Réponse terminée.');
    }
  }, [status]);

  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    const att = attachmentRef.current;
    if ((!trimmed && !att) || (isGuest && guestUsed) || recovering) return;
    if (['streaming', 'submitted'].includes(statusRef.current)) return;
    const ticket = submissionGate.current.begin();
    if (ticket === null) return;
    stopGuardUntilRef.current = Date.now() + STOP_GUARD_MS;
    turnEpoch.current++;
    generatedWhileHiddenRef.current = false;
    draftRef.current = text;
    const displayText = att ? withAttachmentMarker(trimmed, att.name) : trimmed;
    setPreparationError(null);
    setPreparing(true);
    setPendingMessage({ id: `pending-${ticket}`, role: 'user', parts: [{ type: 'text', text: displayText }] });
    setWaitStartedAt(Date.now());
    setStoppedNotice(false);
    setUnansweredTurn(false);
    scrollToBottom(false);
    try {
      if (user && !conversationIdRef.current) {
        const id = await createConversation(user.id, chatbotRef.current);
        if (!submissionGate.current.current(ticket)) return;
        if (!id) throw new Error('La conversation n’a pas pu être ouverte. Votre question est conservée.');
        conversationIdRef.current = id;
        setConversationId(id);
        titleGeneratedRef.current = false;
        firstUserTextRef.current = displayText;
      }
      if (user && conversationIdRef.current) {
        await saveMessage(conversationIdRef.current, user.id, 'user', displayText);
        if (!submissionGate.current.current(ticket)) return;
      }
      if (isGuest) { markGuestMessageUsed(); setGuestUsed(true); }
      awaitingRef.current = true;
      regenerateRef.current = false;
      // Le document appartient à CE tour (null s'il n'y en a pas : un « Régénérer » ultérieur
      // ne doit jamais renvoyer le document d'un tour plus ancien).
      turnAttachmentRef.current = att;
      const request = sendMessage({ text: displayText });
      setPendingMessage(null);
      setPreparing(false);
      if (att) { setAttachment(null); setAttachError(null); }
      await request;
    } catch (cause) {
      if (submissionGate.current.current(ticket)) {
        setPreparationError(cause instanceof Error ? cause.message : 'Envoi impossible. Votre question est conservée.');
        setInput(text);
      }
    } finally {
      if (submissionGate.current.current(ticket)) { setPreparing(false); setPendingMessage(null); }
      submissionGate.current.finish(ticket);
    }
  }, [sendMessage, user, isGuest, guestUsed, recovering, scrollToBottom]);

  const handleSend = () => {
    if (!canSend) return;
    const text = input;
    setInput('');
    setInputHeight(INPUT_MIN_HEIGHT);
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
    if (Date.now() < stopGuardUntilRef.current) return;
    submissionGate.current.cancel();
    turnEpoch.current++;
    generatedWhileHiddenRef.current = false;
    if (preparing) setInput(draftRef.current);
    setPreparing(false);
    setPendingMessage(null);
    awaitingRef.current = false;
    setStoppedNotice(true);
    void stop();
  };

  const handleRegenerate = useCallback(() => {
    if (['streaming', 'submitted'].includes(statusRef.current)) return;
    stopGuardUntilRef.current = Date.now() + STOP_GUARD_MS;
    turnEpoch.current++;
    generatedWhileHiddenRef.current = false;
    awaitingRef.current = true;
    regenerateRef.current = true;
    setStoppedNotice(false);
    setUnansweredTurn(false);
    void regenerate();
  }, [regenerate]);

  const startNewConversation = useCallback(
    (nextChatbot?: ChatbotId) => {
      submissionGate.current.cancel();
      turnEpoch.current++;
      generatedWhileHiddenRef.current = false;
      setPreparing(false);
      setPendingMessage(null);
      setPreparationError(null);
      // Une génération encore en cours ne doit pas continuer d'écrire dans le
      // nouveau fil, ni laisser la reprise hors-ligne armée sur l'ancien.
      if (statusRef.current === 'streaming' || statusRef.current === 'submitted') void stop();
      awaitingRef.current = false;
      regenerateRef.current = false;
      turnAttachmentRef.current = null;
      setUnansweredTurn(false);
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
      submissionGate.current.cancel();
      const epoch = ++turnEpoch.current;
      generatedWhileHiddenRef.current = false;
      setPreparing(false);
      setPendingMessage(null);
      setPreparationError(null);
      // Même garde que startNewConversation : le flux en cours ne doit pas venir
      // s'écrire dans la conversation qu'on ouvre.
      if (statusRef.current === 'streaming' || statusRef.current === 'submitted') void stop();
      awaitingRef.current = false;
      regenerateRef.current = false;
      turnAttachmentRef.current = null;
      setUnansweredTurn(false);
      setStoppedNotice(false);
      const stored = await loadMessages(c.id);
      if (epoch !== turnEpoch.current) return;
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

  const exportResponse = useCallback((message: UIMessage) => {
    exportChatToPdf({ title: 'Réponse MedInfo AI', chatbotLabel: CHATBOT_META[chatbotRef.current].label, messages: [{ role: 'assistant', content: messageText(message) }] });
  }, []);

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

  // Session non rétablie sur un navigateur qui en avait une : écran de récupération
  // (réessayer / réinitialiser) plutôt qu'un chat en mode visiteur qui échouerait à
  // archiver, ou l'ancien chargement infini.
  if (sessionRecovering) return <SessionRecovery />;

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
      <MarkdownTextSizeContext.Provider value={focus ? FOCUS_TEXT_SIZE : null}>
      <View style={styles.screenRow}>
      {/* ── Colonne d'historique persistante (desktop shell, D5) ── */}
      {desktopShell && user && !historyCollapsed && !focus ? (
        <View style={styles.historyRail}>
          <View style={styles.historyRailHeader}>
            <Icon name="clock" size={16} color={tokens.colors.accentDeep} />
            <Text style={styles.historyRailTitle}>Historique</Text>
            <View style={{ flex: 1 }} />
            <Touchable
              onPress={() => setHistoryCollapsed(true)}
              accessibilityRole="button"
              accessibilityLabel="Masquer l’historique" {...(Platform.OS === 'web' ? { title: 'Masquer l’historique' } : {})}
              style={styles.historyCollapseBtn}
            >
              <Icon name="panelLeft" size={16} color={tokens.colors.textMuted} />
            </Touchable>
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
      {/* ── Plein écran : une barre fine (quitter, sources, nouvelle conversation) ── */}
      {focus ? (
        <View style={[styles.focusBar, { paddingTop: tokens.space.xs + insets.top }]}>
          <Touchable
            style={[toolbarButtonStyles.button, toolbarButtonStyles.icon]}
            onPress={toggleFocus}
            accessibilityRole="button"
            accessibilityLabel="Quitter le plein écran" {...(Platform.OS === 'web' ? { title: 'Quitter le plein écran' } : {})}
          >
            <Icon name="minimize" size={17} color={toolbarContentColor()} />
          </Touchable>
          <Text style={styles.focusTitle} numberOfLines={1}>{meta.label}</Text>
          {latestSources.length > 0 ? (
            <Touchable
              style={[toolbarButtonStyles.button, sourcesOpen && toolbarButtonStyles.active]}
              aria-expanded={sourcesOpen}
              onPress={() => setSourcesOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={`Sources (${latestSources.length})`}
            >
              <Icon name="bookOpen" size={16} color={toolbarContentColor(sourcesOpen)} />
              <Text style={[toolbarButtonStyles.label, sourcesOpen && toolbarButtonStyles.labelActive]}>
                {latestSources.length}
              </Text>
            </Touchable>
          ) : null}
          {messages.length > 0 ? (
            <Touchable
              style={[toolbarButtonStyles.button, toolbarButtonStyles.icon]}
              onPress={() => startNewConversation()}
              accessibilityRole="button"
              accessibilityLabel="Nouvelle conversation" {...(Platform.OS === 'web' ? { title: 'Nouvelle conversation' } : {})}
            >
              <Icon name="plus" size={18} color={toolbarContentColor()} />
            </Touchable>
          ) : null}
        </View>
      ) : null}
      {/* ── Téléphone (< 640 px) : UNE barre ☰ · chatbot ▾ · ＋ (ChatMobileHeader) ──
          Sur le web, les deux en-têtes sont rendus et le CSS (mi) n'en montre qu'un : le
          pré-rendu (largeur 0) est juste à toutes les largeurs. Sur natif, le JS choisit. */}
      {!focus && (Platform.OS === 'web' || compactHeader) ? (
        <View {...mi('lt640')}>
          <ChatMobileHeader
            chatbot={chatbot}
            chatbots={availableChatbots}
            onSwitchChatbot={handleSwitchChatbot}
            switchDisabled={isLoading || switcherPending}
            onNew={messages.length > 0 ? () => startNewConversation() : undefined}
            onHistory={user && !desktopShell ? () => setHistoryOpen(true) : undefined}
            onExport={messages.length > 0 ? handleExportPdf : undefined}
            sourcesCount={latestSources.length}
            onSources={() => setSourcesOpen(true)}
            onFullscreen={toggleFocus}
            country={country}
            onCountryChange={handleCountryChange}
            topInset={insets.top}
            isGuest={isGuest}
          />
        </View>
      ) : null}
      {/* ── En-tête (tablette / ordinateur) ── */}
      {!focus && (Platform.OS === 'web' || !compactHeader) ? (
      <View {...mi('chat-header', 'ge640')} style={[styles.chatHeader, compactHeader && styles.chatHeaderCompact, { paddingTop: tokens.space.md + insets.top }]}>
        {desktopShell && user && historyCollapsed ? (
          <Touchable
            onPress={() => setHistoryCollapsed(false)}
            accessibilityRole="button"
            accessibilityLabel="Afficher l’historique" {...(Platform.OS === 'web' ? { title: 'Afficher l’historique' } : {})}
            style={[toolbarButtonStyles.button, toolbarButtonStyles.icon, { marginRight: tokens.space.sm }]}
          >
            <Icon name="panelLeft" size={17} color={toolbarContentColor()} />
          </Touchable>
        ) : null}
        <View style={styles.headerTitleBlock}>
          <Text style={styles.chatTitle} accessibilityRole="header" aria-level={1}>
            Chat {meta.label.toLowerCase()}
          </Text>
          <Text style={styles.chatSubtitle} numberOfLines={1}>
            {meta.description}
          </Text>
        </View>
        <View {...mi('chat-header-actions')} style={[styles.headerActions, compactHeader && { justifyContent: 'flex-end' }]}>
          <CountrySelector value={country} onChange={handleCountryChange} />
          {latestSources.length > 0 ? (
            <Touchable
              style={[toolbarButtonStyles.button, sourcesOpen && toolbarButtonStyles.active]}
              aria-expanded={sourcesOpen}
              onPress={() => setSourcesOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={`Sources (${latestSources.length})`}
            >
              <Icon name="bookOpen" size={16} color={toolbarContentColor(sourcesOpen)} />
              <Text style={[toolbarButtonStyles.label, sourcesOpen && toolbarButtonStyles.labelActive]}>
                {latestSources.length}
              </Text>
            </Touchable>
          ) : null}
          {messages.length > 0 ? (
            <Touchable
              style={[toolbarButtonStyles.button, toolbarButtonStyles.icon]}
              onPress={handleExportPdf}
              accessibilityRole="button"
              accessibilityLabel="Exporter la conversation en PDF" {...(Platform.OS === 'web' ? { title: 'Exporter la conversation en PDF' } : {})}
            >
              <Icon name="download" size={17} color={toolbarContentColor()} />
            </Touchable>
          ) : null}
          {user && !desktopShell ? (
            <Touchable
              style={[toolbarButtonStyles.button, toolbarButtonStyles.icon]}
              onPress={() => setHistoryOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Historique des conversations" {...(Platform.OS === 'web' ? { title: 'Historique des conversations' } : {})}
            >
              <Icon name="clock" size={17} color={toolbarContentColor()} />
            </Touchable>
          ) : null}
          {messages.length > 0 ? (
            <Touchable
              style={[toolbarButtonStyles.button, toolbarButtonStyles.icon]}
              onPress={() => startNewConversation()}
              accessibilityRole="button"
              accessibilityLabel="Nouvelle conversation" {...(Platform.OS === 'web' ? { title: 'Nouvelle conversation' } : {})}
            >
              <Icon name="plus" size={18} color={toolbarContentColor()} />
            </Touchable>
          ) : null}
          <Touchable
            style={[toolbarButtonStyles.button, toolbarButtonStyles.icon]}
            onPress={toggleFocus}
            accessibilityRole="button"
            accessibilityLabel="Plein écran" {...(Platform.OS === 'web' ? { title: 'Plein écran' } : {})}
          >
            <Icon name="maximize" size={17} color={toolbarContentColor()} />
          </Touchable>
          <ToolsMenu />
        </View>
      </View>
      ) : null}

      {/* ── Switch de chatbot (étudiant / pro / admin, essai invité) ──
          Pendant l'amorçage de la session, on ignore encore s'il s'affichera : sa place
          est réservée (invisible et inerte) pour que son arrivée ne décale pas le fil. */}
      {showSwitcher && !focus && (Platform.OS === 'web' || !compactHeader) ? (
        <View
          {...mi('ge640')}
          style={[styles.switcherRow, switcherPending && styles.switcherPending]}
          {...(switcherPending ? PENDING_A11Y : null)}
        >
          <ChatbotSwitcher
            chatbots={switcherPending ? ALL_CHATBOTS : availableChatbots}
            value={chatbot}
            onChange={handleSwitchChatbot}
            disabled={isLoading || switcherPending}
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
          <Icon name="bookOpen" size={15} color={tokens.colors.accentDeep} />
          <Text style={styles.guestBannerText} numberOfLines={2}>
            {guestUsed
              ? 'Essai gratuit · Sources accessibles'
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
          {/* Fermeture dans le panneau : sur téléphone, le bouton bascule n'est plus dans l'en-tête. */}
          <View style={styles.sourcesPaneHeader}>
            <Text style={styles.sourcesPaneTitle}>Sources ({latestSources.length})</Text>
            <Touchable
              onPress={() => setSourcesOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Fermer les sources"
              style={styles.sourcesPaneClose}
            >
              <Icon name="x" size={16} color={tokens.colors.textMuted} />
              <Text style={styles.sourcesPaneCloseText}>Fermer</Text>
            </Touchable>
          </View>
          <SourcesBlock
            sources={latestSources}
            startOpen
            onOpenSource={openSourceDetail}
          />
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
        testID="chat-thread"
        style={styles.messages}
        contentContainerStyle={[styles.messagesContent, showEmptyState && styles.messagesContentEmpty]}
        onScroll={handleThreadScroll}
        scrollEventThrottle={80}
        onContentSizeChange={handleThreadGrow}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && !isLoading ? (
          <Reveal style={styles.emptyState}>

            <Text style={styles.emptyTitle} accessibilityRole="header" aria-level={2}>
              {personalInfo?.firstName
                ? `Bonjour ${personalInfo.firstName}, ${EMPTY_TITLE_NAMED[chatbot]}`
                : EMPTY_TITLE[chatbot]}
            </Text>
            <Text style={styles.emptyText}>{meta.description}.</Text>
            {/* Pastille d'essai invité : remplace le bandeau du haut sur l'état vide. */}
            {isGuest ? (
              <View style={styles.trialPill}>
                <Icon name="bookOpen" size={13} color={tokens.colors.accentDeep} />
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
              style={[styles.starterColumn, !starterOrderReady && styles.starterColumnPending]}
              onHoverIn={() => setSuggestionsPaused(true)}
              onHoverOut={() => setSuggestionsPaused(false)}
              // Simple zone de survol : pas un arrêt de tabulation (chaque suggestion l'est).
              // react-native-web lit `tabIndex` sur Pressable (pas `focusable`).
              tabIndex={-1}
            >
              {starters.map((s) => (
                <Touchable
                  key={s}
                  style={[styles.starterChip, guestLocked && styles.starterChipDisabled]}
                  onPress={() => void sendText(s)}
                  disabled={guestLocked}
                  accessibilityRole="button"
                  aria-disabled={guestLocked}
                >
                  <Text style={styles.starterChipText}>{s}</Text>
                  <Icon name="arrowRight" size={tokens.size.iconSm} color={tokens.colors.textMuted} />
                </Touchable>
              ))}
            </Pressable>
          </Reveal>
        ) : null}

        {(pendingMessage ? [...messages, pendingMessage] : messages).map((m) => (
          <View key={m.id}>
            <MessageRow
              message={m}
              onSend={sendText}
              disabled={isLoading || recovering}
              streaming={status === 'streaming' && m.id === activeAssistant?.id}
              onOpenSource={openSourceDetail}
              isLastAssistant={m.role === 'assistant' && m.id === lastAssistant?.id}
              onRegenerate={handleRegenerate}
              onExport={exportResponse}
            />
          </View>
        ))}
        {(showStatus || recovering) && (
          <View style={styles.statusStack}>
            {/* Trace des étapes déjà franchies, dérivée des parts d'outil du message
                en cours (recherche web du provider). */}
            {!recovering ? (
              <ProgressTrace steps={summarizeChatProgress(activeAssistant?.parts)} />
            ) : null}
            <StatusBubble
              phase={recovering ? 'recovering' : phase}
              toolLabel={activeToolLabel(activeAssistant)}
              startedAt={waitStartedAt}
              guest={isGuest}
            />
            {foundSources.map(source => <Touchable key={source.url} accessibilityRole="link" accessibilityLabel={`Source trouvée : ${source.title}`} style={styles.messageActionButton} onPress={() => void Linking.openURL(source.url)}><Icon name="externalLink" size={tokens.size.iconSm} color={tokens.colors.accent} /><Text style={styles.messageActionText}>{source.title}</Text></Touchable>)}
          </View>
        )}

        {/* ── Passerelles étudiant : prolonger la révision avec les outils du rôle ── */}
        {chatbot === 'student' && !isLoading && lastAssistant && user ? (
          <View style={styles.bridgeRow}>
            <Text style={styles.bridgeLabel}>Continuer avec</Text>
            {isFeatureVisible('ecos', persona, { isAdmin }) ? (
              <Touchable
                style={styles.bridgeChip}
                onPress={() => router.push('/(chat)/ecos' as never)}
                accessibilityRole="link"
                accessibilityLabel="S'entraîner sur un cas ECOS" {...(Platform.OS === 'web' ? { title: "S'entraîner sur un cas ECOS" } : {})}
              >
                <Icon name="stethoscope" size={14} color={tokens.colors.accentDeep} />
                <Text style={styles.bridgeChipText}>S’entraîner (ECOS)</Text>
              </Touchable>
            ) : null}
            {isFeatureVisible('revision', persona, { isAdmin }) ? (
              <Touchable
                style={styles.bridgeChip}
                onPress={() => router.push('/(chat)/revision' as never)}
                accessibilityRole="link"
                accessibilityLabel="Planifier mes révisions" {...(Platform.OS === 'web' ? { title: 'Planifier mes révisions' } : {})}
              >
                <Icon name="calendarCheck" size={14} color={tokens.colors.accentDeep} />
                <Text style={styles.bridgeChipText}>Planifier (Révisions)</Text>
              </Touchable>
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
                connectez-vous pour continuer et enregistrer vos prochaines conversations.
              </Text>
              <View style={[styles.guestCtaActions, compactHeader && styles.guestCtaActionsCompact]}>
                <Button
                  label="Créer un compte gratuit"
                  size="md"
                  fullWidth={compactHeader}
                  onPress={() => router.push('/(auth)/sign-in?mode=signup' as never)}
                />
                <Button
                  label="Se connecter"
                  variant="secondary"
                  size="md"
                  fullWidth={compactHeader}
                  onPress={() => router.push('/(auth)/sign-in' as never)}
                />
              </View>
            </View>
          </Reveal>
        ) : null}

        <Text style={styles.srOnly} accessibilityLiveRegion="polite">
          {responseAnnouncement}
        </Text>

        {/* ── Note honnête après un arrêt volontaire (le serveur archive la réponse
            complète — résilience hors-ligne) ── */}
        {stoppedNotice && !isLoading && !error ? (
          <View style={styles.stoppedNotice} accessibilityLiveRegion="polite">
            <Icon name="clock" size={14} color={tokens.colors.textMuted} />
            <Text style={styles.stoppedNoticeText}>
              {isGuest ? 'Lecture interrompue. Le texte déjà reçu reste affiché dans cet onglet.' : 'Lecture interrompue. Le texte déjà reçu reste affiché. Une réponse complète peut être disponible ensuite dans l’historique.'}
            </Text>
          </View>
        ) : null}

        {error && !recovering && errorKind === 'session' && (
          <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>
              Votre session a expiré : reconnectez-vous pour continuer la conversation.
            </Text>
            <Button
              label="Se reconnecter"
              variant="secondary"
              size="md"
              fullWidth={false}
              leftIcon={<Icon name="userRound" size={tokens.size.iconSm} color={tokens.colors.textSubtle} />}
              onPress={() => router.push('/(auth)/sign-in' as never)}
              style={styles.retryButton}
            />
          </View>
        )}
        {preparationError ? <View style={styles.errorBanner} accessibilityLiveRegion="polite"><Text style={styles.errorText}>{preparationError}</Text><Button label="Réessayer" accessibilityLabel="Réessayer l’envoi" variant="secondary" size="md" fullWidth={false} leftIcon={<Icon name="refresh" size={tokens.size.iconSm} color={tokens.colors.textSubtle} />} onPress={() => void sendText(draftRef.current)} style={styles.retryButton} /></View> : null}
        {/* ── Tour resté sans réponse (réflexion qui a épuisé son budget, flux clos sans
            archive) : le dire et proposer de relancer — document compris ── */}
        {unansweredTurn && !isLoading && !recovering && !error ? (
          <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>
              {turnAttachmentRef.current
                ? 'La réponse n’a pas pu être rédigée. Réessayez : votre question et votre document seront renvoyés.'
                : 'La réponse n’a pas pu être rédigée. Réessayez : votre question sera renvoyée.'}
            </Text>
            <Button
              label="Réessayer"
              accessibilityLabel="Réessayer la dernière question"
              variant="secondary"
              size="md"
              fullWidth={false}
              leftIcon={<Icon name="refresh" size={tokens.size.iconSm} color={tokens.colors.textSubtle} />}
              onPress={() => void handleRetry()}
              style={styles.retryButton}
            />
          </View>
        ) : null}
        {error && !recovering && errorKind === 'generic' && (
          <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>
              Une erreur est survenue ; la réponse a peut-être été interrompue.
            </Text>
            <Button
              label="Réessayer"
              accessibilityLabel="Réessayer la dernière question"
              variant="secondary"
              size="md"
              fullWidth={false}
              leftIcon={<Icon name="refresh" size={tokens.size.iconSm} color={tokens.colors.textSubtle} />}
              onPress={() => void handleRetry()}
              style={styles.retryButton}
            />
          </View>
        )}
      </ScrollView>

      {/* ── Bouton « revenir en bas » (fil remonté pendant/après une réponse) ── */}
      {!atBottom && !showEmptyState ? (
        <Touchable
          style={styles.scrollDownButton}
          onPress={() => scrollToBottom()}
          accessibilityRole="button"
          accessibilityLabel="Revenir en bas de la conversation" {...(Platform.OS === 'web' ? { title: 'Revenir en bas de la conversation' } : {})}
        >
          <Icon name="chevronDown" size={tokens.size.iconSm} color={tokens.colors.accentDeep} /><Text style={styles.messageActionText}>Revenir en bas</Text>
        </Touchable>
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
            <Touchable
              onPress={() => router.push('/(chat)/document' as never)}
              accessibilityRole="link"
              accessibilityLabel="Ouvrir l'outil Analyse de document" {...(Platform.OS === 'web' ? { title: "Ouvrir l'outil Analyse de document" } : {})}
              style={styles.docHintAction}
            >
              <Text style={styles.docHintActionText}>Ouvrir</Text>
            </Touchable>
            <Touchable
              onPress={() => setDocHintDismissed(true)}
              accessibilityRole="button"
              accessibilityLabel="Masquer la suggestion" {...(Platform.OS === 'web' ? { title: 'Masquer la suggestion' } : {})}
              style={styles.docHintClose}
            >
              <Icon name="x" size={13} color={tokens.colors.textMuted} />
            </Touchable>
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
              accessibilityLabel="Retirer le document" {...(Platform.OS === 'web' ? { title: 'Retirer le document' } : {})}
              hitSlop={8}
            >
              <Icon name="x" size={14} color={tokens.colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
        {attachError ? <Text style={styles.attachError}>{attachError}</Text> : null}
        <View style={[styles.composer, inputFocused && styles.composerFocused]}>
          <TextInput
            style={[styles.input, focus && styles.inputFocusMode, { height: inputHeight }]}
            accessibilityLabel="Votre question" {...(Platform.OS === 'web' ? { title: 'Votre question' } : {})}
            value={input}
            onChangeText={(text) => {
              setInput(text);
              // Sur le web, la hauteur mesurée ne redescend jamais sous la hauteur courante
              // (scrollHeight) : on la remet à une ligne quand le champ est vidé.
              if (!text) setInputHeight(INPUT_MIN_HEIGHT);
            }}
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
            numberOfLines={1}
            onContentSizeChange={(e) => {
              // Une ligne à vide, puis la zone grandit avec le texte jusqu'à INPUT_MAX_HEIGHT
              // (le fil garde la place sur téléphone ; au-delà, défilement interne).
              const next = Math.min(
                INPUT_MAX_HEIGHT,
                Math.max(INPUT_MIN_HEIGHT, Math.ceil(e.nativeEvent.contentSize.height)),
              );
              setInputHeight((h) => (h === next ? h : next));
            }}
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
                accessibilityLabel="Joindre un document" {...(Platform.OS === 'web' ? { title: 'Joindre un document' } : {})}
                disabled={isLoading}
                style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
                  composerButtonStyles.button,
                  hovered && composerButtonStyles.hover,
                  pressed && composerButtonStyles.pressed,
                  focused && composerButtonStyles.focus,
                  isLoading && composerButtonStyles.disabled,
                ]}
              >
                <Icon name="paperclip" size={COMPOSER_ICON_SIZE} color={composerIconColor()} />
              </Pressable>
            ) : null}
            {/* Session connue seulement : pendant l'amorçage, le micro apparaissait puis
                disparaissait chez l'invité (icônes voisines décalées deux fois). */}
            {session ? (
              <DictationButton
                onTranscript={(text) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
                disabled={isLoading}
              />
            ) : null}
            {/* Mobile : profondeur (🧠) + outils (🧰) compacts, intégrés à la barre. */}
            {!guestLocked ? (
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
                accessibilityLabel="Arrêter la génération" {...(Platform.OS === 'web' ? { title: 'Arrêter la génération' } : {})}
                style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
                  composerButtonStyles.send,
                  composerButtonStyles.stop,
                  focused && composerButtonStyles.focus,
                  pressed && composerButtonStyles.sendPressed,
                ]}
              >
                <Icon name="stop" size={16} color={tokens.colors.onAccent} />
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Envoyer le message" {...(Platform.OS === 'web' ? { title: 'Envoyer le message' } : {})}
                aria-disabled={!canSend}
                style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
                  composerButtonStyles.send,
                  !canSend && composerButtonStyles.sendDisabled,
                  canSend && hovered && composerButtonStyles.sendHover,
                  canSend && focused && composerButtonStyles.focus,
                  canSend && pressed && composerButtonStyles.sendPressed,
                ]}
              >
                <Icon name="arrowUp" size={COMPOSER_ICON_SIZE} color={canSend ? tokens.colors.onAccent : tokens.colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
        <Text style={styles.disclaimer}>Système d’intelligence artificielle. {DISCLAIMER[chatbot]} En cas d’urgence : 15 ou 112.</Text>
      </View>
      </View>
      </View>
      </MarkdownTextSizeContext.Provider>

      <SourceDetailModal
        source={detailSource}
        onClose={() => setDetailSource(null)}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Texte réservé aux lecteurs d'écran (annonce de fin de réponse).
  srOnly: { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden', opacity: 0 },
  container: { flex: 1, backgroundColor: tokens.colors.background },
  // Desktop shell : colonne d'historique persistante + écran de chat (D5).
  screenRow: { flex: 1, flexDirection: 'row', minHeight: 0 },
  screenMain: { flex: 1, minWidth: 0 },
  historyRail: {
    width: tokens.layout.history,
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
  historyCollapseBtn: { minHeight: tokens.size.controlMd,
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
  docHintAction: { minHeight: tokens.size.controlMd, justifyContent: 'center',
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accentVivid,
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
  chatHeaderCompact: { flexDirection: 'column', alignItems: 'stretch' },
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
  // Hauteurs de ligne explicites (= rendu avec les polices web) : sans elles, l'arrivée
  // des polices faisait grandir l'en-tête de 5 px et décalait tout le fil (CLS mobile).
  chatTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  sourcesPaneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourcesPaneTitle: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    color: tokens.colors.text,
  },
  sourcesPaneClose: {
    minHeight: tokens.size.controlMd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: tokens.space.sm,
  },
  sourcesPaneCloseText: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, color: tokens.colors.textMuted },
  focusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingBottom: tokens.space.xs,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  focusTitle: {
    flex: 1,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    color: tokens.colors.textMuted,
    textAlign: 'center',
  },
  chatSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 16,
    marginTop: 2,
  },
  switcherRow: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  // Web : `visibility: hidden` garde la place, retire de l'arbre d'accessibilité et de la
  // tabulation ; natif : transparence (les props PENDING_A11Y masquent au lecteur d'écran).
  switcherPending: (Platform.OS === 'web' ? { visibility: 'hidden' } : { opacity: 0 }) as ViewStyle,
  // ── Essai sans inscription (bandeau + indicateur 1/1 → 0/1) ──
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.surfaceAlt,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
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
  guestBadgeUsed: { backgroundColor: tokens.colors.surfaceSunken },
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
    backgroundColor: tokens.colors.surfaceAlt,
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
  guestCtaActionsCompact: { flexDirection: 'column', alignItems: 'stretch' },

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
    maxWidth: tokens.layout.reading,
    alignSelf: 'center',
  },
  // État vide : accroche + suggestions centrées verticalement (comme les chats de référence).
  messagesContentEmpty: { flexGrow: 1, justifyContent: 'center' },

  scrollDownButton: {
    position: 'absolute',
    bottom: tokens.space.md,
    alignSelf: 'center',
    minHeight: tokens.size.controlMd,
    paddingHorizontal: tokens.space.md,
    flexDirection: 'row',
    gap: tokens.space.sm,
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
    maxWidth: tokens.layout.form,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'flex-start',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: tokens.space.xs,
  },
  emptyTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h1.fontSize,
    lineHeight: tokens.type.h1.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
    textAlign: 'left',
  },
  emptyText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    textAlign: 'left',
  },
  starterColumn: { gap: tokens.space.sm, marginTop: tokens.space.md, alignSelf: 'stretch' },
  starterColumnPending: { opacity: 0 },
  // Suggestion = ligne cliquable à part entière : filet léger, marge intérieure, flèche
  // centrée (elle flottait au-dessus du texte). Survol/appui : couche d'état de <Touchable>.
  starterChip: {
    minHeight: tokens.size.controlMd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.border.thin,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
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
    backgroundColor: tokens.colors.surfaceAlt,
    ...tokens.elevation.sm,
  },
  textUser: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },

  // Réponse assistant : posée pleine largeur sur le fond, sans bulle bordée —
  // le contenu (texte, sources, propositions) occupe l'espace de lecture.
  assistantRow: { alignSelf: 'stretch', gap: tokens.space.sm },
  // Marge négative : le libellé du premier bouton reste aligné sur le texte de la réponse,
  // tandis que chaque bouton a sa propre marge intérieure (fond arrondi au survol).
  messageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.space.xs,
    marginLeft: -tokens.space.sm,
  },
  messageActionButton: {
    minHeight: tokens.size.controlMd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs + 2,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.sm,
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
  statusHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption?.fontSize ?? 11,
    lineHeight: 16,
    marginTop: tokens.space.xs,
    marginLeft: tokens.space.sm,
    maxWidth: 420,
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
  bridgeChip: { minHeight: tokens.size.controlMd,
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
  retryButton: { alignSelf: 'flex-start', marginTop: tokens.space.md },

  // ── Composer unifié (motif ChatGPT/Claude : une carte, texte + actions) ──
  composerZone: {
    width: '100%',
    maxWidth: tokens.layout.reading,
    alignSelf: 'center',
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.xs,
    paddingBottom: tokens.space.sm,
    gap: tokens.space.xs + 2,
  },
  composer: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.sm,
    paddingTop: tokens.space.xs,
    paddingBottom: tokens.space.sm,
    gap: tokens.space.xs,

    ...tokens.motion.transitionWeb,
  },
  // Focus du champ : bordure accent + halo doux (l'anneau de focus standard doublait la
  // bordure en un cadre bleu épais autour de toute la carte — retour Hugo 2026-10).
  composerFocused: {
    borderColor: tokens.colors.accent,
    ...(Platform.select({
      web: { boxShadow: `0 0 0 3px ${tokens.colors.accentSurfaceStrong}`, outlineStyle: 'none' } as object,
      default: {},
    }) as object),
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs, // boutons ronds sans bordure : leur fond au survol fait l'espacement
    paddingHorizontal: tokens.space.xs,
  },
  composerSpacer: { flex: 1 },
  attachmentChip: { minHeight: tokens.size.controlMd,
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
    minHeight: INPUT_MIN_HEIGHT,
    maxHeight: INPUT_MAX_HEIGHT,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    color: tokens.colors.text,
    fontFamily: tokens.font.sans,
    // 16 px minimum : en dessous, Safari iPhone zoome toute la page au toucher du champ.
    fontSize: 16,
    lineHeight: tokens.type.body.lineHeight,
    // Le focus est porté par la carte du composer, pas par le champ lui-même.
    ...(Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }) as object),
  },
  // Plein écran : taille de l'app Messages (17 px).
  inputFocusMode: { fontSize: 17, lineHeight: 24 },
  disclaimer: {
    fontFamily: tokens.font.sans,
    textAlign: 'center',
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 16, // = rendu avec la police web ; stable à l'arrivée des polices
    color: tokens.colors.textMuted,
    paddingHorizontal: tokens.space.xs, // largeur pleine : 2 lignes au lieu de 3 sur téléphone
  },
});
