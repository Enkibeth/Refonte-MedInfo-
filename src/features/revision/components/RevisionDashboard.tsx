/**
 * Tableau de bord d'un plan de révision (feature étudiant, ADR-0027).
 *
 * 100 % piloté par le moteur DÉTERMINISTE (src/features/revision/engine) : tout chiffre
 * affiché vient d'un calcul explicite, jamais d'une IA. « Anti-panique » : statut couleur,
 * charge quotidienne, jours tampon, progression, tâches du jour cochables.
 *
 * ⚠️ Données pédagogiques uniquement (volumes, dates, progression d'apprentissage).
 */
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { buildPlan, formatMinutes, tasksForDate } from '../engine/planner';
import { itemRemaining } from '../engine/workload';
import type { PlannedTask, RevisionItem, RiskLevel } from '../engine/types';
import type { FullPlan } from '../api';

const RISK_THEME: Record<RiskLevel, { label: string; fg: string; bg: string }> = {
  green: { label: 'Dans les temps', fg: tokens.colors.success, bg: tokens.colors.successBackground },
  orange: { label: 'Tendu', fg: tokens.colors.warningText, bg: tokens.colors.warningBackground },
  red: { label: 'Critique', fg: tokens.colors.danger, bg: tokens.colors.dangerBackground },
};

const EXAM_LABELS: Record<string, string> = {
  pass_las: 'PASS / LAS',
  dfgsm: 'DFGSM',
  edn: 'EDN',
  ecos: 'ECOS',
  custom: 'Personnalisé',
};

const WEEKDAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export interface RevisionDashboardProps {
  plan: FullPlan;
  today: string;
  /** Met à jour les blocs (ex. cocher une tâche) et déclenche une sauvegarde. */
  onItemsChange: (items: RevisionItem[]) => void;
  onEdit: () => void;
  onBack: () => void;
}

