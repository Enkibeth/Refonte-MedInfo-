import { describe, it, expect } from 'vitest';

import {
  coerceCvId,
  coerceTitle,
  coerceTheme,
  sanitizeCvPayload,
  sanitizeCvForAi,
  normalizeImportedCv,
  MAX_CV_JSON_CHARS,
} from '@/cv/cvDocument';

describe('cvDocument — coercitions', () => {
  it('coerceCvId accepte un uuid, rejette le reste', () => {
    expect(coerceCvId('11111111-1111-1111-1111-111111111111')).toBe('11111111-1111-1111-1111-111111111111');
    expect(coerceCvId('pas-un-uuid')).toBeNull();
    expect(coerceCvId(42)).toBeNull();
  });

  it('coerceTheme retombe toujours sur medical (un seul thème en v1)', () => {
    expect(coerceTheme('medical')).toBe('medical');
    expect(coerceTheme('startup')).toBe('medical');
    expect(coerceTheme(undefined)).toBe('medical');
  });

  it('coerceTitle borne et nettoie', () => {
    expect(coerceTitle('  Mon   CV  ')).toBe('Mon CV');
    expect(coerceTitle('x'.repeat(500)).length).toBe(200);
    expect(coerceTitle(123)).toBe('');
  });
});

describe('sanitizeCvPayload — validation avant écriture', () => {
  it('refuse un document absent', () => {
    expect(sanitizeCvPayload({}).ok).toBe(false);
    expect(sanitizeCvPayload({ document: 'nope' }).ok).toBe(false);
    expect(sanitizeCvPayload({ document: [] }).ok).toBe(false);
  });

  it('refuse un document trop volumineux', () => {
    const big = { document: { blob: 'x'.repeat(MAX_CV_JSON_CHARS + 10) } };
    expect(sanitizeCvPayload(big).ok).toBe(false);
  });

  it('dérive le titre du nom si absent', () => {
    const res = sanitizeCvPayload({
      document: { personalInfo: { firstName: 'Marie', lastName: 'Curie' } },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.title).toBe('CV Marie Curie');
      expect(res.value.theme).toBe('medical');
    }
  });

  it('garde le titre explicite', () => {
    const res = sanitizeCvPayload({ title: 'CV cardio', document: { personalInfo: {} } });
    expect(res.ok && res.value.title).toBe('CV cardio');
  });
});

describe('sanitizeCvForAi — minimisation RGPD (document v2)', () => {
  const doc = {
    schemaVersion: 2,
    meta: { id: 'x', title: 'CV Marie Curie' },
    header: {
      fullName: 'Marie Curie',
      headline: 'Interne',
      photo: { dataUrl: 'data:image/png;base64,AAAA' },
      contacts: [
        { id: 'c1', icon: 'email', value: 'marie@example.com' },
        { id: 'c2', icon: 'phone', value: '0600000000' },
      ],
    },
    sections: [
      { id: 's1', title: 'Stages', column: 'main', layout: 'entries', entries: [
        { id: 'e1', title: 'Stage', organisation: 'CHU', date: '2024', bullets: ['a', 'b', ''], description: [] },
      ] },
      { id: 's2', title: '', column: 'side', layout: 'tags', entries: [{ id: 'e2', title: '' }] },
    ],
    theme: { accent: '#7c1f3d' },
  };

  it('retire la photo et les contacts (téléphone, e-mail)', () => {
    const out = sanitizeCvForAi(doc) as Record<string, any>;
    expect(out.header.fullName).toBe('Marie Curie');
    expect(out.header.headline).toBe('Interne');
    expect(out.header.contacts).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('marie@example.com');
    expect(JSON.stringify(out)).not.toContain('data:image');
  });

  it('inclut les contacts seulement sur demande explicite', () => {
    const out = sanitizeCvForAi(doc, { includeContacts: true }) as Record<string, any>;
    expect(out.header.contacts).toEqual(['marie@example.com', '0600000000']);
  });

  it('PRÉSERVE LES INDEX : une section ou une entrée vide n\'est jamais retirée', () => {
    // Les suggestions de l'IA reviennent sous forme de chemin « sections.1.entries.0.title » :
    // filtrer un élément vide décalerait tout et appliquerait la correction au mauvais champ.
    const out = sanitizeCvForAi(doc) as Record<string, any>;
    expect(out.sections.length).toBe(2);
    expect(out.sections[1].entries.length).toBe(1);
    expect(out.sections[0].entries[0].title).toBe('Stage');
  });

  it('retire les chaînes vides et les tableaux vides d\'une entrée', () => {
    const out = sanitizeCvForAi(doc) as Record<string, any>;
    expect(out.sections[0].entries[0].bullets).toEqual(['a', 'b']);
    expect(out.sections[0].entries[0].description).toBeUndefined();
    expect(out.sections[1].entries[0]).toEqual({});
  });

  it('ne casse pas sur un document absurde', () => {
    // `compact` retire aussi les tableaux vides : un document vide ne renvoie rien d'exploitable
    // (c'est ce qui déclenche le refus « ajoute du contenu » côté route).
    expect(sanitizeCvForAi(null)).toEqual({ header: {} });
    expect(sanitizeCvForAi({ sections: 'non' })).toEqual({ header: {} });
    // Les positions restent, même pour des sections illisibles (index préservés).
    expect(sanitizeCvForAi({ sections: [null, 3] })).toEqual({ header: {}, sections: [{}, {}] });
  });
});

describe('normalizeImportedCv — import d\'un CV existant', () => {
  it('structure la sortie IA en CvDocument, assigne des ids et borne les champs', () => {
    const raw = {
      personalInfo: { firstName: 'Hugo', lastName: 'B', email: 'h@x.fr', photoUrl: 'data:xxx' },
      experiences: [{ title: 'Interne', institution: 'CHU', isCurrent: true, bullets: ['a', '', 'b'] }],
      interests: ['Course', { label: 'Photo' }],
      languages: [{ name: 'Français', level: 9 }],
    };
    const out = normalizeImportedCv(raw);
    expect(out.personalInfo.firstName).toBe('Hugo');
    expect(out.personalInfo.photoUrl).toBe(''); // photo jamais importée
    expect(out.experiences).toHaveLength(1);
    expect(out.experiences[0].id).toBeTruthy();
    expect(out.experiences[0].isCurrent).toBe(true);
    expect(out.experiences[0].bullets).toEqual(['a', 'b']);
    expect(out.interests.map((i) => i.label)).toEqual(['Course', 'Photo']);
    expect(out.languages[0].level).toBe(5); // borné 1..5
  });

  it('renvoie un document vide et valide pour une entrée vide (rien inventé)', () => {
    const out = normalizeImportedCv({});
    expect(out.personalInfo.firstName).toBe('');
    expect(out.experiences).toEqual([]);
    expect(out.references).toEqual([]);
    expect(Array.isArray(out.certificates)).toBe(true);
  });

  it('tolère une entrée non-objet', () => {
    expect(() => normalizeImportedCv(null)).not.toThrow();
    expect(normalizeImportedCv('nope').summary).toBe('');
  });
});
