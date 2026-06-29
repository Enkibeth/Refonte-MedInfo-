import { describe, it, expect } from 'vitest';

import {
  coerceBoostRequest,
  buildRevisionContext,
  intentInstruction,
} from '@/revision/ai/revisionPrompt';

const PLAN = {
  startDate: '2026-01-01',
  examDate: '2026-01-11',
  unavailableDays: [],
  dailyMaxMinutes: 120,
  bufferRatio: 0,
  distributionMode: 'smooth',
  speed: { pagesPerHour: 10, chaptersPerHour: 2, qcmPerHour: 60 },
  resources: [{ id: 'r-1', title: 'Cardiologie', pages: 100, priority: 1 }],
};

describe('revisionPrompt — coerceBoostRequest (bornage)', () => {
  it('retombe sur l’intention par défaut et borne le plan', () => {
    const req = coerceBoostRequest({ intent: 'n’importe quoi', plan: PLAN });
    expect(req.intent).toBe('optimize');
    expect(req.stored.resources).toHaveLength(1);
    expect(req.stored.resources[0].title).toBe('Cardiologie');
  });

  it('accepte les intentions connues', () => {
    expect(coerceBoostRequest({ intent: 'realistic', plan: PLAN }).intent).toBe('realistic');
    expect(coerceBoostRequest({ intent: 'reminders', plan: PLAN }).intent).toBe('reminders');
  });
});

describe('revisionPrompt — buildRevisionContext (chiffres vérifiés, jamais inventés)', () => {
  it('injecte les métriques recalculées par le moteur', () => {
    const { stored } = coerceBoostRequest({ plan: PLAN });
    const ctx = buildRevisionContext(stored, '2026-01-01');
    expect(ctx).toContain('Cardiologie');
    expect(ctx).toContain('ÉTAT DU PLAN');
    // 100 pages / 10 pages-h = 600 min sur 10 jours → 60 min/j, formaté « 1 h ».
    expect(ctx).toContain('1 h/jour');
    expect(ctx).toMatch(/dans les temps/);
  });

  it('signale un plan irréaliste sans rien inventer', () => {
    const { stored } = coerceBoostRequest({ plan: { ...PLAN, dailyMaxMinutes: 20 } });
    const ctx = buildRevisionContext(stored, '2026-01-01');
    expect(ctx).toMatch(/irréaliste|surcharge/);
  });
});

describe('revisionPrompt — intentInstruction', () => {
  it('produit une consigne pour chaque intention', () => {
    expect(intentInstruction('optimize')).toMatch(/[Oo]ptimise/);
    expect(intentInstruction('reminders')).toMatch(/rappel/);
  });
});
