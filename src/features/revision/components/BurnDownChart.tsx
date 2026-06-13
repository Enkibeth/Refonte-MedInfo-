/**
 * Burn-down du plan (ADR-0027) : charge de travail RESTANTE projetée jour après jour,
 * dérivée du moteur déterministe (cumul des minutes planifiées). Doit atteindre ~0 à
 * l'examen ; si la dernière valeur reste > 0, le volume déborde. Aucune IA, aucun chiffre
 * inventé. Barres descendantes (sans SVG) ; statique sous prefers-reduced-motion via les
 * barres animées partagées.
 */
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/ui/tokens';
import { formatMinutes } from '../engine/planner';
import type { PlannerResult } from '../engine/types';

const MAX_BARS = 40;
const HEIGHT = 80;

export function BurnDownChart({ result }: { result: PlannerResult }) {
  const total = result.totalRemainingMinutes;
  if (result.byDay.length === 0 || total <= 0) {
    return <Text style={styles.muted}>Rien à projeter (aucun jour planifiable ou tout est fait).</Text>;
  }

  // Charge restante après chaque jour = total − cumul des minutes d'étude planifiées.
  let cum = 0;
  const remaining = result.byDay.map((d) => {
    cum += d.tasks.filter((t) => t.kind === 'study').reduce((s, t) => s + t.minutes, 0);
    return Math.max(0, total - cum);
  });

  // Échantillonnage si la fenêtre est longue (pour garder des barres lisibles).
  const step = Math.ceil(remaining.length / MAX_BARS);
  const sampled = remaining.filter((_, i) => i % step === 0);
  const endsAtZero = remaining[remaining.length - 1] <= 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.chartRow}>
        {sampled.map((v, i) => {
          const h = Math.max(2, Math.round((v / total) * HEIGHT));
          return (
            <View key={i} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: h, backgroundColor: tokens.colors.accent }]} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legend}>Aujourd’hui</Text>
        <Text style={styles.legend}>Examen</Text>
      </View>
      <Text style={styles.caption}>
        Charge restante : {formatMinutes(total)} →{' '}
        {endsAtZero ? '0 à l’examen (tout tient).' : `${formatMinutes(result.overflowMinutes)} encore dus à l’examen (déborde).`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.sm },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: HEIGHT },
  barCol: { flex: 1, justifyContent: 'flex-end' },
  barTrack: { height: HEIGHT, justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: tokens.radius.xs, borderTopRightRadius: tokens.radius.xs },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between' },
  legend: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize },
  caption: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  muted: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.body.fontSize },
});
