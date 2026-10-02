/**
 * Boutons de barre d'outils (en-têtes d'écran : chat, menu Outils, pays…) — même langage que
 * `<Button variant="secondary">` (05_DESIGN §5) : fond blanc, filet clair, ombre de contact,
 * icône et libellé encre. Basculé (panneau ouvert, mode actif) : fond bleu très léger, filet et
 * contenu accent — jamais un aplat bleu plein, réservé à l'action principale de l'écran.
 * Cible 44 px. Survol/appui : couche d'état de `<Touchable>` (src/ui/interaction.ts).
 */
import { StyleSheet } from 'react-native';

import { tokens } from '@/ui/tokens';

/** Couleur de l'icône / du libellé selon l'état basculé. */
export function toolbarContentColor(active = false): string {
  return active ? tokens.colors.accentDeep : tokens.colors.textSubtle;
}

export const toolbarButtonStyles = StyleSheet.create({
  button: {
    minHeight: tokens.size.iconButton,
    minWidth: tokens.size.iconButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.border.thin,
    borderColor: tokens.colors.borderControl,
    backgroundColor: tokens.colors.surface,
    ...tokens.elevation.control,
    ...tokens.motion.transitionWeb,
  },
  /** Bouton d'icône seule : carré 44 px. */
  icon: { width: tokens.size.iconButton, paddingHorizontal: 0 },
  active: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurface,
    ...tokens.elevation.none,
  },
  label: {
    fontFamily: tokens.font.display,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
    color: tokens.colors.text,
  },
  labelActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
});
