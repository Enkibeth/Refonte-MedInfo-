/**
 * Panneau de réglages du chat (ADR-0021), ouvert depuis l'en-tête.
 * Deux sections :
 *   1. Réponses — curseurs « Réflexion » et « Détail » ; la « Rapidité » est dérivée
 *      automatiquement de la réflexion (affichée, non réglable).
 *   2. Mes informations — prénom/nom/âge/sexe (persistés en profil via own-row RLS),
 *      utilisés pour personnaliser l'information générale, jamais pour un avis individuel.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  DETAIL_OPTIONS,
  REASONING_OPTIONS,
  SPEED_BY_REASONING,
  type GenerationSettings,
} from '@/ai/chat/generationSettings';
import { PersonalInfoForm } from '@/ui/PersonalInfoForm';
import { SegmentedSlider } from '@/ui/SegmentedSlider';
import { tokens } from '@/ui/tokens';

export function ChatSettingsSheet({
  visible,
  onClose,
  generation,
  onChangeGeneration,
}: {
  visible: boolean;
  onClose: () => void;
  generation: GenerationSettings;
  onChangeGeneration: (next: GenerationSettings) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Réglages du chat</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer">
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {/* ── Réponses ─────────────────────────────────────────────── */}
            <Text style={styles.sectionTitle}>Réponses</Text>

            <SegmentedSlider
              label="Réflexion"
              options={REASONING_OPTIONS}
              value={generation.reasoning}
              onChange={(reasoning) => onChangeGeneration({ ...generation, reasoning })}
              hint="Plus de réflexion = réponse plus fouillée, mais plus lente."
            />

            <View style={styles.speedRow}>
              <Text style={styles.speedLabel}>Rapidité (automatique)</Text>
              <View style={styles.speedBadge}>
                <Text style={styles.speedBadgeText}>⚡ {SPEED_BY_REASONING[generation.reasoning]}</Text>
              </View>
            </View>

            <View style={styles.spacer} />

            <SegmentedSlider
              label="Détail"
              options={DETAIL_OPTIONS}
              value={generation.detail}
              onChange={(detail) => onChangeGeneration({ ...generation, detail })}
              hint="Réponse simple et courte, ou complète et très détaillée."
            />

            {/* ── Mes informations ─────────────────────────────────────── */}
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Mes informations</Text>
            <Text style={styles.sectionHelp}>
              Optionnel. Sert à adapter l'information générale (registre, dépistages selon l'âge/le
              sexe). Jamais utilisé pour un diagnostic ou un avis médical individuel.
            </Text>
            <PersonalInfoForm />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 27, 34, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tokens.colors.surfacePure,
    borderTopLeftRadius: tokens.radius.none,
    borderTopRightRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.sm,
    paddingBottom: tokens.space.xl,
    maxHeight: '90%',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    ...tokens.elevation.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.border,
    marginBottom: tokens.space.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.space.sm,
  },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  close: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: 18,
    paddingHorizontal: tokens.space.sm,
  },
  content: { gap: tokens.space.md, paddingBottom: tokens.space.lg },
  sectionTitle: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.text,
    fontSize: tokens.type.mono.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.type.mono.letterSpacing,
  },
  sectionHelp: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
  },
  spacer: { height: tokens.space.xs },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfacePure,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  speedLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  speedBadge: {
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.accent,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 3,
  },
  speedBadgeText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    fontWeight: tokens.weight.bold,
  },
  divider: {
    height: tokens.border.hairline,
    backgroundColor: tokens.colors.border,
    marginVertical: tokens.space.sm,
  },
});
