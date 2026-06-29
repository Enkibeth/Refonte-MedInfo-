/**
 * Widgets de présentation du dashboard de révision (ADR-0027) — composants natifs
 * token-driven (jamais d'iframe, jamais d'emoji, valeurs design via tokens).
 * Purement présentationnels : ils reçoivent les chiffres calculés par le moteur.
 */
import { View, Text, StyleSheet } from 'react-native';

import { tokens } from '@/ui/tokens';
import type { DailyLoad, RiskAssessment, RiskLevel } from '@/revision/types';

/** Minutes → libellé court « 2 h 45 » / « 45 min ». */
export function formatMinutes(min: number): string {
  const rounded = Math.round(min);
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

const RISK_STYLE: Record<RiskLevel, { fg: string; bg: string; label: string }> = {
  green: { fg: tokens.colors.success, bg: tokens.colors.successBackground, label: 'Dans les temps' },
  orange: { fg: tokens.colors.warningText, bg: tokens.colors.warningBackground, label: 'Plan tendu' },
  red: { fg: tokens.colors.danger, bg: tokens.colors.dangerBackground, label: 'En surcharge' },
};

/** Tuile statistique (libellé + valeur + indication). */
export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </View>
  );
}

/** Jauge de risque anti-panique (vert / orange / rouge). */
export function PlanHealthGauge({ risk }: { risk: RiskAssessment }) {
  const s = RISK_STYLE[risk.level];
  const ratio = Number.isFinite(risk.capacityRatio) ? risk.capacityRatio : 1.5;
  const fill = Math.max(0.04, Math.min(1, ratio));
  return (
    <View style={[styles.gauge, { backgroundColor: s.bg }]}>
      <View style={styles.gaugeHead}>
        <Text style={[styles.gaugeLabel, { color: s.fg }]}>{s.label}</Text>
        <Text style={[styles.gaugePct, { color: s.fg }]}>
          {Number.isFinite(risk.capacityRatio) ? `${Math.round(risk.capacityRatio * 100)} %` : '—'}
        </Text>
      </View>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeFill, { width: `${fill * 100}%`, backgroundColor: s.fg }]} />
      </View>
      <Text style={styles.gaugeReason}>{risk.reason}</Text>
    </View>
  );
}

/** Barre de charge d'une journée (orange/rouge si surcharge). */
export function DailyLoadBar({ load, maxMinutes }: { load: DailyLoad; maxMinutes: number }) {
  const ratio = maxMinutes > 0 ? Math.min(1, load.minutes / maxMinutes) : load.minutes > 0 ? 1 : 0;
  const fg = load.overCapacity ? tokens.colors.danger : tokens.colors.accent;
  return (
    <View style={styles.dayRow}>
      <Text style={styles.dayDate}>{formatDayLabel(load.date)}</Text>
      <View style={styles.dayTrack}>
        <View style={[styles.dayFill, { width: `${Math.max(2, ratio * 100)}%`, backgroundColor: fg }]} />
      </View>
      <Text style={[styles.dayMinutes, load.overCapacity && { color: tokens.colors.danger }]}>
        {load.minutes > 0 ? formatMinutes(load.minutes) : '—'}
      </Text>
    </View>
  );
}

/** ISO `YYYY-MM-DD` → « lun. 6 janv. ». */
export function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.md,
    gap: 2,
  },
  tileLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  tileValue: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.type.h3.letterSpacing,
  },
  tileHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  gauge: {
    borderRadius: tokens.radius.md,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
  },
  gaugeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  gaugeLabel: {
    fontFamily: tokens.font.display,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.type.h3.letterSpacing,
  },
  gaugePct: { fontFamily: tokens.font.display, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.bold },
  gaugeTrack: {
    height: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surface,
    overflow: 'hidden',
  },
  gaugeFill: { height: 8, borderRadius: tokens.radius.pill },
  gaugeReason: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  dayDate: {
    width: 92,
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
  },
  dayTrack: {
    flex: 1,
    height: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSunken,
    overflow: 'hidden',
  },
  dayFill: { height: 10, borderRadius: tokens.radius.pill },
  dayMinutes: {
    width: 64,
    textAlign: 'right',
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});
