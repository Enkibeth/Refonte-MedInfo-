/**
 * Panneau d'historique des conversations (refonte 2026-06).
 * Liste les conversations classées par CATÉGORIE (générée par IA — feature chat_meta),
 * avec titre IA, date et chatbot d'origine. Sélection, suppression, nouvelle conversation.
 * Ouverture : glissement latéral sobre (translateX + fade, design system §4) ;
 * chargement : squelettes pulsés. Reduced-motion respecté.
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
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
import { Skeleton } from '@/ui/Skeleton';
import { tokens } from '@/ui/tokens';
import { useReducedMotion } from '@/ui/useReducedMotion';

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
  loading = false,
}: {
  visible: boolean;
  onClose: () => void;
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (c: ChatConversation) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  loading?: boolean;
}) {
  const reduced = useReducedMotion();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      slide.setValue(1);
      return;
    }
    slide.setValue(0);
    const anim = Animated.timing(slide, {
      toValue: 1,
      duration: tokens.motion.duration.base,
      easing: Easing.bezier(...tokens.motion.easing.out),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [visible, reduced, slide]);

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
        <Animated.View
          style={[
            styles.panelSlide,
            {
              opacity: slide,
              transform: [
                { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) },
              ],
            },
          ]}
        >
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
            {loading && conversations.length === 0 ? (
              <View style={styles.skeletonGroup}>
                <Skeleton width={90} height={11} />
                <View style={styles.skeletonItem}>
                  <Skeleton width="78%" height={13} />
                  <Skeleton width="42%" height={10} />
                </View>
                <View style={styles.skeletonItem}>
                  <Skeleton width="64%" height={13} />
                  <Skeleton width="38%" height={10} />
                </View>
                <View style={styles.skeletonItem}>
                  <Skeleton width="71%" height={13} />
                  <Skeleton width="45%" height={10} />
                </View>
              </View>
            ) : conversations.length === 0 ? (
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
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 30, 78, 0.35)',
    flexDirection: 'row',
  },
  panelSlide: { height: '100%', width: 340, maxWidth: '88%' },
  panel: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
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
  skeletonGroup: { gap: tokens.space.md, marginTop: tokens.space.sm },
  skeletonItem: {
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.surface,
  },
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
    letterSpacing: tokens.tracking.caps,
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
