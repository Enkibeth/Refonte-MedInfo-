/**
 * Anneau de progression du chat — implémentation NATIVE (2026-08).
 *
 * L'app est web-first : la version riche (arc SVG exact qui se remplit) vit dans
 * `ChatStatusRing.web.tsx`, résolue automatiquement par Metro. Ici, sans SVG ni reanimated,
 * un arc de longueur arbitraire demanderait deux demi-disques masqués et pivotés — une
 * géométrie fragile, invérifiable autrement qu'à l'œil sur un appareil. On s'en tient donc
 * à ce qui est sûr et rend bien : un anneau dont un quart tourne (le travail est en cours),
 * l'icône de l'étape au centre, et trois pastilles qui marquent le chemin parcouru.
 *
 * L'ÉVOLUTION reste lisible — l'icône, le libellé et les pastilles changent à chaque phase
 * (raisonnement → recherche sur Internet → rédaction). Mouvement coupé sous
 * `prefers-reduced-motion`.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import {
  CHAT_PHASE_ORDER,
  chatPhaseView,
  isPhaseDone,
  type ChatPhase,
} from '@/ai/chat/statusPhases';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { useReducedMotion } from '@/ui/useReducedMotion';

const SIZE = 40;
const STROKE = 3;

export function ChatStatusRing({
  phase,
  label,
  elapsed,
}: {
  phase: ChatPhase;
  label: string;
  elapsed?: string | null;
}) {
  const reducedMotion = useReducedMotion();
  const view = chatPhaseView(phase);
  const color = phase === 'recovering' ? tokens.colors.textMuted : tokens.colors.accent;

  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, reducedMotion]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.root} accessibilityLabel={label} accessibilityLiveRegion="polite">
      <View style={styles.ringWrap}>
        <View style={styles.track} />
        {/* Un seul bord coloré : en rotation, il dessine l'arc qui court autour du cercle. */}
        <Animated.View
          style={[styles.arc, { borderTopColor: color, transform: [{ rotate }] }]}
        />
        <View style={styles.iconCenter} pointerEvents="none">
          <Icon name={view.icon} size={15} color={color} />
        </View>
      </View>

      <View style={styles.textCol}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.stepsRow}>
          {CHAT_PHASE_ORDER.map((step) => {
            const done = isPhaseDone(step, phase);
            const current = step === phase;
            return (
              <View
                key={step}
                style={[
                  styles.stepDot,
                  (done || current) && styles.stepDotActive,
                  current && styles.stepDotCurrent,
                ]}
              />
            );
          })}
          {elapsed ? <Text style={styles.elapsed}>{elapsed}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  ringWrap: { width: SIZE, height: SIZE },
  track: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: STROKE,
    borderColor: tokens.colors.border,
  },
  arc: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: STROKE,
    borderColor: 'transparent',
  },
  iconCenter: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 4 },
  label: { fontSize: 14, color: tokens.colors.textMuted, fontWeight: '500' },
  stepsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: tokens.colors.border },
  stepDotActive: { backgroundColor: tokens.colors.accent },
  stepDotCurrent: { width: 14 },
  elapsed: { marginLeft: tokens.space.sm, fontSize: 12, color: tokens.colors.textMuted },
});
