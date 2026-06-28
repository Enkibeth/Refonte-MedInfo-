import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Indique si l'utilisateur a demandé une réduction des animations.
 * - Web : média `prefers-reduced-motion: reduce` (réactif).
 * - Natif : préférence système via AccessibilityInfo (réactif).
 *
 * Toute animation d'agrément (design system §4) doit la respecter : si `true`,
 * on présente l'état final immédiatement, sans transition.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(mq.matches);
      update();
      // addEventListener moderne, fallback addListener pour Safari ancien.
      mq.addEventListener?.('change', update);
      return () => mq.removeEventListener?.('change', update);
    }

    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
