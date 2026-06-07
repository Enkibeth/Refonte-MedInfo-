import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from './tokens';

/**
 * Conteneur d'écran (05_DESIGN §5). Fond d'app + colonne centrée à largeur
 * mesurée, alignée vers le haut avec une marge généreuse — on évite la carte
 * « flottante au centre vertical » typique des templates générés.
 */
export function Screen({
  children,
  maxWidth = 720,
  center = false,
  contentStyle,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  center?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, center && styles.centerV]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.column, { maxWidth }, contentStyle]}>{children}</View>
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
  centerV: { justifyContent: 'center' },
  column: { width: '100%' },
});
