/**
 * Petites primitives animées du planificateur (ADR-0027) — sobres, design system §4.
 * Fades, croissances de barres, count-up ; aucune n'est gadget. Toutes respectent
 * `prefers-reduced-motion` (état final immédiat).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tokens } from '@/ui/tokens';
import { useReducedMotion } from '@/ui/useReducedMotion';

const GROW_DURATION = tokens.motion.duration.slow + 160;

/** Barre de progression animée (croissance de la largeur 0 → pct). `pct` ∈ [0,100]. */
export function ProgressBar({
  pct,
  color,
  track = tokens.colors.surfaceSunken,
  height = 8,
  delay = 0,
}: {
  pct: number;
  color: string;
  track?: string;
  height?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(reduced ? pct : 0)).current;
  const target = Math.max(0, Math.min(100, pct));

  useEffect(() => {
    if (reduced) {
      value.setValue(target);
      return;
    }
    const anim = Animated.timing(value, {
      toValue: target,
      duration: GROW_DURATION,
      delay,
      easing: Easing.bezier(...tokens.motion.easing.out),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [target, reduced, delay, value]);

  const width = value.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.track, { height, backgroundColor: track, borderRadius: height }]}>
      <Animated.View style={{ height, width, backgroundColor: color, borderRadius: height }} />
    </Animated.View>
  );
}

/** Entier qui « compte » de 0 jusqu'à `value` au montage. */
export function useCountUp(value: number, duration = GROW_DURATION + 40): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const av = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    av.setValue(0);
    const id = av.addListener(({ value: v }) => setDisplay(Math.round(v)));
    const anim = Animated.timing(av, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => {
      av.removeListener(id);
      anim.stop();
    };
  }, [value, reduced, duration, av]);

  return display;
}

/**
 * Rangée/carte pressable avec retour sobre :
 *   - web  : survol → léger lift (-2 px) + ombre ;
 *   - natif : appui → enfoncement (scale 0.985).
 * Respecte prefers-reduced-motion.
 */
export function PressableScale({
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
}: {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'none';
}) {
  const reduced = useReducedMotion();
  const lift = useRef(new Animated.Value(0)).current;

  const animate = (to: number) => {
    if (reduced) return;
    Animated.timing(lift, {
      toValue: to,
      duration: tokens.motion.duration.base,
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    }).start();
  };

  const translateY = lift.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 0, -2] });
  const scale = lift.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.985, 1, 1.002] });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onHoverIn={() => Platform.OS === 'web' && animate(1)}
      onHoverOut={() => Platform.OS === 'web' && animate(0)}
      onPressIn={() => Platform.OS !== 'web' && animate(-1)}
      onPressOut={() => Platform.OS !== 'web' && animate(0)}
    >
      <Animated.View style={[{ transform: [{ translateY }, { scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
});
