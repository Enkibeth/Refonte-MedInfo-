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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isTextUIPart } from 'ai';
import type { UIMessage } from 'ai';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import type { ChatbotId } from '@/ai/chat/chatContext';
import { parseAssistantMessage } from '@/ai/chat/parseAssistantMessage';
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
import { tokens } from '@/ui/tokens';
import { DictationButton } from '@/ui/DictationButton';
import { ToolsMenu } from '@/ui/ToolsMenu';
import { Icon } from '@/ui/icons';
import { Reveal } from '@/ui/Reveal';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { AssistantBlocks, SourcesBlock } from '@/ui/chat/AssistantBlocks';
import { ChatbotSwitcher, CHATBOT_META } from '@/ui/chat/ChatbotSwitcher';
import { HistoryPanel } from '@/ui/chat/HistoryPanel';

// ── Suggestions d'amorce par chatbot (état vide) ───────────────────────────────

const STARTER_SUGGESTIONS: Record<ChatbotId, string[]> = {
  public: [
    'Que signifie une TSH élevée sur une prise de sang ?',
    "J'ai mal à la gorge depuis 3 jours, que faire ?",
    'Comment préparer ma consultation chez le cardiologue ?',
  ],
  student: [
    "Explique-moi la physiopathologie de l'insuffisance cardiaque",
    'Fais-moi un cours sur la pyélonéphrite aiguë (item 161)',
    'Quels sont les critères diagnostiques de la maladie de Horton ?',
  ],
  professional: [
    'Anticoagulation en FA chez le sujet âgé insuffisant rénal ?',
    "Stratégie diagnostique devant une suspicion d'EP chez la femme enceinte",
    'Relais AVK → DOAC : modalités pratiques ?',
  ],
};

const DISCLAIMER: Record<ChatbotId, string> = {
  public: 'Information générale — ne remplace pas un avis médical individuel.',
  student: 'Support de révision — ne remplace pas les référentiels ni la pratique encadrée.',
  professional: "Outil d'aide à la décision — la décision finale appartient au clinicien.",
};

// ── Indicateur de frappe ───────────────────────────────────────────────────────

function TypingDots() {
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
    <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]} accessibilityLabel="Rédaction en cours">
      <View style={styles.typingRow}>
        {[d0, d1, d2].map((v, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0.45, 1], outputRange: [1, -2] }) }] }]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Message ────────────────────────────────────────────────────────────────────

function messageText(message: UIMessage): string {
  return (message.parts ?? []).filter(isTextUIPart).map((p) => p.text).join('');
}

function MessageBubble({
  message,
  onSend,
  disabled,
}: {
  message: UIMessage;
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const isUser = message.role === 'user';
  const text = messageText(message);
  if (!text.trim()) return null;

  if (isUser) {
    return (
      <View style={[styles.bubble, styles.bubbleUser]}>
        <Text style={styles.textUser}>{text}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bubble, styles.bubbleAssistant]}>
      <AssistantBlocks text={text} onSend={onSend} disabled={disabled} />
    </View>
  );
}

