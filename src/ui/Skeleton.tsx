import { View, type StyleProp, type ViewStyle } from 'react-native';
import { tokens } from './tokens';

/** Gabarit statique : dimensions du contenu final, sans animation décorative. */
export function Skeleton({ width, height = tokens.type.label.lineHeight, radius = tokens.radius.sm, style }: {
  width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle>;
}) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[{ width: width ?? '100%', height, borderRadius: radius, backgroundColor: tokens.colors.surfaceSunken }, style]} />;
}
