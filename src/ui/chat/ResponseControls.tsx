/**
 * Contrôles de réponse du composer (2026-07) : au-dessus (ou dans) la zone de saisie
 * des 3 chatbots, l'utilisateur choisit
 *   - la PROFONDEUR de réponse : Rapide / Classique / Complexe ;
 *   - des OUTILS de sortie optionnels : diagramme, points clés, tableau comparatif.
 *
 * Deux présentations (le comportement est identique — mêmes réglages, mêmes popovers) :
 *   - `variant="bar"`    : rangée complète (segmenté + bouton « Ajouter »), pour les
 *                          écrans larges (tablette / desktop) où la place ne manque pas ;
 *   - `variant="inline"` : deux boutons-icônes compacts (🧠 profondeur + 🧰 outils) à
 *                          glisser DANS la barre d'actions du composer, sur mobile — la
 *                          rangée disparaît, on gagne de la hauteur de chat (demande Hugo).
 *
 * Pur composant de présentation : l'état (mode + outils) est possédé et persisté par
 * l'écran de chat. Le masquage/rendu n'est jamais une barrière de sécurité (les réglages
 * ne donnent aucun droit — cf. /api/chat).
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

type Panel = 'mode' | 'tools' | null;

export function ResponseControls({
  mode,
  onModeChange,
  tools,
  onToolsChange,
  disabled = false,
  variant = 'bar',
}: {
  mode: ResponseMode;
  onModeChange: (mode: ResponseMode) => void;
  tools: ChatOutputTool[];
  onToolsChange: (tools: ChatOutputTool[]) => void;
  disabled?: boolean;
  variant?: 'bar' | 'inline';
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[1];

  const toggleTool = (id: ChatOutputTool) => {
    onToolsChange(tools.includes(id) ? tools.filter((t) => t !== id) : [...tools, id]);
  };

  // ── Popovers partagés (profondeur + outils) ──
  const modeModal = (
    <Modal visible={panel === 'mode'} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
      <Pressable style={styles.backdrop} onPress={() => setPanel(null)}>
        <Pressable style={styles.modePanel} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.panelTitle}>Profondeur de la réponse</Text>
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  onModeChange(m.id);
                  setPanel(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${m.label} — ${m.hint}`}
                style={[styles.optionRow, active && styles.optionRowActive]}
              >
                <View style={[styles.optionIcon, active && styles.optionIconActive]}>
                  <Icon name={m.icon} size={16} color={active ? tokens.colors.onAccent : tokens.colors.accentDeep} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{m.label}</Text>
                  <Text style={styles.optionDescription}>{m.hint}</Text>
                </View>
                {active ? <Icon name="check" size={16} color={tokens.colors.accent} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );

  const toolsModal = (
    <Modal visible={panel === 'tools'} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
      <Pressable style={styles.backdrop} onPress={() => setPanel(null)}>
        <Pressable style={styles.modePanel} onPress={(e) => e.stopPropagation()}>
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
                style={styles.optionRow}
              >
                <View style={[styles.optionIcon, active && styles.optionIconActive]}>
                  <Icon name={t.icon} size={16} color={active ? tokens.colors.onAccent : tokens.colors.accentDeep} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{t.label}</Text>
                  <Text style={styles.optionDescription}>{t.description}</Text>
                </View>
                <View style={[styles.check, active && styles.checkActive]}>
                  {active ? <Icon name="check" size={13} color={tokens.colors.onAccent} /> : null}
                </View>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setPanel(null)} accessibilityRole="button" style={styles.doneButton}>
            <Text style={styles.doneLabel}>Terminé</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ── Variante compacte (mobile) : deux boutons-icônes dans la barre du composer ──
  if (variant === 'inline') {
    return (
      <>
        <Pressable
          onPress={() => setPanel('mode')}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Profondeur de la réponse : ${activeMode.label}`}
          style={[styles.iconButton, mode !== 'standard' && styles.iconButtonActive]}
        >
          <Icon
            name="brain"
            size={18}
            color={mode !== 'standard' ? tokens.colors.onAccent : tokens.colors.accentDeep}
          />
        </Pressable>
        <Pressable
          onPress={() => setPanel('tools')}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={
            tools.length > 0 ? `Outils de réponse (${tools.length} actifs)` : 'Ajouter des outils à la réponse'
          }
          style={[styles.iconButton, tools.length > 0 && styles.iconButtonActive]}
        >
          <Icon
            name="layoutGrid"
            size={17}
            color={tools.length > 0 ? tokens.colors.onAccent : tokens.colors.accentDeep}
          />
          {tools.length > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{tools.length}</Text>
            </View>
          ) : null}
        </Pressable>
        {modeModal}
        {toolsModal}
      </>
    );
  }

  // ── Variante barre (tablette / desktop) : segmenté + bouton « Ajouter » ──
  return (
    <View style={styles.row}>
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
              <Icon name={m.icon} size={13} color={active ? tokens.colors.onAccent : tokens.colors.accentDeep} />
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => setPanel('tools')}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          tools.length > 0 ? `Outils de réponse (${tools.length} actifs)` : 'Ajouter des outils à la réponse'
        }
        style={[styles.addButton, tools.length > 0 && styles.addButtonActive]}
      >
        <Icon name="plus" size={14} color={tools.length > 0 ? tokens.colors.onAccent : tokens.colors.accentDeep} />
        <Text style={[styles.addLabel, tools.length > 0 && styles.addLabelActive]}>
          {tools.length > 0 ? `Outils · ${tools.length}` : 'Ajouter'}
        </Text>
      </Pressable>

      {toolsModal}
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

  // ── Boutons-icônes compacts (variante inline) ──
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.accentSurface,
    ...tokens.motion.transitionWeb,
  },
  iconButtonActive: { backgroundColor: tokens.colors.accent },
  countBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: tokens.colors.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: tokens.colors.surface,
  },
  countBadgeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: 9,
    fontWeight: tokens.weight.bold,
  },

  // ── Popovers ──
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 30, 78, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.space.lg,
  },
  modePanel: {
    width: '100%',
    maxWidth: 380,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.lg,
    gap: tokens.space.xs,
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.md,
  },
  optionRowActive: { backgroundColor: tokens.colors.accentSurface },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconActive: { backgroundColor: tokens.colors.accent },
  optionText: { flex: 1, gap: 1 },
  optionLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  optionDescription: {
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
