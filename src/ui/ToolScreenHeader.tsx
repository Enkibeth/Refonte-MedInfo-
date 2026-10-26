/**
 * En-tête commun des écrans d'outils (2026-10).
 *
 * - Téléphone et tablette (< 1 024 px) : la barre compacte du chat (☰ + icône + titre,
 *   src/ui/AppMobileHeader.tsx).
 *   Ni bouton « Outils », ni paragraphe de présentation, ni barre d'onglets en bas : l'outil
 *   occupe tout l'écran (retour Hugo : le CV ne laissait qu'un « tout petit cadre »).
 * - Ordinateur (≥ 1 024 px) : bandeau « Moniteur » compact (ADR-0047, `NightBand`) : icône de
 *   l'outil, titre, présentation courte et menu « Outils » (masqué sous le shell desktop, dont
 *   la barre latérale porte la navigation).
 *
 * Web : les deux variantes sont dans le DOM et le CSS choisit selon la largeur (`mi`), comme le
 * reste du pré-rendu (largeur inconnue) ; la variante masquée est hors de l'arbre d'accessibilité.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { getFeatureMeta, type AppFeatureId } from '@/ai/routing/featureVisibility';
import { AppMobileHeader } from '@/ui/AppMobileHeader';
import { audienceLabel } from '@/ui/audienceLabel';
import { NightBand } from '@/ui/NightBand';
import { mi } from '@/ui/responsive';
import { tokens } from '@/ui/tokens';
import { ToolsMenu } from '@/ui/ToolsMenu';
import { useWindowWidth } from '@/ui/useWindowWidth';

export function ToolScreenHeader({ feature, title, children }: { feature: AppFeatureId; title: string; children?: ReactNode }) {
  const width = useWindowWidth();
  const compactBp = tokens.layout.shell;
  const meta = getFeatureMeta(feature);
  const icon = meta?.icon;

  const bar = <AppMobileHeader title={title} icon={icon} />;
  const full = (
    <NightBand compact icon={icon} kicker={audienceLabel(meta?.personas ?? [])} title={title} maxWidth={tokens.layout.wide} aside={<ToolsMenu />}>
      {children ? <Text style={styles.subtitle}>{children}</Text> : null}
    </NightBand>
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
  subtitle: {
    maxWidth: tokens.layout.measure + 120,
    fontFamily: tokens.font.sans,
    color: tokens.colors.night.muted,
    ...tokens.type.label,
  },
});
