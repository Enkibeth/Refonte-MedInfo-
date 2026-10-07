import { describe, expect, it } from 'vitest';

import { classifyChatFile, looksLikeGradeTable } from '@/chat/gradeSheet';

function promo(rows: number, header: string | null, delimiter = ';'): string {
  const lines: string[] = [];
  if (header) lines.push(header);
  for (let i = 0; i < rows; i++) {
    const g = (k: number) => String(((i * 7 + k * 3) % 21)).replace('.', ',');
    lines.push([`2100${100 + i}`, `${g(1)},5`, g(2), g(3)].join(delimiter));
  }
  return lines.join('\n');
}

describe('relevés de notes : reconnus', () => {
  it('CSV français avec en-tête typique (n° étudiant, UE, moyenne)', () => {
    const text = promo(40, 'N° étudiant;UE1 Cardio;UE2 Pneumo;Moyenne');
    expect(looksLikeGradeTable(text)).toEqual({ rows: 40 });
  });

  it('en-tête dont les accents ont été perdus au décodage', () => {
    const text = promo(12, 'Num�ro �tudiant;�preuve 1;�preuve 2;Coef');
    expect(looksLikeGradeTable(text)).not.toBeNull();
  });

  it('tabulations (copie depuis Excel) et absences « ABS »', () => {
    const lines = ['Anonymat\tUE1\tUE2', ...Array.from({ length: 10 }, (_, i) => `A${i}\t${i % 3 === 0 ? 'ABS' : '12,5'}\t${(i % 20) + 0.5}`)];
    expect(looksLikeGradeTable(lines.join('\n'))).toEqual({ rows: 10 });
  });

  it('sans en-tête : promo entière, identifiants distincts, plusieurs colonnes sur 20', () => {
    expect(looksLikeGradeTable(promo(30, null))).toEqual({ rows: 30 });
  });

  it('« Note » seul suffit quand plusieurs colonnes sont sur 20', () => {
    expect(looksLikeGradeTable(promo(8, 'Id;Note écrit;Note oral;Note TP'))).not.toBeNull();
  });
});

describe('autres fichiers tabulaires : jamais pris pour des notes', () => {
  it('export de bilans biologiques (dates + valeurs)', () => {
    const lines = ['Date;Hb;Leucocytes;Plaquettes;CRP'];
    for (let i = 0; i < 30; i++) lines.push(`2026-0${(i % 9) + 1}-${10 + (i % 18)};${12 + (i % 4)},${i % 10};${5 + (i % 5)};${180 + i};${i % 15}`);
    expect(looksLikeGradeTable(lines.join('\n'))).toBeNull();
  });

  it('colonne « Notes » de commentaires avec une seule colonne numérique', () => {
    const lines = ['Date;Poids;Notes', ...Array.from({ length: 10 }, (_, i) => `J${i};${70 + i};RAS`)];
    expect(looksLikeGradeTable(lines.join('\n'))).toBeNull();
  });

  it('sans en-tête mais trop court, ou texte libre', () => {
    expect(looksLikeGradeTable(promo(8, null))).toBeNull();
    expect(looksLikeGradeTable('Bonjour,\nvoici mon compte rendu.\nIl fait plusieurs lignes.\nSans tableau.\nFin.\nMerci.')).toBeNull();
  });

  it('en-tête de notes mais trop peu de lignes', () => {
    expect(looksLikeGradeTable(promo(3, 'Etudiant;UE1;UE2;Moyenne'))).toBeNull();
  });
});

describe('verdict par fichier', () => {
  it('tableurs : toujours confiés à Partiels', () => {
    expect(classifyChatFile({ name: 'resultats.xlsx', mediaType: '' })).toBe('spreadsheet');
    expect(classifyChatFile({ name: 'export', mediaType: 'application/vnd.ms-excel' })).toBe('spreadsheet');
    expect(classifyChatFile({ name: 'notes.ods', mediaType: 'application/vnd.oasis.opendocument.spreadsheet' })).toBe('spreadsheet');
  });

  it('CSV : selon son contenu', () => {
    expect(classifyChatFile({ name: 'promo.csv', mediaType: 'text/csv', textSample: promo(20, 'Matricule;UE1;UE2;Moyenne') })).toBe('grade-table');
    expect(classifyChatFile({ name: 'bio.csv', mediaType: 'text/csv', textSample: 'a;b\n1;2' })).toBe('other');
    expect(classifyChatFile({ name: 'promo.csv', mediaType: 'text/csv' })).toBe('other');
  });

  it('PDF : suggestion d’après le nom seulement', () => {
    expect(classifyChatFile({ name: 'Resultats_S5_2026.pdf', mediaType: 'application/pdf' })).toBe('grade-pdf-name');
    expect(classifyChatFile({ name: 'classement-partiel-UE3.pdf', mediaType: 'application/pdf' })).toBe('grade-pdf-name');
    expect(classifyChatFile({ name: 'resultats_biologie.pdf', mediaType: 'application/pdf' })).toBe('other');
    expect(classifyChatFile({ name: 'compte-rendu-IRM.pdf', mediaType: 'application/pdf' })).toBe('other');
  });

  it('images : pièce jointe ordinaire', () => {
    expect(classifyChatFile({ name: 'releve.png', mediaType: 'image/png' })).toBe('other');
  });
});
