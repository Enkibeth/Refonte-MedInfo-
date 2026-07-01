import { describe, it, expect } from 'vitest';

import {
  coerceCvId,
  coerceTitle,
  coerceTheme,
  sanitizeCvPayload,
  sanitizeCvForAi,
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

describe('sanitizeCvForAi — minimisation RGPD', () => {
  const doc = {
    personalInfo: {
      firstName: 'Marie',
      lastName: 'Curie',
      headline: 'Interne',
      email: 'marie@example.com',
      phone: '0600000000',
      photoUrl: 'data:image/png;base64,AAAA',
      city: 'Paris',
    },
    summary: 'Résumé',
    experiences: [
      { id: 'e1', title: 'Stage', institution: 'CHU', isCurrent: true, bullets: ['a', 'b', ''] },
    ],
    references: [
      { id: 'r1', name: 'Pr X', institution: 'CHU', phone: '0611111111', email: 'x@chu.fr' },
    ],
    interests: [{ id: 'i1', label: 'Course' }, { id: 'i2', label: '' }],
  };

  it('retire la photo et les coordonnées perso', () => {
    const out = sanitizeCvForAi(doc) as Record<string, any>;
    expect(out.personalInfo.photoUrl).toBeUndefined();
    expect(out.personalInfo.email).toBeUndefined();
    expect(out.personalInfo.phone).toBeUndefined();
    expect(out.personalInfo.firstName).toBe('Marie');
  });

  it('retire les coordonnées des référents par défaut', () => {
    const out = sanitizeCvForAi(doc) as Record<string, any>;
    expect(out.references[0].phone).toBeUndefined();
    expect(out.references[0].email).toBeUndefined();
    expect(out.references[0].name).toBe('Pr X');
  });

  it('inclut les coordonnées des référents si demandé explicitement', () => {
    const out = sanitizeCvForAi(doc, { includeReferenceContactDetails: true }) as Record<string, any>;
    expect(out.references[0].phone).toBe('0611111111');
    expect(out.references[0].email).toBe('x@chu.fr');
  });

  it('normalise expériences (présent, bullets vides retirées) et intérêts', () => {
    const out = sanitizeCvForAi(doc) as Record<string, any>;
    expect(out.experiences[0].endDate).toBe('présent');
    expect(out.experiences[0].bullets).toEqual(['a', 'b']);
    expect(out.interests).toEqual(['Course']);
  });

  it('ne renvoie pas de champs vides parasites', () => {
    const out = sanitizeCvForAi({ personalInfo: {} }) as Record<string, any>;
    expect(out.summary).toBeUndefined();
    expect(out.experiences ?? []).toEqual([]);
  });
});
