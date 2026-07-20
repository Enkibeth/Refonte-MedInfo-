/**
 * Contrôles de réponse du composer (2026-07) : au-dessus de la zone de saisie des 3
 * chatbots, l'utilisateur choisit
 *   - la PROFONDEUR de réponse : Rapide / Classique / Complexe (segmenté) ;
 *   - des OUTILS de sortie optionnels (bouton « Ajouter ») : diagramme, points clés,
 *     tableau comparatif — cochables, envoyés au serveur qui enrichit le system prompt.
 *
 * Pur composant de présentation : l'état (mode + outils) est possédé et persisté par
 * l'écran de chat ; aucune logique réseau ici. Le masquage/rendu n'est jamais une
 * barrière de sécurité (les réglages ne donnent aucun droit — cf. /api/chat).
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ResponseMode } from '@/ai/chat/responseMode';
import type { ChatOutputTool } from '@/ai/chat/outputTools';
import { Icon, type IconName } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

const MODES: { id: ResponseMode; label: string; icon: IconName; hint: string }[] = [
  { id: 'fast', label: 'Rapide', icon: 'wind', hint: 'Réponse brève et directe' },
  { id: 'standard', label: 'Classique', icon: 'messageCircle', hint: 'Réponse équilibrée' },
  { id: 'deep', label: 'Complexe', icon: 'brain', hint: 'Réponse complète et approfondie' },
];

const TOOLS: { id: ChatOutputTool; label: string; icon: IconName; description: string }[] = [
  {
    id: 'diagram',
    label: 'Diagramme',
    icon: 'barChart',
    description: 'Un schéma visuel quand il clarifie (algorithme, arbre décisionnel, étapes).',
  },
  {
    id: 'keypoints',
    label: 'Points clés',
    icon: 'sparkles',
    description: 'Un encadré « À retenir » synthétique en tête de réponse.',
  },
  {
    id: 'comparison',
    label: 'Tableau comparatif',
    icon: 'layoutGrid',
    description: 'Une comparaison structurée en tableau quand la question s’y prête.',
  },
];

export function ResponseControls({
  mode,
  onModeChange,
  tools,
  onToolsChange,
  disabled = false,
}: {
  mode: ResponseMode;
  onModeChange: (mode: ResponseMode) => void;
  tools: ChatOutputTool[];
  onToolsChange: (tools: ChatOutputTool[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const toggleTool = (id: ChatOutputTool) => {
    onToolsChange(tools.includes(id) ? tools.filter((t) => t !== id) : [...tools, id]);
  };

  return (
    <View style={styles.row}>
      {/* Segmenté de profondeur de réponse. */}
      <View style={styles.segment} accessibilityRole="tablist">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => onModeChange(m.id)}
              disabled={disabled}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${m.label} — ${m.hint}`}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <Icon
                name={m.icon}
                size={13}
                color={active ? tokens.colors.onAccent : tokens.colors.accentDeep}
              />
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Bouton « Ajouter » : ouvre la liste des outils de sortie optionnels. */}
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          tools.length > 0 ? `Outils de réponse (${tools.length} actifs)` : 'Ajouter des outils à la réponse'
        }
        style={[styles.addButton, tools.length > 0 && styles.addButtonActive]}
      >
        <Icon
          name="plus"
          size={14}
          color={tools.length > 0 ? tokens.colors.onAccent : tokens.colors.accentDeep}
        />
        <Text style={[styles.addLabel, tools.length > 0 && styles.addLabelActive]}>
          {tools.length > 0 ? `Outils · ${tools.length}` : 'Ajouter'}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.panelTitle}>Ajouter à la réponse</Text>
            <Text style={styles.panelSubtitle}>
              L’IA les inclut seulement quand c’est pertinent, jamais du remplissage.
            </Text>
            {TOOLS.map((t) => {
              const active = tools.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => toggleTool(t.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={t.label}
                  style={styles.toolRow}
                >
                  <View style={[styles.toolIcon, active && styles.toolIconActive]}>
                    <Icon
                      name={t.icon}
                      size={16}
                      color={active ? tokens.colors.onAccent : tokens.colors.accentDeep}
                    />
                  </View>
                  <View style={styles.toolText}>
                    <Text style={styles.toolLabel}>{t.label}</Text>
                    <Text style={styles.toolDescription}>{t.description}</Text>
                  </View>
                  <View style={[styles.check, active && styles.checkActive]}>
                    {active ? <Icon name="check" size={13} color={tokens.colors.onAccent} /> : null}
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              style={styles.doneButton}
            >
              <Text style={styles.doneLabel}>Terminé</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
    marginBottom: tokens.space.sm,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.accentSurface,
    borderRadius: tokens.radius.pill,
    padding: 2,
    gap: 2,
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 1,
    borderRadius: tokens.radius.pill,
    ...tokens.motion.transitionWeb,
  },
  segmentItemActive: { backgroundColor: tokens.colors.accent, ...tokens.elevation.sm },
  segmentLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  segmentLabelActive: { color: tokens.colors.onAccent },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 2,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.surface,
    ...tokens.motion.transitionWeb,
  },
  addButtonActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  addLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  addLabelActive: { color: tokens.colors.onAccent },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 30, 78, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.space.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.elevation.lg,
  },
  panelTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  panelSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
    marginBottom: tokens.space.xs,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.md,
  },
  toolIcon: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIconActive: { backgroundColor: tokens.colors.accent },
  toolText: { flex: 1, gap: 1 },
  toolLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  toolDescription: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  doneButton: {
    marginTop: tokens.space.sm,
    alignSelf: 'flex-end',
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
  },
  doneLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});
