/**
 * Écran d'erreur global (export `ErrorBoundary` de app/_layout.tsx).
 *
 * Sans lui, une exception de rendu laissait une page blanche en production (aucun filet
 * d'erreur au niveau des routes). Rendu HORS des fournisseurs de l'application (session,
 * thème, navigation peuvent être la cause de la panne) : composants de base et jetons de
 * design uniquement, aucun hook de contexte.
 *
 * Le message technique n'est jamais affiché (il peut contenir des détails internes) ; il
 * part dans la console pour le diagnostic.
 */
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

import { Button } from './Button';
import { tokens } from './tokens';

function goHome() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign('/');
}

export function AppErrorScreen({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('[medinfo] erreur d’affichage :', error);
  }, [error]);

  return (
    <View style={styles.screen} role="main">
      <View style={styles.card} role="alert">
        <Text style={styles.eyebrow}>Erreur inattendue</Text>
        <Text accessibilityRole="header" aria-level={1} style={styles.title}>
          Cette page n’a pas pu s’afficher.
        </Text>
        <Text style={styles.text}>
          Le problème vient de notre côté. Réessayez : vos conversations et documents enregistrés
          ne sont pas affectés. Si l’erreur persiste, rechargez la page ou revenez à l’accueil.
        </Text>
        <View style={styles.actions}>
          <Button label="Réessayer" onPress={() => void retry()} fullWidth={false} />
          {Platform.OS === 'web' ? (
            <Button label="Retour à l’accueil" variant="ghost" onPress={goHome} fullWidth={false} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background,
    padding: tokens.space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    gap: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: tokens.border.thin,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.space['2xl'],
    ...tokens.elevation.sm,
  },
  eyebrow: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    ...tokens.type.h2,
  },
  text: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md, marginTop: tokens.space.sm },
});
