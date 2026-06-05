/**
 * Écran chat avec streaming (AI SDK v6 useChat + DefaultChatTransport).
 * Rendu natif des tool-calls : propose_followups → boutons,
 * show_sources → panneau toggleable, refuse_and_redirect → bannière refus.
 * Disclaimer permanent conforme 01_REGULATION §4.
 */
import { useMemo, useState } from 'react';
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
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isTextUIPart, isToolUIPart } from 'ai';
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from 'ai';

import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/tokens';
import { collectLatestCitations, type Citation } from '@/ai/ui/chatSources';

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

  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
      {textContent ? (
        <Text style={isUser ? styles.textUser : styles.textAssistant}>{textContent}</Text>
      ) : null}

      {parts.map((p, i) => (
        <MessagePart key={i} part={p} onFollowup={onFollowup} />
      ))}
    </View>
  );
}

// ── Écran principal ────────────────────────────────────────────────────────

export default function ChatScreen() {
  // Persona issue de l'AuthProvider (source profiles/RLS, étape 3). Fallback 'public'
  // tant que la session/le profil charge ou pour un visiteur non authentifié.
  const { persona } = useSession();
  const [input, setInput] = useState('');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { persona: persona ?? 'public' },
    }),
  });

  const latestCitations = useMemo(() => collectLatestCitations(messages), [messages]);
  const isLoading = status === 'streaming' || status === 'submitted';
  const hasSources = latestCitations.length > 0;

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage({ text });
  };

  const handleFollowup = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.chatHeader}>
        <View>
          <Text style={styles.chatTitle}>{persona === 'student' ? 'Chat étudiant' : 'Chat santé'}</Text>
          <Text style={styles.chatSubtitle}>Information générale et sourcée</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerSourcesButton, !hasSources && styles.headerSourcesButtonDisabled]}
          onPress={() => setSourcesOpen((open) => !open)}
          disabled={!hasSources}
          accessibilityRole="button"
        >
          <Text style={[styles.headerSourcesText, !hasSources && styles.headerSourcesTextDisabled]}>
            {sourcesOpen ? 'Masquer' : 'Sources'} · {latestCitations.length}
          </Text>
        </TouchableOpacity>
      </View>

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
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Posez votre première question</Text>
            <Text style={styles.emptyText}>
              Réponses claires, appuyées sur des sources (HAS, ANSM…). Information générale,
              jamais un avis médical individuel.
            </Text>
          </View>
        ) : null}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onFollowup={handleFollowup} />
        ))}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.accent} size="small" />
            <Text style={styles.loadingText}>Rédaction en cours…</Text>
          </View>
        )}
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
        <TouchableOpacity
          style={[styles.sendButton, (isLoading || input.trim().length === 0) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isLoading || input.trim().length === 0}
          accessibilityRole="button"
          accessibilityLabel="Envoyer le message"
        >
          <Text style={styles.sendText}>Envoyer</Text>
        </TouchableOpacity>
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
  headerSourcesButton: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  headerSourcesButtonDisabled: { backgroundColor: 'transparent', borderColor: tokens.colors.border },
  headerSourcesText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  headerSourcesTextDisabled: { color: tokens.colors.textMuted },
  sourcesPane: { paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.sm, backgroundColor: tokens.colors.surfaceAlt },
  messages: { flex: 1 },
  messagesContent: { padding: tokens.space.lg, gap: tokens.space.md },

  emptyState: {
    marginTop: tokens.space['2xl'],
    paddingHorizontal: tokens.space.lg,
    gap: tokens.space.sm,
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

  bubble: { maxWidth: '88%', borderRadius: tokens.radius.lg, padding: tokens.space.md, gap: tokens.space.sm },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colors.accent,
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderBottomLeftRadius: 6,
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

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, padding: tokens.space.sm },
  loadingText: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.label.fontSize },

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
    minHeight: 44,
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
  },
  inputFocused: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.surface,
  },
  sendButton: {
    height: 44,
    paddingHorizontal: tokens.space.xl,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
});
