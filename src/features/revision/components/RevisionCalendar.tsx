/**
 * Vue calendrier (mois) du plan (ADR-0027). Chaque jour est coloré selon la charge
 * planifiée par le moteur déterministe (jour de travail / tampon / surcharge / repos).
 * Navigation bornée à la fenêtre du plan. Aucune IA, aucun chiffre inventé.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { formatMinutes } from '../engine/planner';
import type { DayLoad, PlannerResult } from '../engine/types';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // lundi → dimanche
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function ym(date: string): { year: number; month: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 };
}
function ymIndex(year: number, month: number): number {
  return year * 12 + month;
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function RevisionCalendar({
  result,
  today,
  startDate,
  examDate,
  dailyMax,
}: {
  result: PlannerResult;
  today: string;
  startDate: string;
  examDate: string;
  dailyMax: number;
}) {
  const byDay = useMemo(() => {
    const m = new Map<string, DayLoad>();
    for (const d of result.byDay) m.set(d.date, d);
    return m;
  }, [result]);

  const minIdx = ymIndex(ym(startDate).year, ym(startDate).month);
  const maxIdx = ymIndex(ym(examDate).year, ym(examDate).month);
  const initial = ym(today);
  const initialIdx = Math.min(maxIdx, Math.max(minIdx, ymIndex(initial.year, initial.month)));

  const [cursor, setCursor] = useState(initialIdx);
  const year = Math.floor(cursor / 12);
  const month = cursor % 12;

  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`),
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.navRow}>
        <Pressable
          onPress={() => setCursor((c) => Math.max(minIdx, c - 1))}
          disabled={cursor <= minIdx}
          style={[styles.navBtn, cursor <= minIdx && styles.navDisabled]}
          accessibilityLabel="Mois précédent"
        >
          <Icon name="arrowLeft" size={16} color={tokens.colors.textSubtle} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTHS[month]} {year}
        </Text>
        <Pressable
          onPress={() => setCursor((c) => Math.min(maxIdx, c + 1))}
          disabled={cursor >= maxIdx}
          style={[styles.navBtn, cursor >= maxIdx && styles.navDisabled]}
          accessibilityLabel="Mois suivant"
        >
          <Icon name="arrowRight" size={16} color={tokens.colors.textSubtle} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`b${i}`} style={styles.cell} />;
          const day = byDay.get(date);
          const isToday = date === today;
          const over = day ? day.minutes > dailyMax : false;
          const bg = !day
            ? tokens.colors.surface
            : day.buffer
              ? tokens.colors.surfaceSunken
              : over
                ? tokens.colors.dangerBackground
                : day.minutes > 0
                  ? tokens.colors.accentSurface
                  : tokens.colors.surface;
          return (
            <View key={date} style={[styles.cell, { backgroundColor: bg }, isToday && styles.cellToday]}>
              <Text style={[styles.cellNum, isToday && styles.cellNumToday]}>{Number(date.slice(8, 10))}</Text>
              {day && day.minutes > 0 ? (
                <Text style={styles.cellLoad} numberOfLines={1}>
                  {formatMinutes(day.minutes)}
                </Text>
              ) : day?.buffer ? (
                <Text style={styles.cellTag}>tampon</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <Legend color={tokens.colors.accentSurface} label="travail" />
        <Legend color={tokens.colors.surfaceSunken} label="tampon" />
        <Legend color={tokens.colors.dangerBackground} label="surcharge" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.sm },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: tokens.size.iconButton,
    height: tokens.size.iconButton,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
  },
  navDisabled: { opacity: 0.35 },
  monthLabel: { fontFamily: tokens.font.display, color: tokens.colors.text, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.bold },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 3,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  cellToday: { borderColor: tokens.colors.accent, borderWidth: 2 },
  cellNum: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.micro.fontSize, fontWeight: tokens.weight.semibold },
  cellNumToday: { color: tokens.colors.accentDeep },
  cellLoad: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: 9, lineHeight: 11 },
  cellTag: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: 8, lineHeight: 10 },
  legendRow: { flexDirection: 'row', gap: tokens.space.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3, borderWidth: 1, borderColor: tokens.colors.border },
  legendText: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize },
});
