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
import { getSupabaseClient } from '@/db/supabase';
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
        <TouchableOpacity key={i} style={styles.followupButton} onPress={() => onSelect(s)}>
          <Text style={styles.followupText}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
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
      <TouchableOpacity onPress={() => setOpen((o) => !o)} style={styles.sourcesToggle}>
        <Text style={styles.sourcesToggleText}>
          {open ? '▲' : '▼'} Sources ({citations.length})
        </Text>
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
            style={[
              styles.qcmOption,
              answered && isCorrect && styles.qcmOptionCorrect,
              answered && isSelected && !isCorrect && styles.qcmOptionWrong,
            ]}
            onPress={() => setSelectedIndex(index)}
          >
            <Text style={styles.qcmOptionText}>
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
  // Persona affichée (titre) issue de l'AuthProvider. Le serveur, lui, NE fait PAS confiance
  // au client : il dérive le persona du token d'auth (ADR-0012). On envoie donc le token, pas
  // le persona.
  const { persona } = useSession();
  const [input, setInput] = useState('');
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        // Token frais à chaque requête (la session peut se rafraîchir en cours d'usage).
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await getSupabaseClient().auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  const latestCitations = useMemo(() => collectLatestCitations(messages), [messages]);
  const isLoading = status === 'streaming' || status === 'submitted';

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
        <Text style={styles.chatTitle}>{persona === 'student' ? 'Chat étudiant' : 'Chat santé'}</Text>
        <TouchableOpacity
          style={[styles.headerSourcesButton, latestCitations.length === 0 && styles.headerSourcesButtonDisabled]}
          onPress={() => setSourcesOpen((open) => !open)}
          disabled={latestCitations.length === 0}
        >
          <Text style={styles.headerSourcesText}>
            {sourcesOpen ? 'Masquer' : 'Sources'} ({latestCitations.length})
          </Text>
        </TouchableOpacity>
      </View>

      {sourcesOpen && latestCitations.length > 0 ? (
        <View style={styles.sourcesPane}>
          <SourcesPanel citations={latestCitations} defaultOpen />
        </View>
      ) : null}

      <ScrollView
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onFollowup={handleFollowup} />
        ))}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.accent} size="small" />
            <Text style={styles.loadingText}>En cours…</Text>
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
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Posez une question sur la santé…"
          placeholderTextColor={tokens.colors.textMuted}
          multiline
          editable={!isLoading}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isLoading}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  chatTitle: { color: tokens.colors.text, fontSize: 16, fontWeight: '700' },
  headerSourcesButton: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
  },
  headerSourcesButtonDisabled: { opacity: 0.45, borderColor: tokens.colors.border },
  headerSourcesText: { color: tokens.colors.accent, fontSize: 13, fontWeight: '700' },
  sourcesPane: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: tokens.colors.background },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 12, gap: 8 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: tokens.colors.accent },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  textUser: { color: '#fff', fontSize: 15, lineHeight: 22 },
  textAssistant: { color: tokens.colors.text, fontSize: 15, lineHeight: 22 },
  followupContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  followupButton: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
  },
  followupText: { color: tokens.colors.accent, fontSize: 13, fontWeight: '600' },
  sourcesWrapper: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  sourcesToggle: { padding: 8, backgroundColor: tokens.colors.background },
  sourcesToggleText: { color: tokens.colors.textMuted, fontSize: 13, fontWeight: '600' },
  citation: { padding: 8, borderTopWidth: 1, borderColor: tokens.colors.border },
  citationTitle: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
  citationUrl: { color: tokens.colors.accent, fontSize: 11, marginTop: 2 },
  citationExcerpt: { color: tokens.colors.textMuted, fontSize: 12, marginTop: 2 },
  qcmCard: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  qcmMeta: { color: tokens.colors.textMuted, fontSize: 12, fontWeight: '700' },
  qcmStem: { color: tokens.colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  qcmOption: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  qcmOptionCorrect: { borderColor: tokens.colors.success, backgroundColor: tokens.colors.successBackground },
  qcmOptionWrong: { borderColor: tokens.colors.warningText, backgroundColor: tokens.colors.warningBackground },
  qcmOptionText: { color: tokens.colors.text, fontSize: 13, lineHeight: 18 },
  qcmExplanation: { color: tokens.colors.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  refusalBanner: {
    backgroundColor: tokens.colors.warningBackground,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  refusalText: { color: tokens.colors.warningText, fontSize: 14, lineHeight: 20 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  loadingText: { color: tokens.colors.textMuted, fontSize: 14 },
  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    color: tokens.colors.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderColor: tokens.colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    color: tokens.colors.text,
    fontSize: 15,
  },
  sendButton: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
