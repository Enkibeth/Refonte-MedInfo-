/**
 * Écran chat avec streaming (AI SDK v6 useChat + DefaultChatTransport).
 * Rendu natif des tool-calls : propose_followups → boutons,
 * show_sources → panneau toggleable, refuse_and_redirect → bannière refus.
 * Disclaimer permanent conforme 01_REGULATION §4.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
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
import { DefaultChatTransport, isTextUIPart, isToolUIPart } from 'ai';
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from 'ai';

import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/tokens';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { DictationButton } from '@/ui/DictationButton';
import { ToolsMenu } from '@/ui/ToolsMenu';
import { ChatSettingsSheet } from '@/ui/ChatSettingsSheet';
import { ReflectionCard } from '@/ui/ReflectionCard';
import { Reveal } from '@/ui/Reveal';
import { Icon } from '@/ui/icons';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { collectLatestCitations, type Citation } from '@/ai/ui/chatSources';
import { splitReflection } from '@/ai/ui/reflection';
import { DEFAULT_GENERATION, type GenerationSettings } from '@/ai/chat/generationSettings';

// ── Types tool-call ────────────────────────────────────────────────────────

interface QcmPayload {
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
  item_edn: number;
  college: string;
}


// ── Composants tool-call ───────────────────────────────────────────────────

function FollowupButtons({
  suggestions,
  onSelect,
}: {
  suggestions: string[];
  onSelect: (s: string) => void;
}) {
  return (
    <View style={styles.followupContainer}>
      {suggestions.map((s, i) => (
        <TouchableOpacity
          key={i}
          accessibilityRole="button"
          style={styles.followupButton}
          onPress={() => onSelect(s)}
        >
          <Text style={styles.followupText}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <View
      style={[styles.chevron, open ? styles.chevronOpen : styles.chevronClosed]}
      accessibilityElementsHidden
    />
  );
}

function SourcesPanel({
  citations,
  defaultOpen = false,
}: {
  citations: Citation[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.sourcesWrapper}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        style={styles.sourcesToggle}
        accessibilityRole="button"
      >
        <Chevron open={open} />
        <Text style={styles.sourcesToggleText}>Sources ({citations.length})</Text>
      </TouchableOpacity>
      {open &&
        citations.map((c, i) => (
          <View key={i} style={styles.citation}>
            <Text style={styles.citationTitle}>
              {c.title} — {c.emitter}
            </Text>
            {c.url ? <Text style={styles.citationUrl}>{c.url}</Text> : null}
            {c.excerpt ? <Text style={styles.citationExcerpt}>{c.excerpt}</Text> : null}
          </View>
        ))}
    </View>
  );
}


function QcmCard({ qcm }: { qcm: QcmPayload }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const answered = selectedIndex !== null;

  return (
    <View style={styles.qcmCard}>
      <Text style={styles.qcmMeta}>
        QCM · {qcm.college} · Item EDN {qcm.item_edn}
      </Text>
      <Text style={styles.qcmStem}>{qcm.stem}</Text>
      {qcm.options.map((option, index) => {
        const isSelected = selectedIndex === index;
        const isCorrect = qcm.correct_index === index;
        return (
          <TouchableOpacity
            key={index}
            accessibilityRole="button"
            style={[
              styles.qcmOption,
              answered && isCorrect && styles.qcmOptionCorrect,
              answered && isSelected && !isCorrect && styles.qcmOptionWrong,
            ]}
            onPress={() => setSelectedIndex(index)}
          >
            <Text style={styles.qcmOptionText}>
              {/* Indice par lettre + couleur + texte : info jamais portée par la seule couleur (05_DESIGN §7). */}
              {answered && isCorrect ? '✓ ' : answered && isSelected && !isCorrect ? '✗ ' : ''}
              {String.fromCharCode(65 + index)}. {option}
            </Text>
          </TouchableOpacity>
        );
      })}
      {answered ? (
        <Text style={styles.qcmExplanation}>
          Réponse : {String.fromCharCode(65 + qcm.correct_index)} — {qcm.explanation}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Indicateur de frappe : trois points qui pulsent en cascade, présenté comme une
 * bulle assistant. Affiché pendant l'attente du premier token (statut `submitted`).
 * Mouvement sobre (opacité + 2 px), coupé sous prefers-reduced-motion (§4).
 */
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
          Animated.timing(v, {
            toValue: 1,
            duration: 420,
            delay,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.45,
            duration: 420,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    const anims = [pulse(d0, 0), pulse(d1, 140), pulse(d2, 280)];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [reduced, d0, d1, d2]);

  return (
    <View
      style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}
      accessibilityLabel="Rédaction en cours"
      accessibilityRole="text"
    >
      <View style={styles.typingRow}>
        {[d0, d1, d2].map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.typingDot,
              {
                opacity: v,
                transform: [
                  { translateY: v.interpolate({ inputRange: [0.45, 1], outputRange: [1, -2] }) },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function RefusalBanner({ message }: { message: string }) {
  return (
    <View style={styles.refusalBanner}>
      <Text style={styles.refusalText}>{message}</Text>
    </View>
  );
}

// ── Rendu d'une part message ───────────────────────────────────────────────

function MessagePart({
  part,
  onFollowup,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
  onFollowup: (s: string) => void;
}) {
  if (isTextUIPart(part)) {
    return null; // rendu en dehors (cf MessageBubble)
  }

  if (isToolUIPart(part)) {
    const dynPart = part as any;
    // L'état d'un tool-call terminé en AI SDK v6 est 'output-available' (pas 'output').
    // Sans ce correctif, AUCUN tool-call ne s'affichait (sources, refus, suggestions).
    if (typeof dynPart.state !== 'string' || !dynPart.state.startsWith('output')) return null;

    const toolName: string = dynPart.toolName ?? dynPart.type?.replace('tool-', '') ?? '';
    const output = dynPart.output;

    if (toolName === 'propose_followups' && output?.suggestions) {
      return (
        <FollowupButtons suggestions={output.suggestions} onSelect={onFollowup} />
      );
    }
    if (toolName === 'show_sources' && output?.citations) {
      return <SourcesPanel citations={output.citations} />;
    }
    if (toolName === 'render_qcm' && output?.stem && Array.isArray(output?.options)) {
      return <QcmCard qcm={output as QcmPayload} />;
    }
    if (toolName === 'refuse_and_redirect' && output?.message) {
      return <RefusalBanner message={output.message} />;
    }
  }

  return null;
}

// ── Rendu d'un message ─────────────────────────────────────────────────────

function MessageBubble({
  message,
  onFollowup,
}: {
  message: UIMessage;
  onFollowup: (s: string) => void;
}) {
  const isUser = message.role === 'user';
  const parts = (message.parts ?? []) as UIMessagePart<UIDataTypes, UITools>[];

  const textContent = parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join('');

  // Extrait l'éventuel bloc d'auto-réflexion pour le rendre dans une carte dédiée
  // (et ne jamais afficher les marqueurs bruts dans le corps de la réponse).
  const { body, reflection, streaming } = isUser
    ? { body: textContent, reflection: null, streaming: false }
    : splitReflection(textContent);

  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
      {body ? (
        isUser ? (
          <Text style={styles.textUser}>{body}</Text>
        ) : (
          <MarkdownRenderer text={body} />
        )
      ) : null}

      {parts.map((p, i) => (
        <MessagePart key={i} part={p} onFollowup={onFollowup} />
      ))}

      {reflection ? <ReflectionCard text={reflection} streaming={streaming} /> : null}
    </View>
  );
}

// ── Écran principal ────────────────────────────────────────────────────────

export default function ChatScreen() {
  // Persona issue de l'AuthProvider (source profiles/RLS, étape 3). Fallback 'public'
  // tant que la session/le profil charge ou pour un visiteur non authentifié.
  const { persona, personalInfo } = useSession();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generation, setGeneration] = useState<GenerationSettings>(DEFAULT_GENERATION);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const latestCitations = useMemo(() => collectLatestCitations(messages), [messages]);
  const isLoading = status === 'streaming' || status === 'submitted';
  const hasSources = latestCitations.length > 0;
  const canSend = !isLoading && input.trim().length > 0;

  // Corps de requête dynamique : persona + réglages utilisateur + contexte perso.
  // Passé à chaque envoi (le transport ne capture pas l'état React au fil des rendus).
  const requestBody = useMemo(
    () => ({
      persona: persona ?? 'public',
      generation,
      personalInfo: personalInfo ?? undefined,
    }),
    [persona, generation, personalInfo],
  );

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage({ text }, { body: requestBody });
  };

  const handleFollowup = (suggestion: string) => {
    sendMessage({ text: suggestion }, { body: requestBody });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={[styles.chatHeader, { paddingTop: tokens.space.md + insets.top }]}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {persona === 'student' ? 'Chat étudiant' : 'Chat santé'}
          </Text>
          <Text style={styles.chatSubtitle} numberOfLines={1}>
            Information générale et sourcée
          </Text>
        </View>
        <View style={styles.headerActions}>
          <ToolsMenu />
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setSettingsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Réglages du chat"
          >
            <Text style={styles.headerIconText}>⚙︎</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerIconButton,
              sourcesOpen && styles.headerIconButtonActive,
              !hasSources && styles.headerIconButtonDisabled,
            ]}
            onPress={() => setSourcesOpen((open) => !open)}
            disabled={!hasSources}
            accessibilityRole="button"
            accessibilityLabel={`Sources (${latestCitations.length})`}
          >
            <Icon
              name="bookOpen"
              size={18}
              color={
                sourcesOpen
                  ? tokens.colors.onAccent
                  : hasSources
                    ? tokens.colors.accentDeep
                    : tokens.colors.textMuted
              }
            />
            {hasSources ? (
              <View style={[styles.sourcesBadge, sourcesOpen && styles.sourcesBadgeOnAccent]}>
                <Text style={[styles.sourcesBadgeText, sourcesOpen && styles.sourcesBadgeTextOnAccent]}>
                  {latestCitations.length}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      <ChatSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        generation={generation}
        onChangeGeneration={setGeneration}
      />

      {sourcesOpen && hasSources ? (
        <View style={styles.sourcesPane}>
          <SourcesPanel citations={latestCitations} defaultOpen />
        </View>
      ) : null}

      <ScrollView
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 && !isLoading ? (
          <Reveal style={styles.emptyState}>
            <Image
              source={require('../../assets/brand/legacy-illustration.png')}
              style={styles.emptyIllustration}
              resizeMode="contain"
              accessibilityLabel="Illustration MedInfo AI : équipe soignante"
            />
            <Text style={styles.emptyTitle}>Posez votre première question</Text>
            <Text style={styles.emptyText}>
              Réponses claires, appuyées sur des sources (HAS, ANSM…). Information générale,
              jamais un avis médical individuel.
            </Text>
          </Reveal>
        ) : null}

        {messages.map((m) => (
          <Reveal key={m.id}>
            <MessageBubble message={m} onFollowup={handleFollowup} />
          </Reveal>
        ))}
        {status === 'submitted' && <TypingDots />}
        {error && (
          <View style={styles.refusalBanner}>
            <Text style={styles.refusalText}>Une erreur est survenue. Veuillez réessayer.</Text>
          </View>
        )}
      </ScrollView>

      {/* Disclaimer permanent (01_REGULATION §4) */}
      <Text style={styles.disclaimer}>
        Information générale — ne remplace pas un avis médical individuel.
      </Text>

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
          placeholder="Posez une question sur la santé…"
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
          <Icon name="arrowUp" size={20} color={canSend ? tokens.colors.onAccent : tokens.colors.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

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
  // Bloc titre élastique : se rétracte et tronque (ellipsis) au lieu de pousser
  // les actions hors de l'écran (bug « Sources » coupé en haut à droite).
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
  headerIconButtonDisabled: {
    backgroundColor: 'transparent',
    borderColor: tokens.colors.border,
  },
  headerIconText: {
    fontSize: 18,
    color: tokens.colors.accentDeep,
  },
  // Badge de compteur de sources, posé en coin du bouton-icône.
  sourcesBadge: {
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
  sourcesBadgeOnAccent: { backgroundColor: tokens.colors.onAccent, borderColor: tokens.colors.accent },
  sourcesBadgeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: 10,
    fontWeight: tokens.weight.bold,
    lineHeight: 13,
  },
  sourcesBadgeTextOnAccent: { color: tokens.colors.accentDeep },
  chatTitle: {
    fontFamily: tokens.font.sans,
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
  sourcesPane: { paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.sm, backgroundColor: tokens.colors.surfaceAlt },
  messages: { flex: 1 },
  messagesContent: { padding: tokens.space.lg, gap: tokens.space.md },

  emptyState: {
    marginTop: tokens.space['2xl'],
    paddingHorizontal: tokens.space.lg,
    gap: tokens.space.sm,
  },
  emptyIllustration: {
    width: '100%',
    maxWidth: 280,
    height: 180,
    alignSelf: 'center',
    borderRadius: tokens.radius.lg,
    marginBottom: tokens.space.sm,
  },
  emptyTitle: {
    fontFamily: tokens.font.sans,
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
    maxWidth: 460,
  },

  bubble: { maxWidth: '88%', borderRadius: tokens.radius.lg, padding: tokens.space.md, gap: tokens.space.sm, overflow: 'hidden' },
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
  textAssistant: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },

  followupContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm, marginTop: tokens.space.xs },
  followupButton: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
  },
  followupText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },

  sourcesWrapper: {
    marginTop: tokens.space.sm,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  sourcesToggle: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, padding: tokens.space.md },
  sourcesToggleText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  chevron: {
    width: 7,
    height: 7,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: tokens.colors.textMuted,
  },
  chevronClosed: { transform: [{ rotate: '-45deg' }] },
  chevronOpen: { transform: [{ rotate: '45deg' }] },
  citation: { padding: tokens.space.md, borderTopWidth: 1, borderColor: tokens.colors.border },
  citationTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  citationUrl: { fontFamily: tokens.font.sans, color: tokens.colors.accent, fontSize: 11, marginTop: 2 },
  citationExcerpt: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },

  qcmCard: {
    gap: tokens.space.sm,
    padding: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  qcmMeta: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 12,
    fontWeight: tokens.weight.medium,
  },
  qcmStem: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
    fontWeight: tokens.weight.semibold,
  },
  qcmOption: {
    borderRadius: tokens.radius.sm,
    padding: tokens.space.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  qcmOptionCorrect: { borderColor: tokens.colors.success, backgroundColor: tokens.colors.successBackground },
  qcmOptionWrong: { borderColor: tokens.colors.danger, backgroundColor: tokens.colors.dangerBackground },
  qcmOptionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 19,
  },
  qcmExplanation: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
    fontWeight: tokens.weight.medium,
  },

  refusalBanner: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.warningBackground,
    borderRadius: tokens.radius.md,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.warningText,
    padding: tokens.space.lg,
    marginTop: tokens.space.xs,
  },
  refusalText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.warningText,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
  },

  typingBubble: { paddingVertical: tokens.space.md, paddingHorizontal: tokens.space.lg },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs + 2 },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.textMuted,
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
  // Bouton d'envoi façon Claude : carré au coin doux, accent MedInfo, états soignés.
  sendButton: {
    width: tokens.size.controlMd,
    height: tokens.size.controlMd,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
  },
  sendButtonHover: { backgroundColor: tokens.colors.accentStrong, transform: [{ translateY: -1 }], ...tokens.elevation.md },
  sendButtonFocus: tokens.focus.ring,
  sendButtonPressed: { transform: [{ translateY: 1 }], opacity: 0.92 },
  // Désactivé : pas de simple opacité — surface enfoncée + flèche atténuée (lisible).
  sendButtonDisabled: {
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...Platform.select({ web: { boxShadow: 'none' } as object, default: {} }),
  },
});
