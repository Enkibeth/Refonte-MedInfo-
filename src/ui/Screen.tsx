import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from './tokens';
import { useWindowWidth } from './useWindowWidth';

/**
 * Conteneur d'écran (05_DESIGN §5). Fond d'app + colonne centrée à largeur
 * mesurée, alignée vers le haut avec une marge généreuse — on évite la carte
 * « flottante au centre vertical » typique des templates générés.
 *
 * `band` (ADR-0047) : bandeau « Moniteur » (`NightBand`) posé en pleine largeur au-dessus de
 * la colonne ; il porte alors le titre de niveau 1 de l'écran.
 */
export function Screen({
  children,
  maxWidth = tokens.layout.reading,
  center = false,
  contentStyle,
  band,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  center?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  band?: React.ReactNode;
}) {
  const width = useWindowWidth();
  const compact = width < tokens.layout.compact;
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, compact && styles.compact, center && styles.centerV, band ? styles.withBand : null]}
      keyboardShouldPersistTaps="handled"
    >
      {band}
      <View style={[styles.column, { maxWidth }, band ? styles.columnAfterBand : null, compact && band ? styles.columnCompact : null, contentStyle]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.colors.background },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['3xl'],
    paddingBottom: tokens.space['3xl'],
  },
  compact: { paddingHorizontal: tokens.space.lg, paddingTop: tokens.space.xl },
  centerV: { justifyContent: 'center' },
  column: { width: '100%' },
  // Avec bandeau : il occupe toute la largeur, la colonne reprend les marges sous lui.
  withBand: { paddingHorizontal: 0, paddingTop: 0 },
  columnAfterBand: { paddingHorizontal: tokens.space.xl, paddingTop: tokens.space['2xl'] },
  columnCompact: { paddingHorizontal: tokens.space.lg, paddingTop: tokens.space.xl },
});
