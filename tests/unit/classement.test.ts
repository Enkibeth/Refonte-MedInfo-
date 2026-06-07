import { describe, it, expect } from 'vitest';

import {
  parseDelimited,
  detectDelimiter,
  toNumber,
  detectColumns,
  defaultGradeCol,
  rankWithin,
  findRow,
  analyze,
} from '@/lib/classement';

const CSV = `Numero;Nom;Moyenne
22001;Alice;15,5
22002;Bob;9,0
22003;Chloé;"12,5"
22004;David;18
22005;Eve;9,0`;

describe('classement — parsing', () => {
  it('détecte le séparateur point-virgule (Excel FR)', () => {
    expect(detectDelimiter(CSV)).toBe(';');
  });

  it('parse les en-têtes et les lignes (guillemets gérés)', () => {
    const sheet = parseDelimited(CSV);
    expect(sheet.headers).toEqual(['Numero', 'Nom', 'Moyenne']);
    expect(sheet.rows).toHaveLength(5);
    expect(sheet.rows[2]).toEqual(['22003', 'Chloé', '12,5']);
  });

  it('toNumber gère les virgules françaises', () => {
    expect(toNumber('15,5')).toBe(15.5);
    expect(toNumber('18')).toBe(18);
    expect(Number.isNaN(toNumber('abc'))).toBe(true);
    expect(Number.isNaN(toNumber(''))).toBe(true);
  });
});

describe('classement — détection de colonnes', () => {
  it('repère la colonne identifiant et la colonne note', () => {
    const sheet = parseDelimited(CSV);
    const { idCol, gradeCols } = detectColumns(sheet);
    expect(sheet.headers[idCol]).toBe('Numero');
    expect(gradeCols.map((c) => sheet.headers[c])).toContain('Moyenne');
    expect(defaultGradeCol(sheet, gradeCols)).toBe(sheet.headers.indexOf('Moyenne'));
  });
});

describe('classement — rang & stats', () => {
  it('classe correctement (rang de compétition, ex æquo partagés)', () => {
    const values = [15.5, 9, 12.5, 18, 9];
    const r = rankWithin(values, 15.5)!;
    expect(r.total).toBe(5);
    expect(r.rank).toBe(2); // 18 devant
    expect(r.max).toBe(18);
    expect(r.min).toBe(9);
    expect(r.median).toBe(12.5);
    expect(Math.round(r.mean * 10) / 10).toBe(12.8);
  });

  it('les ex æquo partagent le même rang', () => {
    const values = [15.5, 9, 12.5, 18, 9];
    expect(rankWithin(values, 9)!.rank).toBe(4); // 18,15.5,12.5 devant → rang 4
    expect(rankWithin(values, 9)!.betterThanPct).toBe(0);
  });

  it('retourne null si aucune note exploitable', () => {
    expect(rankWithin([], 12)).toBeNull();
    expect(rankWithin([12, 13], NaN)).toBeNull();
  });
});

describe('classement — analyse complète', () => {
  const sheet = parseDelimited(CSV);
  const { idCol, gradeCols } = detectColumns(sheet);
  const gradeCol = defaultGradeCol(sheet, gradeCols);

  it('trouve mon rang et compare à un autre numéro', () => {
    const res = analyze(sheet, idCol, gradeCol, '22001', '22002');
    expect(res.me?.ranking.rank).toBe(2);
    expect(res.other?.ranking.rank).toBe(4);
    expect(res.gap).toBe(6.5); // 15.5 - 9
    expect(res.error).toBeUndefined();
  });

  it('renvoie une erreur claire si le numéro est introuvable', () => {
    const res = analyze(sheet, idCol, gradeCol, '99999');
    expect(res.me).toBeNull();
    expect(res.error).toMatch(/introuvable/i);
  });

  it('findRow est souple sur les espaces/casse', () => {
    expect(findRow(sheet, idCol, ' 22004 ')).toBe(3);
  });
});
