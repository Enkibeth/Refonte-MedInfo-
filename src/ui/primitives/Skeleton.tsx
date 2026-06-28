import { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from '@/ui/theme/tokens';
import { useReducedMotion } from '@/ui/theme/useReducedMotion';

/**
 * Squelette de chargement (design system §4) : bloc neutre qui pulse doucement
 * (opacité 0.45 ↔ 0.9), sans balayage criard. Cross-platform (Animated), statique
 * sous prefers-reduced-motion.
 */
export function Skeleton({
  width,
  height = 14,
  radius = tokens.radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (reduced) {
      pulse.setValue(0.65);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius: radius,
          backgroundColor: tokens.colors.surfaceSunken,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}
