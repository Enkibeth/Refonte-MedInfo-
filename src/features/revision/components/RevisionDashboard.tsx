/**
 * Tableau de bord d'un plan de révision (feature étudiant, ADR-0027).
 *
 * 100 % piloté par le moteur DÉTERMINISTE (src/features/revision/engine) : tout chiffre
 * affiché vient d'un calcul explicite. L'« AI Boost » ne fait que PROPOSER (l'utilisateur
 * valide). « Anti-panique » : jauge de santé, charge, jours tampon, progression, tâches
 * du jour cochables (avec annulation), visualisations (semaine / mois / burn-down).
 *
 * Animations sobres (design system §4) : entrées en cascade, barres qui croissent,
 * count-up — toutes coupées sous prefers-reduced-motion.
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
import { applyBoostSuggestion, type BoostSuggestion } from '../boost';
import { PlanHealthGauge } from './PlanHealthGauge';
import { AiBoostPanel } from './AiBoostPanel';
import { RevisionCalendar } from './RevisionCalendar';
import { BurnDownChart } from './BurnDownChart';
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
type VizMode = 'week' | 'month' | 'burndown';
const VIZ: { key: VizMode; label: string }[] = [
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'burndown', label: 'Burn-down' },
];

export interface RevisionDashboardProps {
  plan: FullPlan;
  today: string;
  token: string | null;
  /** Met à jour le plan (tâche cochée, progression, suggestion appliquée) → persistance. */
  onPlanChange: (plan: FullPlan) => void;
  onEdit: () => void;
  onBack: () => void;
}

