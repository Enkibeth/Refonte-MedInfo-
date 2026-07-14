import { describe, it, expect } from 'vitest';

import {
  buildRecentActivity,
  conversationsThisWeek,
  formatMinutes,
  greetingWord,
  heroSummary,
  isoWeekNumber,
  joinSentence,
  planSnapshot,
  relativeLabel,
  shortDateLabel,
  truncateLabel,
} from '@/dashboard/overview';
import type { StoredPlan } from '@/revision/db/plans';

describe('greetingWord — salutation selon l’heure', () => {
  it('journée → Bonjour', () => {
    expect(greetingWord(9)).toBe('Bonjour');
    expect(greetingWord(17)).toBe('Bonjour');
  });
  it('soirée et nuit → Bonsoir', () => {
    expect(greetingWord(18)).toBe('Bonsoir');
    expect(greetingWord(23)).toBe('Bonsoir');
    expect(greetingWord(2)).toBe('Bonsoir');
  });
});

describe('isoWeekNumber — semaine ISO 8601', () => {
  it('cas de référence', () => {
    expect(isoWeekNumber(new Date(2026, 6, 13))).toBe(29); // lundi 13 juillet 2026
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1); // jeudi 1er janvier 2026
    // Le 1er janvier 2027 (vendredi) appartient à la semaine 53 de 2026.
    expect(isoWeekNumber(new Date(2027, 0, 1))).toBe(53);
  });
});

describe('relativeLabel — horodatage compact', () => {
  const now = new Date(2026, 6, 13, 20, 0, 0); // lundi 13 juillet 2026, 20:00

  it('aujourd’hui → heure', () => {
    expect(relativeLabel(new Date(2026, 6, 13, 18, 20).toISOString(), now)).toBe('18:20');
  });
  it('hier → « Hier »', () => {
    expect(relativeLabel(new Date(2026, 6, 12, 9, 0).toISOString(), now)).toBe('Hier');
  });
  it('< 7 jours → jour de semaine', () => {
    expect(relativeLabel(new Date(2026, 6, 8, 9, 0).toISOString(), now)).toBe('Mer.');
  });
  it('plus ancien → date courte', () => {
    expect(relativeLabel(new Date(2026, 5, 2, 9, 0).toISOString(), now)).toBe('2 juin');
  });
  it('horodatage invalide → chaîne vide', () => {
    expect(relativeLabel('n/a', now)).toBe('');
  });
});

describe('shortDateLabel', () => {
  it('date ISO → libellé court FR', () => {
    expect(shortDateLabel('2026-11-04')).toBe('4 nov. 2026');
    expect(shortDateLabel('2026-03-15')).toBe('15 mars 2026');
    expect(shortDateLabel('n/a')).toBe('n/a');
  });
});

describe('formatMinutes', () => {
  it('moins d’une heure → minutes', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(0)).toBe('0 min');
  });
  it('heures pleines et mixtes', () => {
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(130)).toBe('2 h 10');
    expect(formatMinutes(65)).toBe('1 h 05');
  });
  it('jamais négatif', () => {
    expect(formatMinutes(-30)).toBe('0 min');
  });
});

describe('joinSentence / truncateLabel', () => {
  it('jonction française', () => {
    expect(joinSentence(['a'])).toBe('a');
    expect(joinSentence(['a', 'b'])).toBe('a et b');
    expect(joinSentence(['a', 'b', 'c'])).toBe('a, b et c');
    expect(joinSentence([])).toBe('');
  });
  it('troncature propre', () => {
    expect(truncateLabel('  Anticoagulation   et FA  ')).toBe('Anticoagulation et FA');
    expect(truncateLabel('x'.repeat(80), 20)).toHaveLength(20);
    expect(truncateLabel('x'.repeat(80), 20).endsWith('…')).toBe(true);
  });
});

describe('heroSummary — sous-titre factuel du hero', () => {
  it('assemble uniquement les faits disponibles', () => {
    expect(
      heroSummary({
        todayMinutes: 130,
        lastEcosTitle: 'Trouble du langage',
        lastConversationTitle: null,
      }),
    ).toBe(
      'Tu as 2 h 10 de révision planifiées aujourd’hui et un ECOS « Trouble du langage » à retravailler.',
    );
  });
  it('sans aucune donnée → invitation neutre, aucun chiffre', () => {
    const out = heroSummary({ todayMinutes: null, lastEcosTitle: null, lastConversationTitle: null });
    expect(out).toContain('chat médical');
    expect(out).not.toMatch(/\d/);
  });
  it('charge nulle (journée libre) → segment omis', () => {
    const out = heroSummary({
      todayMinutes: 0,
      lastEcosTitle: null,
      lastConversationTitle: 'Anticoagulation et FA',
    });
    expect(out).toBe('Tu as une conversation « Anticoagulation et FA » à poursuivre.');
  });
});

