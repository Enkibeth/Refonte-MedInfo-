import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from './tokens';
import { useReducedMotion } from './useReducedMotion';

/**
 * Entrée animée sobre (design system §4) : fade + remontée de quelques pixels,
 * easing « sortie douce ». Pas de bounce, pas de spring. Utilisable en séquence
 * via `delay` (cf. tokens.motion.revealStagger).
 *
 * Sur le web, l'entrée est déclenchée au scroll (IntersectionObserver) : un bloc
 * sous la ligne de flottaison se révèle quand il entre dans le viewport, pas au
 * montage. Une seule fois par bloc — jamais de re-animation en remontant.
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
  const hostRef = useRef<React.ComponentRef<typeof Animated.View> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }

    let anim: Animated.CompositeAnimation | null = null;
    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      anim = Animated.timing(progress, {
        toValue: 1,
        duration: tokens.motion.duration.slow + 140,
        delay,
        easing: Easing.bezier(...tokens.motion.easing.out),
        useNativeDriver: true,
      });
      anim.start();
    };

    // Web : sur RN-web, la ref d'Animated.View expose le nœud DOM → observable.
    const node = hostRef.current as unknown as Element | null;
    if (
      Platform.OS === 'web' &&
      typeof IntersectionObserver !== 'undefined' &&
      node &&
      typeof (node as { nodeType?: number }).nodeType === 'number'
    ) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            start();
            observer.disconnect();
          }
        },
        { threshold: 0.1 },
      );
      observer.observe(node);
      return () => {
        observer.disconnect();
        anim?.stop();
      };
    }

    // Natif (ou observer indisponible) : entrée au montage, comme avant.
    start();
    return () => anim?.stop();
  }, [reduced, delay, progress]);

  return (
    <Animated.View
      ref={hostRef}
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
