/**
 * Tests de la logique pure de l'analyseur de partiels (`public/partiel.html`).
 *
 * Le code vit dans une page HTML autonome (traitement 100 % client). Pour le tester
 * sans dupliquer, on extrait le bloc délimité par `@partiel-logic:start/end` et on
 * l'exécute dans un contexte `vm` Node — ce sont donc les fonctions RÉELLEMENT livrées
 * qui sont vérifiées.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../../public/partiel.html'), 'utf-8');

const startMarker = html.indexOf('@partiel-logic:start');
const endComment = html.indexOf('/* @partiel-logic:end');
if (startMarker < 0 || endComment < 0) throw new Error('Bloc @partiel-logic introuvable dans partiel.html');
// Le bloc s'ouvre par `/* @partiel-logic:start ... */` : on prend le code APRÈS la
// fermeture de ce commentaire et AVANT le commentaire de fin.
const codeStart = html.indexOf('*/', startMarker) + 2;
const code = html.slice(codeStart, endComment);

const sandbox: { module: { exports: Record<string, any> } } = { module: { exports: {} } };
vm.runInNewContext(code, sandbox);
const L = sandbox.module.exports;

type Item = { x: number; y: number; str: string };

describe('coerceCell', () => {
  it('convertit la virgule décimale FR et les espaces fines', () => {
    expect(L.coerceCell('12,5')).toBe(12.5);
    expect(L.coerceCell('1 234,5')).toBe(1234.5);
    expect(L.coerceCell('14')).toBe(14);
  });
  it('renvoie null pour vide et mentions d\'absence', () => {
    expect(L.coerceCell('')).toBeNull();
    expect(L.coerceCell('ABS')).toBeNull();
    expect(L.coerceCell('DEF')).toBeNull();
    expect(L.coerceCell('—')).toBeNull();
    expect(L.coerceCell(null)).toBeNull();
  });
  it('conserve les chaînes non numériques (noms, identifiants alphanum.)', () => {
    expect(L.coerceCell('DUPONT')).toBe('DUPONT');
    expect(L.coerceCell('2604403RANKOVICNICOLAS')).toBe('2604403RANKOVICNICOLAS');
  });
});

describe('normalizeTable', () => {
  it('saute les lignes de titre/préambule et choisit le vrai en-tête', () => {
    const all = [
      ['Faculté de santé', 'Année universitaire 2025-2026'],
      ['Numéro étudiant', 'Anatomie', 'Physiologie'],
      ['28710015', '12,5', '14'],
      ['28710020', '9', 'ABS'],
    ];
    const { hdrs, body } = L.normalizeTable(all);
    expect(hdrs.slice(0, 3)).toEqual(['Numéro étudiant', 'Anatomie', 'Physiologie']);
    expect(body.length).toBe(2);
    // Un identifiant purement numérique est coercé en nombre (re-stringifié plus tard).
    expect(body[0]).toEqual([28710015, 12.5, 14]);
    expect(body[1]).toEqual([28710020, 9, null]); // ABS → null
  });

  it('synthétise des en-têtes quand la 1re ligne pleine est numérique', () => {
    const all = [
      ['28710015', '12,5', '14'],
      ['28710020', '9', '11'],
      ['28710030', '15', '13'],
      ['28710040', '8', '17'],
    ];
    const { hdrs, body } = L.normalizeTable(all);
    expect(hdrs[0]).toMatch(/^Col\. 1$/);
    expect(body.length).toBe(4);
  });
});

describe('reconstructTableFromItems', () => {
  it('reconstruit un relevé de notes à colonnes régulières', () => {
    const items: Item[] = [];
    const cols = [40, 200, 360];
    const head = ['Num', 'Anatomie', 'Physio'];
    head.forEach((s, c) => items.push({ x: cols[c], y: 20, str: s }));
    const data = [
      ['28710015', '12,5', '14'],
      ['28710020', '9', '11'],
      ['28710030', '15', '13'],
    ];
    data.forEach((row, r) => row.forEach((s, c) => items.push({ x: cols[c], y: 40 + r * 20, str: s })));
    const rows = L.reconstructTableFromItems(items);
    expect(rows.length).toBe(4);
    expect(rows[0]).toEqual(['Num', 'Anatomie', 'Physio']);
    expect(rows[1]).toEqual(['28710015', '12,5', '14']);
  });

  it('gère des colonnes inégalement espacées + une ligne de titre (liste d\'affichage)', () => {
    // Reproduit la structure réelle du PDF « Liste d'affichage » : n°+nom+prénom
    // collés à gauche, puis SALLE et PLACE très à droite, avec un titre au-dessus.
    const items: Item[] = [
      { x: 24, y: 10, str: 'Faculté de santé' },
      { x: 352, y: 10, str: 'Année universitaire 2025-2026' },
      // en-tête sur 5 fragments
      { x: 34, y: 40, str: 'NUMÉRO ÉTUDIANT' },
      { x: 261, y: 40, str: 'NOM' },
      { x: 440, y: 40, str: 'PRÉNOM' },
      { x: 578, y: 40, str: 'SALLE' },
      { x: 653, y: 40, str: 'PLACE N°' },
    ];
    const rowsData = [
      ['2604403RANKOVICNICOLAS', 'salle 1-2', '1'],
      ['3070824BOVISMARIEJULIE', 'salle 1-2', '2'],
      ['3300879TELLIERANGELICA', 'salle 1-2', '3'],
      ['3408917DUCHOLETCLAIRE', 'salle 1-2', '4'],
      ['3409224BENACOMDAVID', 'salle 1-2', '5'],
      ['3522961THOUROUDEALIA', 'salle 1-2', '6'],
    ];
    const xs = [74, 556, 716];
    rowsData.forEach((row, r) => row.forEach((s, c) => items.push({ x: xs[c], y: 60 + r * 20, str: s })));
    const rows = L.reconstructTableFromItems(items);
    // 3 colonnes (structure modale des données), pas 5.
    expect(rows[0].length).toBe(3);
    // La ligne de titre devient une ligne courte ; les 6 lignes de données sont intactes.
    const dataRows = rows.filter((r: any[]) => /RANKOVIC|BOVIS|BENACOM/.test(String(r[0])));
    expect(dataRows.length).toBe(3);
    expect(dataRows[0][2]).toBe('1');
  });
});

describe('isLikelySequence', () => {
  it('repère une colonne place/rang 1..n', () => {
    expect(L.isLikelySequence([1, 2, 3, 4, 5, 6])).toBe(true);
    expect(L.isLikelySequence([3, 1, 2, 5, 4])).toBe(true);
  });
  it('ne classe PAS des notes comme une séquence', () => {
    expect(L.isLikelySequence([8, 9, 12, 14, 18])).toBe(false); // ne commence pas à 1
    expect(L.isLikelySequence([12.5, 14, 9, 11])).toBe(false); // non entiers
    expect(L.isLikelySequence([5, 5, 5, 5])).toBe(false); // constante
  });
});

describe('gradeColumnsOf — garde-fou « pas un relevé de notes »', () => {
  it('exclut une colonne place/séquence et ne retient que les vraies notes', () => {
    const students = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      grades: { Anatomie: [12.5, 9, 15, 8, 17, 11][i], Place: i + 1 },
    }));
    const grades = L.gradeColumnsOf(['Anatomie', 'Place'], students, 20);
    expect(grades).toEqual(['Anatomie']);
  });

  it('renvoie [] pour une liste d\'affichage (seule colonne numérique = place)', () => {
    const students = Array.from({ length: 6 }, (_, i) => ({
      id: `id${i}`,
      grades: { 'PLACE N°': i + 1 },
    }));
    expect(L.gradeColumnsOf(['PLACE N°'], students, 20)).toEqual([]);
  });
});

describe('détection bout-en-bout sur la liste d\'affichage', () => {
  it('aboutit à « aucune colonne de notes » (place exclue)', () => {
    const all = [
      ['Faculté de santé', 'Scolarité 2e cycle'],
      ['Numéro étudiant', 'Nom', 'Prénom', 'Salle', 'Place N°'],
      ['28710015', 'RANKOVIC', 'NICOLAS', 'salle 1-2', '1'],
      ['28710020', 'BOVIS', 'MARIE', 'salle 1-2', '2'],
      ['28710030', 'TELLIER', 'ANGELICA', 'salle 1-2', '3'],
      ['28710040', 'DUCHOLET', 'CLAIRE', 'salle 1-2', '4'],
    ];
    const { hdrs, body } = L.normalizeTable(all);
    const idCol = L.detectIdCol(body, hdrs);
    expect(hdrs[idCol]).toMatch(/[Nn]um/);
    const { subjects, students } = L.parseBody(body, hdrs, idCol);
    const scale = L.rawScale(body, hdrs, idCol);
    expect(L.gradeColumnsOf(subjects, students, scale)).toEqual([]);
  });

  it('analyse normalement un vrai relevé de notes', () => {
    const all = [
      ['Numéro étudiant', 'Anatomie', 'Physiologie', 'Biochimie'],
      ['28710015', '12,5', '14', '9'],
      ['28710020', '9', '11', '13'],
      ['28710030', '15', '13', '7'],
      ['28710040', '8', '17', '16'],
      ['28710050', '11', '10', '12'],
    ];
    const { hdrs, body } = L.normalizeTable(all);
    const idCol = L.detectIdCol(body, hdrs);
    const { subjects, students } = L.parseBody(body, hdrs, idCol);
    const scale = L.rawScale(body, hdrs, idCol);
    expect(idCol).toBe(0);
    expect(subjects).toEqual(['Anatomie', 'Physiologie', 'Biochimie']);
    expect(L.gradeColumnsOf(subjects, students, scale).sort()).toEqual(
      ['Anatomie', 'Biochimie', 'Physiologie'],
    );
    expect(students[0].grades.Anatomie).toBe(12.5);
  });
});
