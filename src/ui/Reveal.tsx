import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from './tokens';
import { useReducedMotion } from './useReducedMotion';

/**
 * Entrée animée sobre (design system §4) : fade + remontée de quelques pixels,
 * easing « sortie douce ». Pas de bounce, pas de spring. Utilisable en séquence
 * via `delay` (cf. tokens.motion.revealStagger).
 *
 * Respecte `prefers-reduced-motion` : si l'utilisateur l'a demandé, le contenu
 * apparaît immédiatement à son état final, sans transition.
 */
export function Reveal({
  children,
  delay = 0,
  offset = tokens.motion.revealOffset,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: tokens.motion.duration.slow + 140,
      delay,
      easing: Easing.bezier(...tokens.motion.easing.out),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, delay, progress]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
