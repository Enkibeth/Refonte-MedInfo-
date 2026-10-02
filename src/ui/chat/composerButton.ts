/**
 * Boutons de la barre du composer (chat, ECOS) — UN seul langage visuel (retour Hugo
 * 2026-10 : « les boutons ne font pas très propre » — trombone rond bordé, micro carré gris
 * bordé, profondeur en aplat bleu, outils en carré pâle, « Envoyer » rectangle gris).
 *
 * - Bouton d'action : rond, SANS bordure ni fond au repos (icône gris ardoise), fond
 *   discret au survol/appui ; état ACTIF = pastille teintée + icône accent (jamais un
 *   aplat plein, réservé à l'action principale).
 * - Envoi : rond, plein bleu quand un message peut partir, gris neutre sinon.
 * Cible tactile 44 px (WCAG 2.5.5) conservée.
 */
import { Platform, StyleSheet } from 'react-native';

import { tokens } from '@/ui/tokens';

export const COMPOSER_BUTTON_SIZE = tokens.size.controlMd; // 44
export const COMPOSER_ICON_SIZE = 20;

/** Couleur de l'icône d'un bouton du composer selon son état. */
export function composerIconColor(state: { active?: boolean; disabled?: boolean } = {}): string {
  if (state.disabled) return tokens.colors.textMuted;
  return state.active ? tokens.colors.accentDeep : tokens.colors.textSubtle;
}

export const composerButtonStyles = StyleSheet.create({
  button: {
    width: COMPOSER_BUTTON_SIZE,
    height: COMPOSER_BUTTON_SIZE,
    minHeight: COMPOSER_BUTTON_SIZE,
    borderRadius: COMPOSER_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.transparent,
    ...tokens.motion.transitionWeb,
  },
  hover: { backgroundColor: tokens.colors.surfaceSunken },
  pressed: { backgroundColor: tokens.colors.surfaceSunken, opacity: 0.85 },
  focus: tokens.focus.ring,
  active: { backgroundColor: tokens.colors.accentSurface },
  disabled: { opacity: 0.45 },
  // ── Envoi / arrêt ──
  send: {
    width: COMPOSER_BUTTON_SIZE,
    height: COMPOSER_BUTTON_SIZE,
    minHeight: COMPOSER_BUTTON_SIZE,
    borderRadius: COMPOSER_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.accentVivid,
    ...tokens.motion.transitionWeb,
  },
  sendHover: { backgroundColor: tokens.colors.accentVividStrong },
  // Appui sur envoi/arrêt : on garde le fond (une icône blanche sur fond clair disparaissait).
  sendPressed: { opacity: 0.8 },
  sendDisabled: {
    backgroundColor: tokens.colors.surfaceSunken,
    ...(Platform.select({ web: { boxShadow: 'none' } as object, default: {} }) as object),
  },
  stop: {
    backgroundColor: tokens.colors.text,
  },
});