describe('planSnapshot — chiffres dérivés du moteur de révision', () => {
  const stored: StoredPlan = {
    startDate: '2026-07-01',
    examDate: '2026-07-21',
    unavailableDays: [],
    dailyMaxMinutes: 240,
    bufferRatio: 0,
    distributionMode: 'smooth',
    speed: { pagesPerHour: 10, chaptersPerHour: 2, qcmPerHour: 60 },
    resources: [
      {
        id: 'r1',
        title: 'Cardiologie',
        pages: 100, // 600 minutes au total
        chapters: 0,
        qcm: 0,
        priority: 1,
        masteryStart: 2,
        completedMinutes: 300, // moitié faite
      },
    ],
  };

  it('progression, jours restants et charge du jour cohérents', () => {
    const snap = planSnapshot(stored, '2026-07-13');
    expect(snap.progressPercent).toBe(50);
    expect(snap.daysLeft).toBe(8);
    expect(snap.examDate).toBe('2026-07-21');
    // 300 minutes restantes sur 8 jours travaillables (l'examen est exclu) :
    // le lissage répartit ~37-38 min/jour — jamais plus que la capacité.
    expect(snap.todayMinutes).toBeGreaterThan(0);
    expect(snap.todayMinutes).toBeLessThanOrEqual(240);
    expect(['green', 'orange', 'red']).toContain(snap.riskLevel);
  });

  it('examen passé → 0 jour restant, pas de crash', () => {
    const snap = planSnapshot(stored, '2026-08-01');
    expect(snap.daysLeft).toBe(0);
  });
});

describe('buildRecentActivity — fusion multi-outils triée', () => {
  it('fusionne, trie (récent d’abord) et limite', () => {
    const entries = buildRecentActivity(
      {
        conversations: [
          { id: 'c1', title: 'Anticoagulation et FA', category: 'Cardiologie', updated_at: '2026-07-12T09:00:00Z' },
        ],
        ecosAttempts: [
          { id: 'e1', case_title: 'Trouble du langage', score: 16, created_at: '2026-07-13T18:20:00Z' },
        ],
        revisionPlans: [{ id: 'p1', title: 'EDN', updated_at: '2026-07-06T10:00:00Z' }],
      },
      2,
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].feature).toBe('ecos');
    expect(entries[0].detail).toBe('16/20');
    expect(entries[1].feature).toBe('chat');
    expect(entries[1].detail).toBe('Cardiologie');
  });

  it('titre de conversation absent → libellé neutre ; score absent → mention sans note', () => {
    const entries = buildRecentActivity({
      conversations: [{ id: 'c1', title: null, category: null, updated_at: '2026-07-12T09:00:00Z' }],
      ecosAttempts: [
        { id: 'e1', case_title: 'Douleur thoracique', score: null, created_at: '2026-07-11T09:00:00Z' },
      ],
    });
    expect(entries[0].title).toBe('Conversation');
    expect(entries[1].detail).toBe('Évaluation enregistrée');
  });

  it('horodatage invalide → entrée écartée', () => {
    const entries = buildRecentActivity({
      conversations: [{ id: 'c1', title: 'x', category: null, updated_at: 'invalid' }],
    });
    expect(entries).toHaveLength(0);
  });
});

describe('buildRecentActivity — activité de tous les outils du rôle (D1)', () => {
  it('fusionne document / audio / présentations / CV / articles avec le bon deep-link', () => {
    const entries = buildRecentActivity({
      documentAnalyses: [
        { id: 'd1', mode: 'translation', source_name: 'compte-rendu.pdf', created_at: '2026-07-13T10:00:00Z' },
        { id: 'd2', mode: 'analysis', source_name: null, created_at: '2026-07-12T10:00:00Z' },
      ],
      audioDocuments: [{ id: 'a1', title: 'Consultation Mme B.', created_at: '2026-07-11T10:00:00Z' }],
      presentationDecks: [{ id: 'p1', title: 'Insuffisance cardiaque', updated_at: '2026-07-10T10:00:00Z' }],
      cvDocuments: [{ id: 'v1', title: null, updated_at: '2026-07-09T10:00:00Z' }],
      articleDocuments: [
        { id: 'r1', title: 'Étude pilote', doc_type: 'case_report', updated_at: '2026-07-08T10:00:00Z' },
      ],
    });
    expect(entries.map((e) => e.feature)).toEqual([
      'document',
      'document',
      'audio',
      'presentation',
      'cv-builder',
      'article',
    ]);
    expect(entries[0].title).toBe('Traduction — compte-rendu.pdf');
    expect(entries[1].title).toBe('Analyse — Texte collé');
    expect(entries[2].title).toBe('Audio — Consultation Mme B.');
    expect(entries[4].title).toBe('CV — Mon CV');
    expect(entries[5].detail).toBe('Cas clinique');
    expect(entries[0].route).toBe('/(chat)/document');
    expect(entries[5].route).toBe('/(chat)/article');
  });

  it('affiche le chatbot d’origine de la conversation quand il est fourni (D4)', () => {
    const entries = buildRecentActivity({
      conversations: [
        {
          id: 'c1',
          chatbot: 'student',
          title: 'Item 230',
          category: 'Révisions & concours',
          updated_at: '2026-07-12T09:00:00Z',
        },
      ],
    });
    expect(entries[0].detail).toBe('Chat étudiant · Révisions & concours');
  });
});

describe('conversationsThisWeek — tuile « Cette semaine » (D2)', () => {
  const now = new Date('2026-07-14T12:00:00Z');

  it('compte les conversations actives dans les 7 derniers jours', () => {
    expect(
      conversationsThisWeek(
        [
          { updated_at: '2026-07-14T09:00:00Z' },
          { updated_at: '2026-07-08T09:00:00Z' },
          { updated_at: '2026-07-01T09:00:00Z' },
          { updated_at: 'invalid' },
        ],
        now,
      ),
    ).toBe(2);
  });

  it('liste vide → 0', () => {
    expect(conversationsThisWeek([], now)).toBe(0);
  });
});
