/**
 * Tableau de bord d'un plan de révision (feature étudiant, ADR-0027).
 *
 * 100 % piloté par le moteur DÉTERMINISTE (src/features/revision/engine) : tout chiffre
 * affiché vient d'un calcul explicite, jamais d'une IA. « Anti-panique » : jauge de santé,
 * charge quotidienne, jours tampon, progression, tâches du jour cochables.
 *
 * Animations sobres (design system §4) : entrées en cascade (Reveal), barres qui
 * croissent, count-up — toutes coupées sous prefers-reduced-motion.
 *
 * ⚠️ Données pédagogiques uniquement (volumes, dates, progression d'apprentissage).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/ui/icons';
import { Reveal } from '@/ui/Reveal';
import { tokens } from '@/ui/tokens';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { buildPlan, formatMinutes, tasksForDate } from '../engine/planner';
import { itemRemaining } from '../engine/workload';
import type { PlannedTask, RevisionItem } from '../engine/types';
import type { FullPlan } from '../api';
import { PlanHealthGauge } from './PlanHealthGauge';
import { ProgressBar, PressableScale } from './AnimatedBits';

const EXAM_LABELS: Record<string, string> = {
  pass_las: 'PASS / LAS',
  dfgsm: 'DFGSM',
  edn: 'EDN',
  ecos: 'ECOS',
  custom: 'Personnalisé',
};

const WEEKDAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const TIMELINE_HEIGHT = 64;

export interface RevisionDashboardProps {
  plan: FullPlan;
  today: string;
  /** Met à jour les blocs (ex. cocher une tâche) et déclenche une sauvegarde. */
  onItemsChange: (items: RevisionItem[]) => void;
  onEdit: () => void;
  onBack: () => void;
}