export function RevisionDashboard({
  plan,
  today,
  onItemsChange,
  onEdit,
  onBack,
}: RevisionDashboardProps) {
  const result = useMemo(
    () =>
      buildPlan({
        today,
        window: {
          startDate: plan.startDate,
          examDate: plan.examDate,
          unavailableDays: plan.unavailableDays,
          restWeekdays: plan.restWeekdays,
          dailyMaxMinutes: plan.dailyMaxMinutes,
        },
        speed: {
          pagesPerHour: plan.pagesPerHour,
          chaptersPerHour: plan.chaptersPerHour,
          qcmPerHour: plan.qcmPerHour,
        },
        items: plan.items,
        bufferRatio: plan.bufferRatio,
        spacedRepetition: plan.spacedRepetition,
      }),
    [plan, today],
  );

  const risk = RISK_THEME[result.risk.level];
  const remaining = plan.items.reduce(
    (acc, it) => {
      const r = itemRemaining(it);
      return { pages: acc.pages + r.pages, chapters: acc.chapters + r.chapters, qcm: acc.qcm + r.qcm };
    },
    { pages: 0, chapters: 0, qcm: 0 },
  );

  const todayTasks = tasksForDate(result, today).filter((t) => t.kind === 'study');
  const timeline = result.byDay.slice(0, 14);
  const maxDayMinutes = Math.max(plan.dailyMaxMinutes, ...timeline.map((d) => d.minutes), 1);

  // Cocher une tâche du jour = ajouter ses volumes aux compteurs « faits » du bloc concerné.
  function completeTask(task: PlannedTask) {
    onItemsChange(
      plan.items.map((it) =>
        it.id === task.itemId
          ? {
              ...it,
              completedPages: Math.min(it.pages, it.completedPages + task.pages),
              completedChapters: Math.min(it.chapters, it.completedChapters + task.chapters),
              completedQcm: Math.min(it.qcm, it.completedQcm + task.qcm),
            }
          : it,
      ),
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.iconBtn}>
          <Icon name="arrowRight" size={18} color={tokens.colors.textSubtle} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {plan.title || 'Plan de révision'}
          </Text>
          <Text style={styles.subtitle}>
            {EXAM_LABELS[plan.examType] ?? plan.examType} · examen dans {result.daysUntilExam} jour
            {result.daysUntilExam > 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable onPress={onEdit} accessibilityRole="button" style={styles.editBtn}>
          <Icon name="settings" size={16} color={tokens.colors.accentDeep} />
          <Text style={styles.editBtnText}>Modifier</Text>
        </Pressable>
      </View>

      {/* Bandeau de statut « anti-panique » */}
      <View style={[styles.riskBanner, { backgroundColor: risk.bg }]}>
        <Text style={[styles.riskLabel, { color: risk.fg }]}>{risk.label}</Text>
        <Text style={styles.riskReason}>{result.risk.reason}</Text>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${result.progressPercent}%`, backgroundColor: risk.fg }]}
          />
        </View>
        <Text style={styles.progressText}>{result.progressPercent}% du programme déjà couvert</Text>
      </View>

      {/* Cartes de charge */}
      <View style={styles.cardsGrid}>
        <Stat label="Charge / jour" value={formatMinutes(result.dailyAverageMinutes)} hint={`plafond ${formatMinutes(plan.dailyMaxMinutes)}`} />
        <Stat label="Cette semaine" value={formatMinutes(result.weeklyAverageMinutes)} hint="estimé" />
        <Stat label="Temps restant" value={formatMinutes(result.totalRemainingMinutes)} hint="à planifier" />
        <Stat label="Pages restantes" value={String(remaining.pages)} hint={`${remaining.chapters} chap. · ${remaining.qcm} QCM`} />
        <Stat label="Jours tampon" value={String(result.bufferDays)} hint={`${result.schedulingDays} jours de travail`} />
        <Stat
          label="Débordement"
          value={result.overflowMinutes > 0 ? formatMinutes(result.overflowMinutes) : '—'}
          hint={result.overflowMinutes > 0 ? 'ne tient pas' : 'tout tient'}
          danger={result.overflowMinutes > 0}
        />
      </View>

      {/* Aujourd'hui */}
      <Text style={styles.sectionTitle}>Aujourd’hui</Text>
      <View style={styles.card}>
        {todayTasks.length === 0 ? (
          <Text style={styles.muted}>
            Rien de planifié aujourd’hui (jour de repos, hors période, ou tout est fait).
          </Text>
        ) : (
          todayTasks.map((task, i) => (
            <Pressable
              key={`${task.itemId}-${i}`}
              onPress={() => completeTask(task)}
              accessibilityRole="button"
              style={styles.taskRow}
            >
              <View style={styles.checkbox}>
                <Icon name="plus" size={14} color={tokens.colors.accentDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskMeta}>
                  {[
                    task.pages > 0 ? `${task.pages} p.` : null,
                    task.chapters > 0 ? `${task.chapters} chap.` : null,
                    task.qcm > 0 ? `${task.qcm} QCM` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}{' '}
                  · {formatMinutes(task.minutes)}
                </Text>
              </View>
              <Text style={styles.taskDone}>Fait</Text>
            </Pressable>
          ))
        )}
      </View>

      {/* Timeline (charge des 14 prochains jours utilisables) */}
      <Text style={styles.sectionTitle}>Prochains jours</Text>
      <View style={styles.card}>
        {timeline.length === 0 ? (
          <Text style={styles.muted}>Aucun jour planifiable avant l’examen.</Text>
        ) : (
          <View style={styles.timelineRow}>
            {timeline.map((day) => {
              const h = Math.round((day.minutes / maxDayMinutes) * 64);
              const over = day.minutes > plan.dailyMaxMinutes;
              const barColor = day.buffer
                ? tokens.colors.borderStrong
                : over
                  ? tokens.colors.danger
                  : tokens.colors.accent;
              return (
                <View key={day.date} style={styles.timelineCol}>
                  <View style={styles.timelineBarTrack}>
                    <View style={[styles.timelineBar, { height: Math.max(2, h), backgroundColor: barColor }]} />
                  </View>
                  <Text style={styles.timelineDay}>{WEEKDAY_SHORT[day.weekday]}</Text>
                  <Text style={styles.timelineDate}>{day.date.slice(8, 10)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Blocs de travail */}
      <Text style={styles.sectionTitle}>Blocs de travail</Text>
      <View style={styles.card}>
        {plan.items.length === 0 ? (
          <Text style={styles.muted}>Aucun bloc. Ajoute des matières / chapitres en modifiant le plan.</Text>
        ) : (
          plan.items.map((it) => {
            const r = itemRemaining(it);
            const total = it.pages + it.chapters + it.qcm;
            const done = it.completedPages + it.completedChapters + it.completedQcm;
            const pct = total > 0 ? Math.round((done / total) * 100) : 100;
            return (
              <View key={it.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{it.title}</Text>
                  <Text style={styles.itemMeta}>
                    {it.subject ? `${it.subject} · ` : ''}
                    {r.pages} p. · {r.chapters} chap. · {r.qcm} QCM restants
                  </Text>
                </View>
                <View style={styles.itemPctWrap}>
                  <Text style={styles.itemPct}>{pct}%</Text>
                  <View style={priorityDotStyle(it.priority)} />
                </View>
              </View>
            );
          })
        )}
      </View>

      <Text style={styles.disclaimer}>
        Outil pédagogique d’organisation des révisions. Ne fournit aucun conseil médical, diagnostic
        ni prise en charge.
      </Text>
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, danger && { color: tokens.colors.danger }]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

const PRIORITY_COLORS = [tokens.colors.danger, tokens.colors.warningText, tokens.colors.success];

/** Pastille de priorité (1 haute → rouge, 2 → ambre, 3 → vert). */
function priorityDotStyle(priority: number) {
  return {
    width: 8,
    height: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: PRIORITY_COLORS[Math.min(2, Math.max(0, priority - 1))],
  };
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.md, paddingBottom: tokens.space['3xl'] },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  iconBtn: {
    width: tokens.size.iconButton,
    height: tokens.size.iconButton,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    transform: [{ scaleX: -1 }],
  },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  subtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
  },
  editBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  riskBanner: { borderRadius: tokens.radius.lg, padding: tokens.space.lg, gap: 6 },
  riskLabel: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  riskReason: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  progressTrack: {
    height: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: 'rgba(15,27,34,0.10)',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: { height: 8, borderRadius: tokens.radius.pill },
  progressText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  statCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.md,
    gap: 2,
  },
  statLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  statValue: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
  },
  statHint: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize },
  sectionTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    marginTop: tokens.space.sm,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.md,
    gap: tokens.space.sm,
  },
  muted: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.body.fontSize },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    fontWeight: tokens.weight.medium,
  },
  taskMeta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  taskDone: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  timelineCol: { alignItems: 'center', gap: 3, flex: 1 },
  timelineBarTrack: { height: 64, justifyContent: 'flex-end' },
  timelineBar: { width: 14, borderRadius: tokens.radius.xs },
  timelineDay: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize },
  timelineDate: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: tokens.type.micro.fontSize, fontWeight: tokens.weight.semibold },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  itemTitle: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.body.fontSize, fontWeight: tokens.weight.medium },
  itemMeta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  itemPctWrap: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  itemPct: { fontFamily: tokens.font.display, color: tokens.colors.text, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.bold },
  disclaimer: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    lineHeight: 16,
    marginTop: tokens.space.sm,
  },
});