export function RevisionDashboard({ plan, today, token, onPlanChange, onEdit, onBack }: RevisionDashboardProps) {
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
        speed: { pagesPerHour: plan.pagesPerHour, chaptersPerHour: plan.chaptersPerHour, qcmPerHour: plan.qcmPerHour },
        items: plan.items,
        bufferRatio: plan.bufferRatio,
        spacedRepetition: plan.spacedRepetition,
      }),
    [plan, today],
  );

  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [doneList, setDoneList] = useState<PlannedTask[]>([]);
  const [viz, setViz] = useState<VizMode>('week');
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  useEffect(() => {
    setDoneIds(new Set());
    setDoneList([]);
  }, [plan.id, today]);

  const updateItems = (items: RevisionItem[]) => onPlanChange({ ...plan, items });

  const remaining = plan.items.reduce(
    (acc, it) => {
      const r = itemRemaining(it);
      return { pages: acc.pages + r.pages, chapters: acc.chapters + r.chapters, qcm: acc.qcm + r.qcm };
    },
    { pages: 0, chapters: 0, qcm: 0 },
  );

  const allTodayTasks = tasksForDate(result, today).filter((t) => t.kind === 'study');
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

  function completeTask(task: PlannedTask) {
    const sum = allTodayTasks
      .filter((t) => t.itemId === task.itemId)
      .reduce((acc, t) => ({ pages: acc.pages + t.pages, chapters: acc.chapters + t.chapters, qcm: acc.qcm + t.qcm, minutes: acc.minutes + t.minutes }), { pages: 0, chapters: 0, qcm: 0, minutes: 0 });
    setDoneIds((prev) => new Set(prev).add(task.itemId));
    setDoneList((prev) => [...prev, { ...task, ...sum }]);
    updateItems(
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

  function undoTask(task: PlannedTask) {
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.delete(task.itemId);
      return next;
    });
    setDoneList((prev) => prev.filter((t) => t.itemId !== task.itemId));
    updateItems(
      plan.items.map((it) =>
        it.id === task.itemId
          ? {
              ...it,
              completedPages: Math.max(0, it.completedPages - task.pages),
              completedChapters: Math.max(0, it.completedChapters - task.chapters),
              completedQcm: Math.max(0, it.completedQcm - task.qcm),
            }
          : it,
      ),
    );
  }

  function setCompleted(itemId: string, patch: Partial<Pick<RevisionItem, 'completedPages' | 'completedChapters' | 'completedQcm'>>) {
    updateItems(plan.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
  }

  function applySuggestion(s: BoostSuggestion) {
    onPlanChange(applyBoostSuggestion(plan, s));
  }

  const taskAmounts = (t: PlannedTask) =>
    [t.pages > 0 ? `${t.pages} p.` : null, t.chapters > 0 ? `${t.chapters} chap.` : null, t.qcm > 0 ? `${t.qcm} QCM` : null]
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

      <Reveal delay={stagger}>
        <AiBoostPanel token={token} planId={plan.id} onApply={applySuggestion} />
      </Reveal>

      <Reveal delay={stagger * 2}>
        <View style={styles.cardsGrid}>
          <Stat label="Charge / jour" value={formatMinutes(result.dailyAverageMinutes)} hint={`plafond ${formatMinutes(plan.dailyMaxMinutes)}`} />
          <Stat label="Cette semaine" value={formatMinutes(result.weeklyAverageMinutes)} hint="estimé" />
          <Stat label="Temps restant" value={formatMinutes(result.totalRemainingMinutes)} hint="à planifier" />
          <Stat label="Pages restantes" value={String(remaining.pages)} hint={`${remaining.chapters} chap. · ${remaining.qcm} QCM`} />
          <Stat label="Jours tampon" value={String(result.bufferDays)} hint={`${result.schedulingDays} j. de travail`} />
          <Stat label="Débordement" value={result.overflowMinutes > 0 ? formatMinutes(result.overflowMinutes) : '—'} hint={result.overflowMinutes > 0 ? 'ne tient pas' : 'tout tient'} danger={result.overflowMinutes > 0} />
        </View>
      </Reveal>

      <Reveal delay={stagger * 3}>
        <Text style={styles.sectionTitle}>Aujourd’hui</Text>
        <View style={styles.card}>
          {activeTasks.length === 0 && doneList.length === 0 ? (
            <Text style={styles.muted}>Rien de planifié aujourd’hui (jour de repos, hors période, ou tout est fait).</Text>
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
                    <Text style={styles.taskMeta}>{taskAmounts(task)} · {formatMinutes(task.minutes)}</Text>
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
                  <Pressable onPress={() => undoTask(task)} accessibilityLabel={`Annuler : ${task.title}`} hitSlop={8}>
                    <Text style={styles.undoCta}>Annuler</Text>
                  </Pressable>
                </View>
              ))}
              {activeTasks.length === 0 && doneList.length > 0 ? <Text style={styles.muted}>Journée terminée — beau travail.</Text> : null}
            </>
          )}
        </View>
      </Reveal>

      {/* Visualisations : semaine (barres) / mois (calendrier) / burn-down */}
      <Reveal delay={stagger * 4}>
        <View style={styles.vizHead}>
          <Text style={styles.sectionTitle}>Visualisation</Text>
          <View style={styles.segRow}>
            {VIZ.map((v) => (
              <Pressable key={v.key} onPress={() => setViz(v.key)} style={[styles.seg, viz === v.key && styles.segActive]}>
                <Text style={[styles.segText, viz === v.key && styles.segTextActive]}>{v.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.card}>
          {viz === 'week' ? (
            timeline.length === 0 ? (
              <Text style={styles.muted}>Aucun jour planifiable avant l’examen.</Text>
            ) : (
              <View style={styles.timelineRow}>
                {timeline.map((day) => {
                  const over = day.minutes > plan.dailyMaxMinutes;
                  const isToday = day.date === today;
                  const barColor = day.buffer ? tokens.colors.borderStrong : over ? tokens.colors.danger : tokens.colors.accent;
                  return (
                    <View key={day.date} style={styles.timelineCol}>
                      <View style={styles.timelineBarTrack}>
                        <TimelineBar minutes={day.minutes} maxMinutes={maxDayMinutes} color={barColor} />
                      </View>
                      <Text style={[styles.timelineDay, isToday && styles.timelineTodayText]}>{WEEKDAY_SHORT[day.weekday]}</Text>
                      <View style={isToday ? styles.timelineTodayPill : undefined}>
                        <Text style={[styles.timelineDate, isToday && styles.timelineTodayText]}>{day.date.slice(8, 10)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )
          ) : viz === 'month' ? (
            <RevisionCalendar result={result} today={today} startDate={plan.startDate} examDate={plan.examDate} dailyMax={plan.dailyMaxMinutes} />
          ) : (
            <BurnDownChart result={result} />
          )}
        </View>
      </Reveal>

      {/* Blocs de travail — progression + journalisation partielle */}
      <Reveal delay={stagger * 5}>
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
              const open = expandedBlock === it.id;
              return (
                <View key={it.id} style={styles.itemRow}>
                  <Pressable onPress={() => setExpandedBlock(open ? null : it.id)} accessibilityLabel={`Détail ${it.title}`} style={styles.itemTop}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemTitleRow}>
                        <View style={priorityDotStyle(it.priority)} />
                        <Text style={styles.itemTitle} numberOfLines={1}>{it.title}</Text>
                      </View>
                      <Text style={styles.itemMeta}>
                        {it.subject ? `${it.subject} · ` : ''}
                        {r.pages} p. · {r.chapters} chap. · {r.qcm} QCM restants
                      </Text>
                    </View>
                    <Text style={styles.itemPct}>{pct}%</Text>
                  </Pressable>
                  <ProgressBar pct={pct} color={pct >= 100 ? tokens.colors.success : tokens.colors.accent} height={6} delay={i * 40} />
                  {open ? (
                    <View style={styles.stepperBox}>
                      {it.pages > 0 ? <Stepper label="Pages faites" value={it.completedPages} total={it.pages} step={5} onChange={(v) => setCompleted(it.id, { completedPages: v })} /> : null}
                      {it.chapters > 0 ? <Stepper label="Chapitres faits" value={it.completedChapters} total={it.chapters} step={1} onChange={(v) => setCompleted(it.id, { completedChapters: v })} /> : null}
                      {it.qcm > 0 ? <Stepper label="QCM faits" value={it.completedQcm} total={it.qcm} step={10} onChange={(v) => setCompleted(it.id, { completedQcm: v })} /> : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </Reveal>

      <Text style={styles.disclaimer}>
        Outil pédagogique d’organisation des révisions. Ne fournit aucun conseil médical, diagnostic ni prise en charge.
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
    const anim = Animated.timing(h, { toValue: target, duration: tokens.motion.duration.slow, easing: Easing.bezier(...tokens.motion.easing.out), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [target, reduced, h]);
  return <Animated.View style={[styles.timelineBar, { height: h, backgroundColor: color }]} />;
}

function Stepper({ label, value, total, step, onChange }: { label: string; value: number; total: number; step: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable onPress={() => onChange(Math.max(0, value - step))} style={styles.stepBtn} accessibilityLabel={`Retirer ${step} ${label}`}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}/{total}</Text>
        <Pressable onPress={() => onChange(Math.min(total, value + step))} style={styles.stepBtn} accessibilityLabel={`Ajouter ${step} ${label}`}>
          <Text style={styles.stepBtnText}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
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
  return { width: 8, height: 8, borderRadius: tokens.radius.pill, backgroundColor: PRIORITY_COLORS[Math.min(2, Math.max(0, priority - 1))] };
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
  title: { fontFamily: tokens.font.serif, color: tokens.colors.text, fontSize: tokens.type.h2.fontSize, letterSpacing: tokens.type.h2.letterSpacing, fontWeight: tokens.weight.semibold },
  subtitle: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize, marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.accentSurface, ...tokens.motion.transitionWeb },
  editBtnText: { fontFamily: tokens.font.sans, color: tokens.colors.accentDeep, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.semibold },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  statCard: { flexGrow: 1, flexBasis: '30%', minWidth: 100, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, padding: tokens.space.md, gap: 2, ...tokens.elevation.sm },
  statLabel: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize, textTransform: 'uppercase', letterSpacing: tokens.tracking.caps },
  statValue: { fontFamily: tokens.font.display, color: tokens.colors.text, fontSize: tokens.type.h3.fontSize, fontWeight: tokens.weight.bold },
  statHint: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize },
  sectionTitle: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.bold, marginBottom: tokens.space.sm, marginTop: tokens.space.xs },
  card: { borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, padding: tokens.space.md, gap: tokens.space.sm },
  muted: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.body.fontSize },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md, paddingVertical: tokens.space.xs },
  checkbox: { width: 28, height: 28, borderRadius: tokens.radius.sm, borderWidth: 1, borderColor: tokens.colors.accentSurfaceStrong, backgroundColor: tokens.colors.accentSurface, alignItems: 'center', justifyContent: 'center', ...tokens.motion.transitionWeb },
  checkboxDone: { width: 28, height: 28, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.success, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.body.fontSize, fontWeight: tokens.weight.medium },
  taskTitleDone: { color: tokens.colors.textMuted, textDecorationLine: 'line-through' },
  taskMeta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  taskCta: { fontFamily: tokens.font.sans, color: tokens.colors.accent, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.semibold },
  undoCta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.semibold },
  vizHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: tokens.space.sm },
  segRow: { flexDirection: 'row', gap: 4, backgroundColor: tokens.colors.surfaceSunken, borderRadius: tokens.radius.pill, padding: 3, marginBottom: tokens.space.sm },
  seg: { paddingHorizontal: tokens.space.md, paddingVertical: 6, borderRadius: tokens.radius.pill, ...tokens.motion.transitionWeb },
  segActive: { backgroundColor: tokens.colors.surface, ...tokens.elevation.sm },
  segText: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.medium },
  segTextActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  timelineCol: { alignItems: 'center', gap: 3, flex: 1 },
  timelineBarTrack: { height: TIMELINE_HEIGHT, justifyContent: 'flex-end' },
  timelineBar: { width: 14, borderRadius: tokens.radius.xs },
  timelineDay: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize },
  timelineDate: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: tokens.type.micro.fontSize, fontWeight: tokens.weight.semibold },
  timelineTodayText: { color: tokens.colors.onAccent },
  timelineTodayPill: { backgroundColor: tokens.colors.accent, borderRadius: tokens.radius.pill, paddingHorizontal: 6, minWidth: 20, alignItems: 'center' },
  itemRow: { gap: tokens.space.sm, paddingVertical: tokens.space.xs },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.md },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  itemTitle: { flex: 1, fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.body.fontSize, fontWeight: tokens.weight.medium },
  itemMeta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize, marginTop: 2 },
  itemPct: { fontFamily: tokens.font.display, color: tokens.colors.text, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.bold },
  stepperBox: { gap: tokens.space.xs, marginTop: tokens.space.xs, paddingTop: tokens.space.sm, borderTopWidth: 1, borderTopColor: tokens.colors.border },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepLabel: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: tokens.type.caption.fontSize },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  stepBtn: { width: 30, height: 30, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.accentSurface, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: tokens.font.sans, color: tokens.colors.accentDeep, fontSize: tokens.type.bodyLg.fontSize, fontWeight: tokens.weight.bold },
  stepValue: { fontFamily: tokens.font.display, color: tokens.colors.text, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold, minWidth: 56, textAlign: 'center' },
  disclaimer: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize, lineHeight: 16, marginTop: tokens.space.sm },
});
