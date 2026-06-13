/**
 * Moteur de planification de révisions — PUR, déterministe, sans IA ni réseau.
 *
 * Entrée : fenêtre (dates, repos, indispos, plafond/jour), vitesse personnelle,
 * blocs de travail (pages/chapitres/QCM + progression), ratio de tampon.
 * Sortie : tâches réparties par jour, charge quotidienne/hebdo, restant, débordement,
 * progression, niveau de risque. Mêmes entrées ⇒ mêmes sorties (testable).
 *
 * Principe « recalcul après retard » : le moteur travaille toujours sur le RESTANT
 * (volumes − faits) réparti sur les jours RESTANTS (≥ `today`). Le rappeler avec une
 * date `today` plus avancée et des compteurs `completed*` à jour redistribue tout seul.
 */
import { addDays, diffDays, eachDay, weekdayOf } from './dates';
import { assessRisk } from './riskScoring';
import type {
  DayLoad,
  PlannedTask,
  PlannerInput,
  PlannerResult,
  RevisionItem,
  SpeedProfile,
  TaskKind,
} from './types';
import { itemRemaining, progressPercent, totalRemainingMinutes, unitMinutes } from './workload';

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** Bloc de travail élémentaire (un type d'unité d'un item), consommé par minutes. */
interface Stream {
  itemId: string;
  title: string;
  priority: number;
  order: number;
  minutesLeft: number;
  unitsLeft: number;
  /** Quelle clé de tâche incrémenter (pages/chapters/qcm). */
  unit: 'pages' | 'chapters' | 'qcm';
}

function buildStreams(items: RevisionItem[], speed: SpeedProfile): Stream[] {
  const streams: Stream[] = [];
  items.forEach((item, order) => {
    const r = itemRemaining(item);
    const add = (unit: Stream['unit'], units: number, perHour: number) => {
      const minutes = unitMinutes(units, perHour);
      if (minutes > 0) {
        streams.push({
          itemId: item.id,
          title: item.title,
          priority: Number.isFinite(item.priority) ? item.priority : 2,
          order,
          minutesLeft: minutes,
          unitsLeft: units,
          unit,
        });
      }
    };
    add('pages', r.pages, speed.pagesPerHour);
    add('chapters', r.chapters, speed.chaptersPerHour);
    add('qcm', r.qcm, speed.qcmPerHour);
  });
  // Priorité haute d'abord (1 < 2 < 3), puis ordre de saisie.
  return streams.sort((a, b) => a.priority - b.priority || a.order - b.order);
}

function emptyTask(date: string, stream: Stream, minutes: number, units: number, kind: TaskKind): PlannedTask {
  return {
    date,
    itemId: stream.itemId,
    title: stream.title,
    kind,
    minutes: Math.round(minutes),
    pages: stream.unit === 'pages' ? Math.round(units) : 0,
    chapters: stream.unit === 'chapters' ? Math.round(units) : 0,
    qcm: stream.unit === 'qcm' ? Math.round(units) : 0,
  };
}

/** Durée d'un bloc de rappel actif sur un jour tampon (planning, pas un volume inventé). */
export const REVIEW_BLOCK_MINUTES = 90;

