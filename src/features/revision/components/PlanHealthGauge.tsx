/**
 * « Jauge de santé » du plan (hero du tableau de bord, ADR-0027) — anti-panique.
 *
 * Tout est dérivé du moteur déterministe : compte à rebours, statut couleur,
 * progression (count-up + barre animée) et jauge charge/capacité (marqueur
 * positionné sur le ratio). Aucune IA, aucun chiffre inventé.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/ui/tokens';
import { useReducedMotion } from '@/ui/useReducedMotion';
import type { PlannerResult, RiskLevel } from '../engine/types';
import { ProgressBar, useCountUp } from './AnimatedBits';

const RISK_THEME: Record<RiskLevel, { label: string; fg: string; soft: string }> = {
  green: { label: 'Dans les temps', fg: tokens.colors.success, soft: tokens.colors.successBackground },
  orange: { label: 'Tendu', fg: tokens.colors.warningText, soft: tokens.colors.warningBackground },
  red: { label: 'Critique', fg: tokens.colors.danger, soft: tokens.colors.dangerBackground },
};

// La jauge couvre un ratio charge/capacité de 0 à 1.3 ; au-delà = saturée à droite.
const GAUGE_MAX = 1.3;

export function PlanHealthGauge({ result, examDate }: { result: PlannerResult; examDate: string }) {
  const reduced = useReducedMotion();
  const risk = RISK_THEME[result.risk.level];
  const days = useCountUp(result.daysUntilExam);
  const coverage = useCountUp(result.progressPercent);

  // Marqueur de charge : position animée sur la piste (0 → ratio/1.3).
  const markerPos = Math.max(0, Math.min(1, result.risk.loadRatio / GAUGE_MAX));
  const marker = useRef(new Animated.Value(reduced ? markerPos : 0)).current;
  useEffect(() => {
    if (reduced) {
      marker.setValue(markerPos);
      return;
    }
    const anim = Animated.timing(marker, {
      toValue: markerPos,
      duration: tokens.motion.duration.slow + 200,
      easing: Easing.bezier(...tokens.motion.easing.out),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [markerPos, reduced, marker]);

  const markerLeft = marker.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });

  return (
    <View style={[styles.card, { borderColor: risk.soft }]}>
      <View style={styles.topRow}>
        <View style={styles.countdownWrap}>
          <Text style={styles.countdownNum}>{days}</Text>
          <View>
            <Text style={styles.countdownLabel}>
              jour{result.daysUntilExam > 1 ? 's' : ''} avant l’examen
            </Text>
            <Text style={styles.examDate}>le {examDate}</Text>
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: risk.soft }]}>
          <View style={[styles.statusDot, { backgroundColor: risk.fg }]} />
          <Text style={[styles.statusText, { color: risk.fg }]}>{risk.label}</Text>
        </View>
      </View>

      <Text style={styles.reason}>{result.risk.reason}</Text>

      {/* Progression du programme */}
      <View style={styles.metricHead}>
        <Text style={styles.metricLabel}>Programme couvert</Text>
        <Text style={styles.metricValue}>{coverage}%</Text>
      </View>
      <ProgressBar pct={result.progressPercent} color={risk.fg} height={10} />

      {/* Jauge charge / capacité */}
      <View style={[styles.metricHead, { marginTop: tokens.space.md }]}>
        <Text style={styles.metricLabel}>Charge / capacité</Text>
        <Text style={styles.metricValue}>{Math.round(result.risk.loadRatio * 100)}%</Text>
      </View>
      <View style={styles.gaugeWrap}>
        <View style={styles.gaugeTrack}>
          <View style={[styles.gaugeZone, { flex: 0.8, backgroundColor: tokens.colors.successBackground }]} />
          <View style={[styles.gaugeZone, { flex: 0.3, backgroundColor: tokens.colors.warningBackground }]} />
          <View style={[styles.gaugeZone, { flex: 0.2, backgroundColor: tokens.colors.dangerBackground }]} />
        </View>
        <Animated.View style={[styles.gaugeMarker, { left: markerLeft }]}>
          <View style={[styles.gaugeMarkerDot, { borderColor: risk.fg }]} />
        </Animated.View>
      </View>
      <Text style={styles.gaugeCaption}>
        Confortable · Tendu · Surcharge — repère = ta charge quotidienne moyenne vs ton plafond.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.elevation.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  countdownWrap: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md, flexShrink: 1 },
  countdownNum: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  countdownLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    maxWidth: 120,
  },
  examDate: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
  },
  statusDot: { width: 8, height: 8, borderRadius: tokens.radius.pill },
  statusText: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  reason: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  metricHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: tokens.space.xs },
  metricLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  metricValue: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
  },
  gaugeWrap: { position: 'relative', justifyContent: 'center', height: 18 },
  gaugeTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: tokens.radius.pill,
    overflow: 'hidden',
  },
  gaugeZone: { height: 12 },
  gaugeMarker: {
    position: 'absolute',
    top: 0,
    width: 1,
    marginLeft: -9,
    alignItems: 'center',
  },
  gaugeMarkerDot: {
    width: 18,
    height: 18,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surface,
    borderWidth: 3,
    ...tokens.elevation.sm,
  },
  gaugeCaption: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    lineHeight: 16,
  },
});
