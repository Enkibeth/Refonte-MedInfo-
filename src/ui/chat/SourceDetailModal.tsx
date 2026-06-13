/**
 * Modale de détail d'une source (refonte 2026-06).
 * Ouverte au clic sur une carte source ou une référence inline : montre le niveau
 * de preuve, la justification et un bouton « Accéder à la source » — plutôt que
 * d'ouvrir directement le lien.
 */
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { evidenceLevelFor, type ParsedSource } from '@/ai/chat/parseAssistantMessage';
import { SourceBadgePill } from '@/ui/chat/AssistantBlocks';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

export function SourceDetailModal({
  source,
  onClose,
}: {
  source: ParsedSource | null;
  onClose: () => void;
}) {
  const evidence = source ? evidenceLevelFor(source.badge) : null;
  const open = () => {
    if (source?.url) Linking.openURL(source.url).catch(() => {});
  };

  return (
    <Modal visible={!!source} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {source && evidence ? (
            <>
              <View style={styles.header}>
                <Text style={styles.srcId}>{source.id}</Text>
                {source.badge ? <SourceBadgePill badge={source.badge} /> : null}
                <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Fermer">
                  <Icon name="x" size={18} color={tokens.colors.textMuted} />
                </Pressable>
              </View>

              <Text style={styles.title}>{source.title || source.shortLabel || source.org || source.id}</Text>
              {source.org ? <Text style={styles.org}>{source.org}{source.year ? ` · ${source.year}` : ''}</Text> : null}

              <View style={styles.evidenceBox}>
                <View style={styles.evidenceHead}>
                  <Icon name="shieldCheck" size={16} color={tokens.colors.accentDeep} />
                  <Text style={styles.evidenceLabel}>{evidence.label}</Text>
                </View>
                <Text style={styles.evidenceDesc}>{evidence.description}</Text>
              </View>

              {source.justification ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Pourquoi cette source</Text>
                  <Text style={styles.sectionText}>{source.justification}</Text>
                </View>
              ) : null}

              {source.url ? (
                <Pressable style={styles.accessButton} onPress={open} accessibilityRole="link">
                  <Icon name="externalLink" size={16} color={tokens.colors.onAccent} />
                  <Text style={styles.accessButtonText}>Accéder à la source</Text>
                </Pressable>
              ) : (
                <Text style={styles.noUrl}>Lien non fourni par la réponse.</Text>
              )}
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 43, 61, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.xl,
    gap: tokens.space.md,
    ...tokens.elevation.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  srcId: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
  },
  closeButton: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceSunken,
  },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    lineHeight: tokens.type.h3.lineHeight,
    fontWeight: tokens.weight.bold,
  },
  org: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: tokens.type.label.fontSize },
  evidenceBox: {
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    padding: tokens.space.md,
    gap: 4,
  },
  evidenceHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  evidenceLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
  },
  evidenceDesc: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize + 0.5,
    lineHeight: 18,
  },
  section: { gap: 2 },
  sectionLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
  },
  accessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accent,
    paddingVertical: tokens.space.md,
    marginTop: tokens.space.xs,
    ...tokens.motion.transitionWeb,
  },
  accessButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  noUrl: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
});
