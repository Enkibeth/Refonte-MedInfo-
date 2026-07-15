/**
 * Historique des conversations (refonte 2026-06, passe UX 2026-07, audit chatbot 2026-07).
 *
 * Le contenu (recherche, liste groupée par CATÉGORIE générée par IA, renommage,
 * suppression en deux temps, nouvelle conversation) est extrait dans
 * <ConversationList> pour être rendu de DEUX façons :
 *   - panneau modal (mobile / petites largeurs) — <HistoryPanel> ;
 *   - colonne persistante dans l'écran chat sur desktop shell (≥ 1024 px) —
 *     motif des chats de référence (ChatGPT/Claude), cf. app/(chat)/chat.tsx.
 * Ouverture modale : glissement latéral sobre ; chargement : squelettes.
 * Reduced-motion respecté.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

export interface ConversationListProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (c: ChatConversation) => void;
  onDelete: (id: string) => void;
  /** Renommage manuel du titre (E3) — absent = pas de bouton crayon. */
  onRename?: (id: string, title: string) => void;
  onNew: () => void;
  loading?: boolean;
}

/**
 * Liste des conversations : bouton « Nouvelle conversation », recherche,
 * groupes par catégorie, renommage inline et suppression en deux temps.
 * État transitoire (recherche, confirmation, édition) local au composant.
 */
export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onNew,
  loading = false,
}: ConversationListProps) {
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const resetTransientState = () => {
    setQuery('');
    setConfirmDeleteId(null);
    setEditingId(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.title ?? 'Conversation').toLowerCase().includes(q) ||
        (c.category ?? '').toLowerCase().includes(q),
    );
  }, [conversations, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ChatConversation[]>();
    for (const c of filtered) {
      const key = c.category ?? 'Autre';
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const startRename = (c: ChatConversation) => {
    setConfirmDeleteId(null);
    setEditingId(c.id);
    setDraftTitle(c.title ?? '');
  };

  const submitRename = () => {
    const id = editingId;
    const title = draftTitle.trim();
    setEditingId(null);
    if (id && title && onRename) onRename(id, title);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.newButton}
        onPress={() => {
          resetTransientState();
          onNew();
        }}
        accessibilityRole="button"
      >
        <Icon name="plus" size={16} color={tokens.colors.onAccent} />
        <Text style={styles.newButtonText}>Nouvelle conversation</Text>
      </TouchableOpacity>

      {conversations.length > 0 ? (
        <View style={styles.searchBox}>
          <Icon name="search" size={15} color={tokens.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setConfirmDeleteId(null);
            }}
            placeholder="Rechercher une conversation…"
            placeholderTextColor={tokens.colors.textMuted}
            accessibilityLabel="Rechercher une conversation"
          />
          {query ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
              style={styles.searchClear}
            >
              <Icon name="x" size={13} color={tokens.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

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
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>Aucune conversation ne correspond à « {query.trim()} ».</Text>
        ) : (
          grouped.map(([category, items]) => (
            <View key={category} style={styles.group}>
              <Text style={styles.groupTitle}>{category}</Text>
              {items.map((c) => {
                const active = c.id === activeId;
                if (editingId === c.id) {
                  // Renommage inline : champ + valider / annuler.
                  return (
                    <View key={c.id} style={[styles.item, styles.itemEditing]}>
                      <TextInput
                        style={styles.renameInput}
                        value={draftTitle}
                        onChangeText={setDraftTitle}
                        autoFocus
                        onSubmitEditing={submitRename}
                        placeholder="Titre de la conversation"
                        placeholderTextColor={tokens.colors.textMuted}
                        accessibilityLabel="Nouveau titre de la conversation"
                      />
                      <TouchableOpacity
                        onPress={submitRename}
                        accessibilityRole="button"
                        accessibilityLabel="Enregistrer le titre"
                        style={styles.renameConfirm}
                      >
                        <Icon name="check" size={14} color={tokens.colors.onAccent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setEditingId(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Annuler le renommage"
                        style={styles.confirmCancel}
                      >
                        <Icon name="x" size={14} color={tokens.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  );
                }
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.item, active && styles.itemActive]}
                    onPress={() => {
                      resetTransientState();
                      onSelect(c);
                    }}
                    accessibilityRole="button"
                  >
                    <View style={styles.itemBody}>
                      <Text
                        style={[styles.itemTitle, active && styles.itemTitleActive]}
                        numberOfLines={1}
                      >
                        {c.title ?? 'Conversation'}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {CHATBOT_META[c.chatbot]?.shortLabel ?? c.chatbot} · {formatDate(c.updated_at)}
                      </Text>
                    </View>
                    {confirmDeleteId === c.id ? (
                      // Suppression en deux temps : le premier appui demande
                      // confirmation au lieu de supprimer immédiatement.
                      <View style={styles.confirmRow}>
                        <TouchableOpacity
                          onPress={() => {
                            setConfirmDeleteId(null);
                            onDelete(c.id);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Confirmer la suppression de « ${c.title ?? 'Conversation'} »`}
                          style={styles.confirmDelete}
                        >
                          <Text style={styles.confirmDeleteText}>Supprimer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setConfirmDeleteId(null)}
                          accessibilityRole="button"
                          accessibilityLabel="Annuler la suppression"
                          style={styles.confirmCancel}
                        >
                          <Icon name="x" size={14} color={tokens.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.itemActions}>
                        {onRename ? (
                          <TouchableOpacity
                            onPress={() => startRename(c)}
                            accessibilityRole="button"
                            accessibilityLabel={`Renommer « ${c.title ?? 'Conversation'} »`}
                            style={styles.iconAction}
                          >
                            <Icon name="penLine" size={14} color={tokens.colors.textMuted} />
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          onPress={() => setConfirmDeleteId(c.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Supprimer « ${c.title ?? 'Conversation'} »`}
                          style={styles.iconAction}
                        >
                          <Icon name="trash" size={15} color={tokens.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

export function HistoryPanel({
  visible,
  onClose,
  conversations,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onNew,
  loading = false,
}: ConversationListProps & {
  visible: boolean;
  onClose: () => void;
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
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onNew={onNew}
              loading={loading}
            />
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
  itemEditing: { backgroundColor: tokens.colors.surfaceSunken },
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
  itemActions: { flexDirection: 'row', alignItems: 'center' },
  iconAction: {
    width: 30,
    height: 30,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameInput: {
    flex: 1,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    color: tokens.colors.text,
    paddingVertical: 2,
    ...(Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }) as object),
  },
  renameConfirm: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.accent,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    height: 38,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSunken,
  },
  searchInput: {
    flex: 1,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    color: tokens.colors.text,
    ...(Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }) as object),
  },
  searchClear: {
    width: 24,
    height: 24,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs },
  confirmDelete: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.danger,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 1,
    ...tokens.motion.transitionWeb,
  },
  confirmDeleteText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  confirmCancel: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceSunken,
  },
});
