/**
 * En-tête commun des écrans d'outils (2026-10).
 *
 * - Téléphone (< 640 px) : la barre compacte du chat (☰ + icône + titre, src/ui/AppMobileHeader.tsx).
 *   Ni bouton « Outils », ni paragraphe de présentation, ni barre d'onglets en bas : l'outil
 *   occupe tout l'écran (retour Hugo : le CV ne laissait qu'un « tout petit cadre »).
 * - Tablette et ordinateur : titre, présentation courte et menu « Outils » (masqué sous le
 *   shell desktop, dont la barre latérale porte la navigation).
 *
 * Web : les deux variantes sont dans le DOM et le CSS choisit selon la largeur (`mi`), comme le
 * reste du pré-rendu (largeur inconnue) ; la variante masquée est hors de l'arbre d'accessibilité.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { getFeatureMeta, type AppFeatureId } from '@/ai/routing/featureVisibility';
import { AppMobileHeader } from '@/ui/AppMobileHeader';
import { PageTitle } from '@/ui/PageTitle';
import { mi } from '@/ui/responsive';
import { tokens } from '@/ui/tokens';
import { ToolsMenu } from '@/ui/ToolsMenu';
import { useWindowWidth } from '@/ui/useWindowWidth';

export function ToolScreenHeader({ feature, title, children }: { feature: AppFeatureId; title: string; children?: ReactNode }) {
  const width = useWindowWidth();
  const compactBp = tokens.layout.compact;
  const icon = getFeatureMeta(feature)?.icon;

  const bar = <AppMobileHeader title={title} icon={icon} />;
  const full = (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <PageTitle style={styles.title}>{title}</PageTitle>
        <ToolsMenu />
      </View>
      {children ? <Text style={styles.subtitle}>{children}</Text> : null}
    </View>
  );

  if (Platform.OS !== 'web') return width < compactBp ? bar : full;
  return (
    <>
      <View {...mi(`lt${compactBp}`)}>{bar}</View>
      <View {...mi(`ge${compactBp}`)}>{full}</View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.lg,
    paddingBottom: tokens.space.md,
    gap: tokens.space.xs,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: tokens.border.thin,
    borderColor: tokens.colors.border,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  title: { flexShrink: 1 },
  subtitle: {
    maxWidth: tokens.layout.measure + 120,
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    ...tokens.type.label,
  },
});
