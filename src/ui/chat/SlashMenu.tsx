/**
 * Menu des commandes « / » au-dessus du composeur (ADR-0044) : lanceur d'outils sans IA.
 * Liste filtrée pendant la frappe ; ↑/↓ pour choisir, Entrée ou Tab pour valider, Échap pour
 * fermer (gérés par l'écran du chat, qui possède la saisie).
 */
import { Platform, StyleSheet, Text, View } from 'react-native';

import { moduleActionCard } from '@/ai/chat/moduleActions';
import { slashLabel, type SlashCommandSpec } from '@/ai/chat/slashCommands';
import { featureTint } from '@/ui/featureChips';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { Touchable } from '@/ui/Touchable';

export function SlashMenu({
  suggestions,
  activeIndex,
  onPick,
  compact = false,
}: {
  suggestions: SlashCommandSpec[];
  activeIndex: number;
  onPick: (spec: SlashCommandSpec) => void;
  /** Petit écran (tactile) : colonne de commande plus étroite, pas d'aide clavier. */
  compact?: boolean;
}) {
  if (suggestions.length === 0) return null;
  return (
    <View style={styles.menu} accessibilityRole="menu" aria-label="Outils" testID="slash-menu">
      {suggestions.map((spec, i) => {
        const card = moduleActionCard({ tool: spec.tool, param: null });
        const tint = featureTint(spec.tool);
        const active = i === activeIndex;
        return (
          <Touchable
            key={spec.tool}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => onPick(spec)}
            accessibilityRole="menuitem"
            aria-selected={active}
            accessibilityLabel={`/${spec.command}${spec.argHint ? ` ${spec.argHint}` : ''} : ${slashLabel(spec)}`}
          >
            <View style={[styles.icon, { backgroundColor: tint.bg }]}>
              <Icon name={card.icon} size={15} color={tint.fg} />
            </View>
            <Text style={[styles.command, compact && styles.commandCompact]} numberOfLines={1}>
              /{spec.command}
              {spec.argHint ? <Text style={styles.arg}> {spec.argHint}</Text> : null}
            </Text>
            <Text style={styles.label} numberOfLines={1}>
              {spec.label}
            </Text>
          </Touchable>
        );
      })}
      {Platform.OS === 'web' && !compact ? (
        <Text style={styles.footer}>↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingVertical: tokens.space.xs,
    ...tokens.elevation.md,
  },
  item: {
    minHeight: tokens.size.controlMd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  itemActive: { backgroundColor: tokens.colors.accentSurface },
  icon: {
    width: 26,
    height: 26,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  command: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.text,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    minWidth: 190,
  },
  commandCompact: { minWidth: 0, flexShrink: 1 },
  arg: { color: tokens.colors.textMuted, fontWeight: tokens.weight.regular },
  label: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
  },
  footer: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    paddingHorizontal: tokens.space.md,
    paddingTop: tokens.space.xs,
  },
});