// ── Écran principal ────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { user, session, persona, personalInfo } = useSession();
  const insets = useSafeAreaInsets();
  const isAdmin = user ? isAdminUserId(user.id) : false;

  const canSwitch = isAdmin || persona === 'student' || persona === 'professional';
  const availableChatbots: ChatbotId[] = canSwitch ? ['public', 'student', 'professional'] : ['public'];
  const defaultChatbot: ChatbotId =
    persona === 'student' || persona === 'professional' ? persona : 'public';

  const [chatbot, setChatbot] = useState<ChatbotId>(defaultChatbot);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Le profil charge après le premier rendu : aligne le chatbot par défaut une fois connu.
  const personaInitialized = useRef(false);
  useEffect(() => {
    if (persona && !personaInitialized.current) {
      personaInitialized.current = true;
      setChatbot(defaultChatbot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona]);

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

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: (): Record<string, string> =>
          tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        body: () => ({
          chatbot: chatbotRef.current,
          personalInfo: personalInfoRef.current ?? undefined,
        }),
      }),
    [],
  );

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    setConversations(await listConversations(user.id));
  }, [user]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    onFinish: async ({ message }) => {
      const text = messageText(message);
      const convId = conversationIdRef.current;
      const uid = user?.id;
      if (!convId || !uid || !text.trim()) return;
      await saveMessage(convId, uid, 'assistant', text);
      if (!titleGeneratedRef.current && tokenRef.current) {
        titleGeneratedRef.current = true;
        await generateConversationMeta(convId, tokenRef.current, firstUserTextRef.current, text.slice(0, 1500));
      }
      void refreshConversations();
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';
  const canSend = !isLoading && input.trim().length > 0;

  // Sources de la dernière réponse (onglet global dans l'en-tête).
  const latestSources = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return [];
    return parseAssistantMessage(messageText(lastAssistant)).sources;
  }, [messages]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

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
      sendMessage({ text: trimmed });
    },
    [sendMessage, user],
  );

  const handleSend = () => {
    if (!canSend) return;
    const text = input;
    setInput('');
    void sendText(text);
  };

  const startNewConversation = useCallback(
    (nextChatbot?: ChatbotId) => {
      setMessages([]);
      conversationIdRef.current = null;
      setConversationId(null);
      titleGeneratedRef.current = false;
      firstUserTextRef.current = '';
      setSourcesOpen(false);
      setHistoryOpen(false);
      if (nextChatbot) setChatbot(nextChatbot);
    },
    [setMessages],
  );

  const handleSwitchChatbot = (next: ChatbotId) => {
    if (next === chatbot) return;
    // Changer de chatbot = changer d'interlocuteur : on repart sur une conversation propre.
    startNewConversation(next);
  };

  const openConversation = useCallback(
    async (c: ChatConversation) => {
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
    [availableChatbots, setMessages],
  );

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
              onPress={handleExportPdf}
              accessibilityRole="button"
              accessibilityLabel="Exporter la conversation en PDF"
            >
              <Icon name="download" size={17} color={tokens.colors.accentDeep} />
            </TouchableOpacity>
          ) : null}
          {latestSources.length > 0 ? (
            <TouchableOpacity
              style={[styles.headerIconButton, sourcesOpen && styles.headerIconButtonActive]}
              onPress={() => setSourcesOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={`Sources (${latestSources.length})`}
            >
              <Icon
                name="bookOpen"
                size={17}
                color={sourcesOpen ? tokens.colors.onAccent : tokens.colors.accentDeep}
              />
              <View style={styles.sourcesCountBadge}>
                <Text style={styles.sourcesCountText}>{latestSources.length}</Text>
              </View>
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

      {/* ── Onglet sources global ── */}
      {sourcesOpen && latestSources.length > 0 ? (
        <View style={styles.sourcesPane}>
          <SourcesBlock sources={latestSources} startOpen />
        </View>
      ) : null}

      <HistoryPanel
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversations={conversations}
        activeId={conversationId}
        onSelect={(c) => void openConversation(c)}
        onDelete={(id) => void handleDeleteConversation(id)}
        onNew={() => startNewConversation()}
      />

      {/* ── Fil de messages ── */}
      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
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
              {STARTER_SUGGESTIONS[chatbot].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.starterChip}
                  onPress={() => void sendText(s)}
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
            <MessageBubble message={m} onSend={(t) => void sendText(t)} disabled={isLoading} />
          </Reveal>
        ))}
        {status === 'submitted' && <TypingDots />}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Une erreur est survenue. Veuillez réessayer.</Text>
          </View>
        )}
      </ScrollView>

      <Text style={styles.disclaimer}>{DISCLAIMER[chatbot]}</Text>

      {/* ── Saisie ── */}
      <View style={styles.inputRow}>
        <DictationButton
          onTranscript={(text) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
          disabled={isLoading}
        />
        <TextInput
          style={[styles.input, inputFocused && styles.inputFocused]}
          value={input}
          onChangeText={setInput}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder={
            chatbot === 'student'
              ? 'Une notion, un item EDN, un mécanisme…'
              : chatbot === 'professional'
                ? 'Votre question clinique…'
                : 'Posez une question sur la santé…'
          }
          placeholderTextColor={tokens.colors.textMuted}
          multiline
          editable={!isLoading}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
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
          <Icon name="arrowUp" size={20} color={tokens.colors.onAccent} />
        </Pressable>
      </View>
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
  sourcesCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accent,
    borderWidth: 1.5,
    borderColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourcesCountText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: 10,
    fontWeight: tokens.weight.bold,
    lineHeight: 13,
  },
  chatTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
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
  sourcesPane: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.surfaceAlt,
    maxHeight: 360,
  },
  messages: { flex: 1 },
  messagesContent: { padding: tokens.space.lg, gap: tokens.space.md },

  emptyState: {
    marginTop: tokens.space['2xl'],
    paddingHorizontal: tokens.space.lg,
    gap: tokens.space.sm,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
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
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  emptyText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  starterColumn: { gap: tokens.space.sm, marginTop: tokens.space.md },
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

  bubble: {
    maxWidth: '92%',
    borderRadius: tokens.radius.lg,
    padding: tokens.space.md,
    gap: tokens.space.sm,
    overflow: 'hidden',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colors.accent,
    borderBottomRightRadius: tokens.radius.xs,
    ...tokens.elevation.sm,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderBottomLeftRadius: tokens.radius.xs,
    ...tokens.elevation.sm,
  },
  textUser: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },

  typingBubble: { paddingVertical: tokens.space.md, paddingHorizontal: tokens.space.lg },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs + 2 },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.textMuted,
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

  disclaimer: {
    fontFamily: tokens.font.sans,
    textAlign: 'center',
    fontSize: tokens.type.caption.fontSize,
    color: tokens.colors.textMuted,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.surfaceAlt,
    borderTopWidth: 1,
    borderColor: tokens.colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    padding: tokens.space.md,
    gap: tokens.space.sm,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: tokens.size.controlMd,
    maxHeight: 120,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    color: tokens.colors.text,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    ...tokens.motion.transitionWeb,
  },
  inputFocused: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.surface,
    ...tokens.focus.ring,
  },
  sendButton: {
    width: tokens.size.controlMd,
    height: tokens.size.controlMd,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
  },
  sendButtonHover: { backgroundColor: tokens.colors.accentStrong, transform: [{ translateY: -1 }], ...tokens.elevation.md },
  sendButtonFocus: tokens.focus.ring,
  sendButtonPressed: { transform: [{ scale: 0.94 }], opacity: 0.95 },
  sendButtonDisabled: {
    backgroundColor: tokens.colors.borderStrong,
    ...Platform.select({ web: { boxShadow: 'none' } as object, default: {} }),
  },
});
