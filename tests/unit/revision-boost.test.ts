import { describe, it, expect } from 'vitest';

import {
  buildBoostContext,
  parseBoostResponse,
  applyBoostSuggestion,
  type BoostSuggestion,
} from '@/features/revision/boost';
import { buildPlan } from '@/features/revision/engine/planner';
import type { FullPlan } from '@/features/revision/api';

const plan: FullPlan = {
  id: 'p1',
  title: 'EDN',
  examType: 'edn',
  startDate: '2026-09-01',
  examDate: '2026-12-01',
  dailyMaxMinutes: 180,
  pagesPerHour: 8,
  chaptersPerHour: 1.5,
  qcmPerHour: 60,
  bufferRatio: 0.1,
  spacedRepetition: false,
  restWeekdays: [],
  unavailableDays: [],
  items: [
    { id: 'a', title: 'Cardio', pages: 200, chapters: 0, qcm: 0, priority: 2, completedPages: 0, completedChapters: 0, completedQcm: 0 },
    { id: 'b', title: 'Pneumo', pages: 0, chapters: 10, qcm: 0, priority: 2, completedPages: 0, completedChapters: 0, completedQcm: 0 },
  ],
};

function resultFor(p: FullPlan) {
  return buildPlan({
    today: '2026-09-01',
    window: { startDate: p.startDate, examDate: p.examDate, unavailableDays: p.unavailableDays, restWeekdays: p.restWeekdays, dailyMaxMinutes: p.dailyMaxMinutes },
    speed: { pagesPerHour: p.pagesPerHour, chaptersPerHour: p.chaptersPerHour, qcmPerHour: p.qcmPerHour },
    items: p.items,
    bufferRatio: p.bufferRatio,
    spacedRepetition: p.spacedRepetition,
  });
}

describe('buildBoostContext', () => {
  it('liste les blocs avec leur id (réutilisable par le modèle)', () => {
    const ctx = buildBoostContext(plan, resultFor(plan));
    expect(ctx).toContain('id="a"');
    expect(ctx).toContain('id="b"');
    expect(ctx).toContain('Cardio');
    expect(ctx).toContain('DONNÉES DU PLAN');
  });
});

describe('parseBoostResponse — validation fail-closed', () => {
  it('accepte les suggestions valides du vocabulaire borné', () => {
    const text = JSON.stringify({
      assessment: 'Plan tendu sur la cardio.',
      suggestions: [
        { type: 'set_buffer_ratio', value: 0.2, label: 'Plus de tampon', rationale: 'Marge en cas de retard.' },
        { type: 'enable_spaced_repetition', label: 'Rappels espacés', rationale: 'Mémorisation durable.' },
        { type: 'set_block_priority', blockId: 'a', priority: 1, label: 'Cardio en priorité', rationale: 'Gros volume restant.' },
      ],
    });
    const r = parseBoostResponse(text, plan);
    expect(r.refused).toBe(false);
    expect(r.assessment).toContain('cardio');
    expect(r.suggestions).toHaveLength(3);
  });

  it('extrait le JSON même entouré de texte / d’un bloc ```json', () => {
    const text = 'Voici mon analyse.\n```json\n{"assessment":"ok","suggestions":[]}\n```\nVoilà.';
    const r = parseBoostResponse(text, plan);
    expect(r.assessment).toBe('ok');
  });

  it('REJETTE un type d’action inconnu', () => {
    const text = JSON.stringify({
      suggestions: [{ type: 'delete_all_blocks', label: 'x', rationale: 'y' }],
    });
    expect(parseBoostResponse(text, plan).suggestions).toHaveLength(0);
  });

  it('REJETTE une référence à un bloc inexistant (anti-invention)', () => {
    const text = JSON.stringify({
      suggestions: [{ type: 'set_block_priority', blockId: 'zzz', priority: 1, label: 'x', rationale: 'y' }],
    });
    expect(parseBoostResponse(text, plan).suggestions).toHaveLength(0);
  });

  it('borne le ratio de tampon et ignore une baisse de plafond déguisée en hausse', () => {
    const text = JSON.stringify({
      suggestions: [
        { type: 'set_buffer_ratio', value: 9, label: 'x', rationale: 'y' },
        { type: 'increase_daily_max', minutes: 120, label: 'x', rationale: 'y' }, // < 180 actuel → rejeté
        { type: 'increase_daily_max', minutes: 240, label: 'x', rationale: 'y' }, // > 180 → ok
      ],
    });
    const r = parseBoostResponse(text, plan);
    const buffer = r.suggestions.find((s) => s.type === 'set_buffer_ratio');
    expect(buffer && buffer.type === 'set_buffer_ratio' && buffer.value).toBe(0.5);
    const increases = r.suggestions.filter((s) => s.type === 'increase_daily_max');
    expect(increases).toHaveLength(1);
  });

  it('honore un refus du modèle (sortie du cadre pédagogique)', () => {
    const text = JSON.stringify({ refused: true, assessment: 'Hors de mon rôle.', suggestions: [{ type: 'set_buffer_ratio', value: 0.2, label: 'x', rationale: 'y' }] });
    const r = parseBoostResponse(text, plan);
    expect(r.refused).toBe(true);
    expect(r.suggestions).toHaveLength(0);
  });

  it('JSON illisible → réponse vide, jamais d’exception', () => {
    expect(parseBoostResponse('pas du json', plan)).toEqual({ assessment: '', suggestions: [], refused: false });
  });

  it('rejette une suggestion sans justification', () => {
    const text = JSON.stringify({ suggestions: [{ type: 'enable_spaced_repetition', label: 'x' }] });
    expect(parseBoostResponse(text, plan).suggestions).toHaveLength(0);
  });
});

describe('applyBoostSuggestion — application déterministe', () => {
  it('applique le tampon, la révision espacée, les repos et le plafond', () => {
    expect(applyBoostSuggestion(plan, { type: 'set_buffer_ratio', value: 0.25, label: 'x', rationale: 'y' }).bufferRatio).toBe(0.25);
    expect(applyBoostSuggestion(plan, { type: 'enable_spaced_repetition', label: 'x', rationale: 'y' }).spacedRepetition).toBe(true);
    expect(applyBoostSuggestion(plan, { type: 'set_rest_weekends', value: true, label: 'x', rationale: 'y' }).restWeekdays).toEqual([0, 6]);
    expect(applyBoostSuggestion(plan, { type: 'increase_daily_max', minutes: 240, label: 'x', rationale: 'y' }).dailyMaxMinutes).toBe(240);
  });

  it('change la priorité du bon bloc uniquement', () => {
    const s: BoostSuggestion = { type: 'set_block_priority', blockId: 'a', priority: 1, label: 'x', rationale: 'y' };
    const next = applyBoostSuggestion(plan, s);
    expect(next.items.find((it) => it.id === 'a')?.priority).toBe(1);
    expect(next.items.find((it) => it.id === 'b')?.priority).toBe(2);
  });

  it('ne mute pas le plan d’origine (immutabilité)', () => {
    applyBoostSuggestion(plan, { type: 'set_buffer_ratio', value: 0.4, label: 'x', rationale: 'y' });
    expect(plan.bufferRatio).toBe(0.1);
  });
});
