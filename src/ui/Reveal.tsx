import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tokens } from './tokens';
import { useReducedMotion } from './useReducedMotion';

/**
 * Entrée animée sobre (design system §4) : fade + remontée de quelques pixels,
 * easing « sortie douce ». Pas de bounce, pas de spring. Utilisable en séquence
 * via `delay` (cf. tokens.motion.revealStagger).
 *
 * Sur le web, l'entrée est déclenchée au scroll : un bloc sous la ligne de
 * flottaison se révèle quand il entre dans le viewport, une seule fois. Le
 * déclencheur observe une sentinelle DOM 1×1 posée en haut du bloc — la ref
 * d'un View RNW est un vrai nœud DOM, contrairement à celle d'Animated.View
 * (piège vérifié : l'observer ne s'attache jamais dessus). Un bloc déjà
 * visible au chargement entre immédiatement.
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
  const sentinelRef = useRef<View | null>(null);

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }

    let anim: Animated.CompositeAnimation | null = null;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      anim = Animated.timing(progress, {
        toValue: 1,
        duration: tokens.motion.duration.slow + 140,
        delay,
        easing: Easing.bezier(...tokens.motion.easing.out),
        useNativeDriver: true,
      });
      anim.start();
    };

    const node = sentinelRef.current as unknown as Element | null;
    if (
      Platform.OS === 'web' &&
      typeof IntersectionObserver !== 'undefined' &&
      typeof window !== 'undefined' &&
      node &&
      typeof node.getBoundingClientRect === 'function'
    ) {
      // Bloc déjà dans (ou au-dessus de) la fenêtre : entrée immédiate — couvre
      // le premier écran et un rechargement en milieu de page.
      if (node.getBoundingClientRect().top < window.innerHeight) {
        start();
        return () => anim?.stop();
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            start();
            observer.disconnect();
          }
        },
        // Déclenche quand le haut du bloc dépasse de 40 px la ligne basse du viewport.
        { rootMargin: '0px 0px -40px 0px' },
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
      {Platform.OS === 'web' ? (
        <View ref={sentinelRef} pointerEvents="none" style={styles.sentinel} />
      ) : null}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sentinel: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0 },
});