export function buildPlan(input: PlannerInput): PlannerResult {
  const { today, window, speed, items } = input;
  const bufferRatio = clamp(Number.isFinite(input.bufferRatio) ? input.bufferRatio : 0, 0, 0.5);
  const dailyMax = window.dailyMaxMinutes > 0 ? window.dailyMaxMinutes : 1;

  // Fenêtre planifiable : de max(today, startDate) jusqu'à la veille de l'examen.
  const startBound = diffDays(today, window.startDate) > 0 ? window.startDate : today;
  const restSet = new Set(window.restWeekdays ?? []);
  const unavailableSet = new Set(window.unavailableDays ?? []);

  const usable = eachDay(startBound, window.examDate).filter(
    (d) => !restSet.has(weekdayOf(d)) && !unavailableSet.has(d),
  );

  const bufferCount = Math.floor(usable.length * bufferRatio);
  const schedulingDates = usable.slice(0, usable.length - bufferCount);
  const bufferDates = usable.slice(usable.length - bufferCount);

  const remainingMinutes = totalRemainingMinutes(items, speed);
  const streams = buildStreams(items, speed);

  // Répartition LISSÉE : on vise une charge quotidienne régulière (le rythme requis),
  // plafonnée à `dailyMax`. Si le rythme requis dépasse le plafond, le plan déborde
  // (chaque jour est rempli au plafond et le reliquat devient `overflowMinutes`).
  const perDayTarget =
    schedulingDates.length > 0
      ? Math.min(dailyMax, Math.ceil(remainingMinutes / schedulingDates.length))
      : 0;

  const tasksByDate = new Map<string, PlannedTask[]>();
  let si = 0;
  for (const date of schedulingDates) {
    let capacity = perDayTarget;
    const dayTasks: PlannedTask[] = [];
    while (capacity > 0.001 && si < streams.length) {
      const s = streams[si];
      if (s.minutesLeft <= 0.001) {
        si += 1;
        continue;
      }
      const take = Math.min(capacity, s.minutesLeft);
      // Unités proportionnelles ; sur la dernière tranche du bloc, on solde le reliquat.
      const exhausts = take >= s.minutesLeft - 0.001;
      const units = exhausts ? s.unitsLeft : (take / s.minutesLeft) * s.unitsLeft;
      dayTasks.push(emptyTask(date, s, take, units, 'study'));
      s.minutesLeft -= take;
      s.unitsLeft -= units;
      capacity -= take;
      if (s.minutesLeft <= 0.001) si += 1;
    }
    if (dayTasks.length > 0) tasksByDate.set(date, dayTasks);
  }

  // Débordement : tout ce qui reste dans les blocs ne tient pas avant l'examen.
  let overflowMinutes = 0;
  for (let k = si; k < streams.length; k += 1) overflowMinutes += Math.max(0, streams[k].minutesLeft);

  // Jours tampon : rappel actif si activé (sinon jours de marge libres).
  if (input.spacedRepetition) {
    for (const date of bufferDates) {
      tasksByDate.set(date, [
        {
          date,
          itemId: '',
          title: 'Rappel actif (révision espacée)',
          kind: 'review',
          minutes: Math.min(dailyMax, REVIEW_BLOCK_MINUTES),
          pages: 0,
          chapters: 0,
          qcm: 0,
        },
      ]);
    }
  }

  const bufferSet = new Set(bufferDates);
  const byDay: DayLoad[] = usable.map((date) => {
    const dayTasks = tasksByDate.get(date) ?? [];
    return {
      date,
      weekday: weekdayOf(date),
      minutes: dayTasks.reduce((sum, t) => sum + t.minutes, 0),
      tasks: dayTasks,
      buffer: bufferSet.has(date),
    };
  });

  const tasks = byDay.flatMap((d) => d.tasks);
  const schedulingDays = schedulingDates.length;
  const dailyAverageMinutes = schedulingDays > 0 ? remainingMinutes / schedulingDays : remainingMinutes;
  const studyWeekdays = Math.max(1, 7 - restSet.size);
  const totalPlannedMinutes = Math.max(0, remainingMinutes - overflowMinutes);
  const daysUntilExam = Math.max(0, diffDays(today, window.examDate));

  return {
    tasks,
    byDay,
    usableDays: usable.length,
    schedulingDays,
    bufferDays: bufferDates.length,
    totalRemainingMinutes: Math.round(remainingMinutes),
    totalPlannedMinutes: Math.round(totalPlannedMinutes),
    dailyAverageMinutes: Math.round(dailyAverageMinutes),
    weeklyAverageMinutes: Math.round(dailyAverageMinutes * studyWeekdays),
    overflowMinutes: Math.round(overflowMinutes),
    progressPercent: progressPercent(items, speed),
    daysUntilExam,
    risk: assessRisk({
      dailyAverageMinutes,
      dailyMaxMinutes: dailyMax,
      bufferDays: bufferDates.length,
      schedulingDays,
      overflowMinutes,
    }),
  };
}

/** Tâches d'un jour précis (vue « aujourd'hui »). */
export function tasksForDate(result: PlannerResult, date: string): PlannedTask[] {
  return result.byDay.find((d) => d.date === date)?.tasks ?? [];
}

/** Petit utilitaire d'affichage : minutes → « 2 h 45 ». PUR. */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h} h`;
  return `${h} h ${String(rest).padStart(2, '0')}`;
}

// Réexport pratique pour les consommateurs (écran + tests).
export { addDays };