export function RevisionDashboard({ plan, today, onItemsChange, onEdit, onBack }: RevisionDashboardProps) {
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

  // Tâches du jour déjà cochées dans cette session (état éphémère) : on garde la trace
  // pour les afficher « faites » et éviter de re-logger la même session (le moteur, lui,
  // re-dérive le restant à chaque coche). Réinitialisé au changement de plan / de jour.
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [doneList, setDoneList] = useState<PlannedTask[]>([]);
  useEffect(() => {
    setDoneIds(new Set());
    setDoneList([]);
  }, [plan.id, today]);

  const remaining = plan.items.reduce(
    (acc, it) => {
      const r = itemRemaining(it);
      return { pages: acc.pages + r.pages, chapters: acc.chapters + r.chapters, qcm: acc.qcm + r.qcm };
    },
    { pages: 0, chapters: 0, qcm: 0 },
  );

  const allTodayTasks = tasksForDate(result, today).filter((t) => t.kind === 'study');
  // Une carte par bloc : on fusionne les tranches du même bloc planifiées le même jour.
  const activeTasks = useMemo(() => {
    const byItem = new Map<string, PlannedTask>();
    for (const t of allTodayTasks) {
      if (doneIds.has(t.itemId)) continue;
      const ex = byItem.get(t.itemId);
      byItem.set(
        t.itemId,
        ex
          ? { ...ex, pages: ex.pages + t.pages, chapters: ex.chapters + t.chapters, qcm: ex.qcm + t.qcm, minutes: ex.minutes + t.minutes }
          : { ...t },
      );
    }
    return [...byItem.values()];
  }, [allTodayTasks, doneIds]);
  const timeline = result.byDay.slice(0, 14);
  const maxDayMinutes = Math.max(plan.dailyMaxMinutes, ...timeline.map((d) => d.minutes), 1);

  // Cocher « fait » crédite TOUTE la charge du jour pour ce bloc (un jour peut contenir
  // plusieurs tranches du même bloc), puis le masque pour aujourd'hui (état éphémère).
  function completeTask(task: PlannedTask) {
    const sum = allTodayTasks
      .filter((t) => t.itemId === task.itemId)
      .reduce(
        (acc, t) => ({ pages: acc.pages + t.pages, chapters: acc.chapters + t.chapters, qcm: acc.qcm + t.qcm, minutes: acc.minutes + t.minutes }),
        { pages: 0, chapters: 0, qcm: 0, minutes: 0 },
      );
    setDoneIds((prev) => new Set(prev).add(task.itemId));
    setDoneList((prev) => [...prev, { ...task, ...sum }]);
    onItemsChange(
      plan.items.map((it) =>
        it.id === task.itemId
          ? {
              ...it,
              completedPages: Math.min(it.pages, it.completedPages + sum.pages),
              completedChapters: Math.min(it.chapters, it.completedChapters + sum.chapters),
              completedQcm: Math.min(it.qcm, it.completedQcm + sum.qcm),
            }
          : it,
      ),
    );
  }

  const taskAmounts = (t: PlannedTask) =>
    [
      t.pages > 0 ? `${t.pages} p.` : null,
      t.chapters > 0 ? `${t.chapters} chap.` : null,
      t.qcm > 0 ? `${t.qcm} QCM` : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const stagger = tokens.motion.revealStagger;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour à mes plans" style={styles.iconBtn}>
          <Icon name="arrowLeft" size={18} color={tokens.colors.textSubtle} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {plan.title || 'Plan de révision'}
          </Text>
          <Text style={styles.subtitle}>{EXAM_LABELS[plan.examType] ?? plan.examType}</Text>
        </View>
        <PressableScale onPress={onEdit} accessibilityLabel="Modifier le plan" style={styles.editBtn}>
          <Icon name="settings" size={16} color={tokens.colors.accentDeep} />
          <Text style={styles.editBtnText}>Modifier</Text>
        </PressableScale>
      </View>

      <Reveal delay={0}>
        <PlanHealthGauge result={result} examDate={plan.examDate} />
      </Reveal>

      {/* Cartes de charge */}
      <Reveal delay={stagger}>
        <View style={styles.cardsGrid}>
          <Stat label="Charge / jour" value={formatMinutes(result.dailyAverageMinutes)} hint={`plafond ${formatMinutes(plan.dailyMaxMinutes)}`} />
          <Stat label="Cette semaine" value={formatMinutes(result.weeklyAverageMinutes)} hint="estimé" />
          <Stat label="Temps restant" value={formatMinutes(result.totalRemainingMinutes)} hint="à planifier" />
          <Stat label="Pages restantes" value={String(remaining.pages)} hint={`${remaining.chapters} chap. · ${remaining.qcm} QCM`} />
          <Stat label="Jours tampon" value={String(result.bufferDays)} hint={`${result.schedulingDays} j. de travail`} />
          <Stat
            label="Débordement"
            value={result.overflowMinutes > 0 ? formatMinutes(result.overflowMinutes) : '—'}
            hint={result.overflowMinutes > 0 ? 'ne tient pas' : 'tout tient'}
            danger={result.overflowMinutes > 0}
          />
        </View>
      </Reveal>

      {/* Aujourd'hui */}
      <Reveal delay={stagger * 2}>
        <Text style={styles.sectionTitle}>Aujourd’hui</Text>
        <View style={styles.card}>
          {activeTasks.length === 0 && doneList.length === 0 ? (
            <Text style={styles.muted}>
              Rien de planifié aujourd’hui (jour de repos, hors période, ou tout est fait).
            </Text>
          ) : (
            <>
              {activeTasks.map((task, i) => (
                <PressableScale
                  key={`${task.itemId}-${i}`}
                  onPress={() => completeTask(task)}
                  accessibilityLabel={`Marquer fait : ${task.title}, ${taskAmounts(task)}, ${formatMinutes(task.minutes)}`}
                  style={styles.taskRow}
                >
                  <View style={styles.checkbox}>
                    <Icon name="check" size={14} color={tokens.colors.accentDeep} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskMeta}>
                      {taskAmounts(task)} · {formatMinutes(task.minutes)}
                    </Text>
                  </View>
                  <Text style={styles.taskCta}>Fait</Text>
                </PressableScale>
              ))}
              {doneList.map((task, i) => (
                <View key={`done-${task.itemId}-${i}`} style={styles.taskRow}>
                  <View style={styles.checkboxDone}>
                    <Icon name="check" size={14} color={tokens.colors.onAccent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, styles.taskTitleDone]}>{task.title}</Text>
                    <Text style={styles.taskMeta}>{taskAmounts(task)} · fait</Text>
                  </View>
                </View>
              ))}
              {activeTasks.length === 0 && doneList.length > 0 ? (
                <Text style={styles.muted}>Journée terminée — beau travail.</Text>
              ) : null}
            </>
          )}
        </View>
      </Reveal>

      {/* Timeline (charge des 14 prochains jours utilisables) */}
      <Reveal delay={stagger * 3}>
        <Text style={styles.sectionTitle}>Prochains jours</Text>
        <View style={styles.card}>
          {timeline.length === 0 ? (
            <Text style={styles.muted}>Aucun jour planifiable avant l’examen.</Text>
          ) : (
            <View style={styles.timelineRow}>
              {timeline.map((day) => {
                const over = day.minutes > plan.dailyMaxMinutes;
                const isToday = day.date === today;
                const barColor = day.buffer
                  ? tokens.colors.borderStrong
                  : over
                    ? tokens.colors.danger
                    : tokens.colors.accent;
                return (
                  <View key={day.date} style={styles.timelineCol}>
                    <View style={styles.timelineBarTrack}>
                      <TimelineBar minutes={day.minutes} maxMinutes={maxDayMinutes} color={barColor} />
                    </View>
                    <Text style={[styles.timelineDay, isToday && styles.timelineTodayText]}>
                      {WEEKDAY_SHORT[day.weekday]}
                    </Text>
                    <View style={isToday ? styles.timelineTodayPill : undefined}>
                      <Text style={[styles.timelineDate, isToday && styles.timelineTodayText]}>
                        {day.date.slice(8, 10)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Reveal>

      {/* Blocs de travail */}
      <Reveal delay={stagger * 4}>
        <Text style={styles.sectionTitle}>Blocs de travail</Text>
        <View style={styles.card}>
          {plan.items.length === 0 ? (
            <Text style={styles.muted}>Aucun bloc. Ajoute des matières / chapitres en modifiant le plan.</Text>
          ) : (
            plan.items.map((it, i) => {
              const r = itemRemaining(it);
              const total = it.pages + it.chapters + it.qcm;
              const done = it.completedPages + it.completedChapters + it.completedQcm;
              const pct = total > 0 ? Math.round((done / total) * 100) : 100;
              return (
                <View key={it.id} style={styles.itemRow}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemTitleRow}>
                        <View style={priorityDotStyle(it.priority)} />
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {it.title}
                        </Text>
                      </View>
                      <Text style={styles.itemMeta}>
                        {it.subject ? `${it.subject} · ` : ''}
                        {r.pages} p. · {r.chapters} chap. · {r.qcm} QCM restants
                      </Text>
                    </View>
                    <Text style={styles.itemPct}>{pct}%</Text>
                  </View>
                  <ProgressBar
                    pct={pct}
                    color={pct >= 100 ? tokens.colors.success : tokens.colors.accent}
                    height={6}
                    delay={i * 40}
                  />
                </View>
              );
            })
          )}
        </View>
      </Reveal>

      <Text style={styles.disclaimer}>
        Outil pédagogique d’organisation des révisions. Ne fournit aucun conseil médical, diagnostic
        ni prise en charge.
      </Text>
    </ScrollView>
  );
}

/** Barre de timeline qui croît du bas vers sa hauteur cible au montage. */
function TimelineBar({ minutes, maxMinutes, color }: { minutes: number; maxMinutes: number; color: string }) {
  const reduced = useReducedMotion();
  const target = Math.max(2, Math.round((minutes / maxMinutes) * TIMELINE_HEIGHT));
  const h = useRef(new Animated.Value(reduced ? target : 2)).current;
  useEffect(() => {
    if (reduced) {
      h.setValue(target);
      return;
    }
    const anim = Animated.timing(h, {
      toValue: target,
      duration: tokens.motion.duration.slow,
      easing: Easing.bezier(...tokens.motion.easing.out),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [target, reduced, h]);
  return <Animated.View style={[styles.timelineBar, { height: h, backgroundColor: color }]} />;
}

function Stat({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
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
  },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  subtitle: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize, marginTop: 2 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    ...tokens.motion.transitionWeb,
  },
  editBtnText: { fontFamily: tokens.font.sans, color: tokens.colors.accentDeep, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.semibold },
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
    ...tokens.elevation.sm,
  },
  statLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  statValue: { fontFamily: tokens.font.display, color: tokens.colors.text, fontSize: tokens.type.h3.fontSize, fontWeight: tokens.weight.bold },
  statHint: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize },
  sectionTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.sm,
    marginTop: tokens.space.xs,
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
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.motion.transitionWeb,
  },
  checkboxDone: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.body.fontSize, fontWeight: tokens.weight.medium },
  taskTitleDone: { color: tokens.colors.textMuted, textDecorationLine: 'line-through' },
  taskMeta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  taskCta: { fontFamily: tokens.font.sans, color: tokens.colors.accent, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.semibold },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  timelineCol: { alignItems: 'center', gap: 3, flex: 1 },
  timelineBarTrack: { height: TIMELINE_HEIGHT, justifyContent: 'flex-end' },
  timelineBar: { width: 14, borderRadius: tokens.radius.xs },
  timelineDay: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize },
  timelineDate: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: tokens.type.micro.fontSize, fontWeight: tokens.weight.semibold },
  timelineTodayText: { color: tokens.colors.onAccent },
  timelineTodayPill: {
    backgroundColor: tokens.colors.accent,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 6,
    minWidth: 20,
    alignItems: 'center',
  },
  itemRow: { gap: tokens.space.sm, paddingVertical: tokens.space.xs },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.md },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  itemTitle: { flex: 1, fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.body.fontSize, fontWeight: tokens.weight.medium },
  itemMeta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize, marginTop: 2 },
  itemPct: { fontFamily: tokens.font.display, color: tokens.colors.text, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.bold },
  disclaimer: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    lineHeight: 16,
    marginTop: tokens.space.sm,
  },
});
