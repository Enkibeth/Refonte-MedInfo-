/**
 * Panneau d'historique des conversations (refonte 2026-06).
 * Liste les conversations classées par CATÉGORIE (générée par IA — feature chat_meta),
 * avec titre IA, date et chatbot d'origine. Sélection, suppression, nouvelle conversation.
 */
import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { ChatConversation } from '@/chat/history';
import { CHATBOT_META } from '@/ui/chat/ChatbotSwitcher';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function HistoryPanel({
  visible,
  onClose,
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
}: {
  visible: boolean;
  onClose: () => void;
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (c: ChatConversation) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, ChatConversation[]>();
    for (const c of conversations) {
      const key = c.category ?? 'Autre';
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [conversations]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Icon name="clock" size={18} color={tokens.colors.accentDeep} />
            <Text style={styles.headerTitle}>Historique</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fermer l'historique"
              style={styles.closeButton}
            >
              <Icon name="x" size={18} color={tokens.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.newButton} onPress={onNew} accessibilityRole="button">
            <Icon name="plus" size={16} color={tokens.colors.onAccent} />
            <Text style={styles.newButtonText}>Nouvelle conversation</Text>
          </TouchableOpacity>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {conversations.length === 0 ? (
              <Text style={styles.empty}>
                Aucune conversation enregistrée pour l'instant. Vos échanges apparaîtront ici,
                classés automatiquement par thème.
              </Text>
            ) : (
              grouped.map(([category, items]) => (
                <View key={category} style={styles.group}>
                  <Text style={styles.groupTitle}>{category}</Text>
                  {items.map((c) => {
                    const active = c.id === activeId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.item, active && styles.itemActive]}
                        onPress={() => onSelect(c)}
                        accessibilityRole="button"
                      >
                        <View style={styles.itemBody}>
                          <Text style={[styles.itemTitle, active && styles.itemTitleActive]} numberOfLines={1}>
                            {c.title ?? 'Conversation'}
                          </Text>
                          <Text style={styles.itemMeta}>
                            {CHATBOT_META[c.chatbot]?.shortLabel ?? c.chatbot} · {formatDate(c.updated_at)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => onDelete(c.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Supprimer « ${c.title ?? 'Conversation'} »`}
                          style={styles.deleteButton}
                        >
                          <Icon name="trash" size={15} color={tokens.colors.textMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 43, 61, 0.35)',
    flexDirection: 'row',
  },
  panel: {
    width: 340,
    maxWidth: '88%',
    backgroundColor: tokens.colors.surface,
    height: '100%',
    paddingTop: tokens.space.xl,
    paddingHorizontal: tokens.space.lg,
    gap: tokens.space.md,
    ...tokens.elevation.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  headerTitle: {
    flex: 1,
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceSunken,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accent,
    paddingVertical: tokens.space.md,
    ...tokens.motion.transitionWeb,
  },
  newButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  list: { flex: 1 },
  listContent: { gap: tokens.space.lg, paddingBottom: tokens.space['2xl'] },
  empty: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
    marginTop: tokens.space.md,
  },
  group: { gap: tokens.space.xs },
  groupTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm + 2,
    backgroundColor: tokens.colors.surface,
    ...tokens.motion.transitionWeb,
  },
  itemActive: { backgroundColor: tokens.colors.accentSurface },
  itemBody: { flex: 1, minWidth: 0, gap: 1 },
  itemTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  itemTitleActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  itemMeta: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
