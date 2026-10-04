import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { DefaultTheme, ThemeProvider } from 'expo-router';

import { tokens } from './tokens';

/**
 * Thème de navigation aux couleurs du design system (2026-10). Sans lui, les piles et onglets
 * gardaient le gris par défaut de React Navigation (#F2F2F2) : premier affichage de la Vue
 * d'ensemble entièrement gris avant l'hydratation, et gris visible pendant les transitions.
 */
const NAVIGATION_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: tokens.colors.background,
    card: tokens.colors.surface,
    text: tokens.colors.text,
    border: tokens.colors.border,
    primary: tokens.colors.accent,
    notification: tokens.colors.danger,
  },
};

export function MedInfoThemeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeProvider value={NAVIGATION_THEME}>
      <View style={{ flex: 1 }}>{children}</View>
    </ThemeProvider>
  );
}
