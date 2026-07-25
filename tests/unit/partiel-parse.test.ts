/**
 * Tests du PARSING de l'analyseur de partiels (`public/partiel.html`) : détection
 * de l'en-tête, de la colonne identifiant, de l'échelle, reconstruction PDF.
 *
 * Le moteur statistique (stats, classement, pondération, simulation, synthèse) est
 * couvert par `partiel-engine.test.ts`. Les deux suites exécutent le bloc
 * `@partiel-logic` RÉELLEMENT livré (cf. `helpers/partielLogic.ts`).
 */
import { describe, expect, it } from 'vitest';

import { L } from './helpers/partielLogic';

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

describe('parseDelimited (CSV/TSV)', () => {
  it('NE transforme PAS « 7,5 » en 75 — le piège du séparateur de milliers', () => {
    const rows = L.parseDelimited('Num;Anat\n28710001;7,5\n28710002;12');
    expect(rows).toEqual([
      ['Num', 'Anat'],
      ['28710001', '7,5'],
      ['28710002', '12'],
    ]);
    expect(L.coerceCell(rows[1][1])).toBe(7.5);
  });
  it('détecte le séparateur point-virgule, tabulation, barre et virgule', () => {
    expect(L.detectDelimiter(['a;b;c', '1;2;3'])).toBe(';');
    expect(L.detectDelimiter(['a\tb\tc', '1\t2\t3'])).toBe('\t');
    expect(L.detectDelimiter(['a|b|c', '1|2|3'])).toBe('|');
    expect(L.detectDelimiter(['a,b,c', '1,2,3'])).toBe(',');
  });
  it('privilégie « ; » quand les notes contiennent des virgules décimales', () => {
    expect(L.detectDelimiter(['Num;Anat;Bioch', '1;7,5;12,25', '2;8,5;11,75'])).toBe(';');
  });
  it('respecte les guillemets, y compris autour d’un saut de ligne', () => {
    expect(L.parseDelimitedWith('a;"b;c";d', ';')).toEqual([['a', 'b;c', 'd']]);
    expect(L.parseDelimitedWith('a;"li1\nli2";c', ';')).toEqual([['a', 'li1\nli2', 'c']]);
    expect(L.parseDelimitedWith('a;"dit ""oui""";c', ';')).toEqual([['a', 'dit "oui"', 'c']]);
  });
  it('ignore BOM, lignes vides et fins de ligne Windows/Mac', () => {
    expect(L.parseDelimited('﻿a;b\r\n1;2\r\n\r\n3;4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
    expect(L.parseDelimited('a;b\r1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(L.parseDelimited('')).toEqual([]);
  });
});

describe('decodeText', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it('lit de l’UTF-8 et retire le BOM', () => {
    expect(L.decodeText(enc('﻿Numéro étudiant'))).toBe('Numéro étudiant');
  });
  it('bascule en windows-1252 quand le fichier n’est pas de l’UTF-8 valide', () => {
    // « Numéro » encodé en latin-1 : 0xE9 seul est invalide en UTF-8.
    const latin = Uint8Array.from([0x4e, 0x75, 0x6d, 0xe9, 0x72, 0x6f]);
    expect(L.decodeText(latin)).toBe('Numéro');
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

  it('UNE NOTE MANQUANTE laisse un trou et ne décale pas les suivantes', () => {
    // Le risque majeur d'un PDF : si l'absence de cellule décalait la ligne, un 14
    // de Physio serait lu comme une note d'Anatomie — une note fausse, attribuée
    // à la mauvaise épreuve.
    const cols = [40, 200, 360];
    const items: Item[] = [];
    ['Num', 'Anatomie', 'Physio'].forEach((s, c) => items.push({ x: cols[c], y: 20, str: s }));
    [
      ['28710015', '12,5', '14'],
      ['28710020', '9', '11'],
      ['28710030', '15', '13'],
    ].forEach((row, r) => row.forEach((s, c) => items.push({ x: cols[c], y: 40 + r * 20, str: s })));
    // 4e ligne : pas de note d'Anatomie (colonne du milieu vide).
    items.push({ x: cols[0], y: 100, str: '28710040' });
    items.push({ x: cols[2], y: 100, str: '17' });

    const rows = L.reconstructTableFromItems(items);
    const incomplete = rows.find((r: any[]) => r[0] === '28710040');
    expect(incomplete).toEqual(['28710040', null, '17']);
  });

  it('recolle les fragments d’une même cellule au lieu d’inventer une colonne', () => {
    // pdf.js découpe fréquemment un libellé en plusieurs items voisins.
    const cols = [40, 200, 360];
    const items: Item[] = [];
    ['Num', 'Épreuve', 'Note'].forEach((s, c) => items.push({ x: cols[c], y: 20, str: s }));
    [40, 60, 80].forEach((y, i) => {
      items.push({ x: cols[0], y, str: `287100${i}` });
      items.push({ x: cols[1], y, str: 'Santé' });
      items.push({ x: cols[1] + 24, y, str: 'publique' });
      items.push({ x: cols[2], y, str: '12' });
    });
    const rows = L.reconstructTableFromItems(items);
    const data = rows.filter((r: any[]) => /^287100/.test(String(r[0])));
    expect(data).toHaveLength(3);
    expect(data[0][1]).toBe('Santé publique');
    expect(data[0][2]).toBe('12');
  });

  it('enchaîne plusieurs pages sans mélanger les lignes', () => {
    // `extractRowsFromPdf` décale le y de chaque page (yOffset) : les lignes de la
    // page 2 doivent se suivre, pas se confondre avec celles de la page 1.
    const cols = [40, 200];
    const PAGE = 800;
    const items: Item[] = [];
    ['Num', 'Anatomie'].forEach((s, c) => items.push({ x: cols[c], y: 20, str: s }));
    for (let p = 0; p < 2; p++) {
      for (let r = 0; r < 4; r++) {
        const y = p * PAGE + 40 + r * 20;
        items.push({ x: cols[0], y, str: String(28710000 + p * 4 + r) });
        items.push({ x: cols[1], y, str: String(10 + p * 4 + r) });
      }
    }
    const rows = L.reconstructTableFromItems(items);
    const ids = rows.map((r: any[]) => String(r[0])).filter((s: string) => /^287100\d\d$/.test(s));
    expect(ids).toEqual(['28710000', '28710001', '28710002', '28710003', '28710004', '28710005', '28710006', '28710007']);
  });

  it('ignore les items vides et supporte les entrées dégénérées', () => {
    expect(L.reconstructTableFromItems([])).toEqual([]);
    expect(L.reconstructTableFromItems(null)).toEqual([]);
    expect(L.reconstructTableFromItems([{ x: 1, y: 1, str: '   ' }])).toEqual([]);
    // Une seule colonne : pas de découpage à inventer.
    const single = L.reconstructTableFromItems([
      { x: 40, y: 10, str: 'a' },
      { x: 40, y: 30, str: 'b' },
    ]);
    expect(single).toEqual([['a'], ['b']]);
  });
});

describe('mergeLineFragments (recollage conservateur)', () => {
  const line = (xs: number[], strs: string[]) => xs.map((x, i) => ({ x, y: 10, str: strs[i] }));

  it('recolle un écart très inférieur à l’écart entre colonnes', () => {
    const lines = [
      line([40, 200, 224, 360], ['1', 'Santé', 'publique', '12']),
      line([40, 200, 224, 360], ['2', 'Santé', 'publique', '14']),
    ];
    const out = L.mergeLineFragments(lines);
    expect(out[0].map((c: any) => c.str)).toEqual(['1', 'Santé publique', '12']);
    expect(out[0][1].x).toBe(200); // la cellule garde le x de son premier fragment
  });

  it('NE fusionne PAS des colonnes réellement rapprochées mais régulières', () => {
    const lines = [
      line([40, 70, 100, 130], ['1', '12', '13', '14']),
      line([40, 70, 100, 130], ['2', '15', '16', '17']),
    ];
    const out = L.mergeLineFragments(lines);
    expect(out[0]).toHaveLength(4);
  });

  it('ne touche à rien quand il n’y a pas assez d’écarts pour décider', () => {
    const lines = [line([40], ['a']), line([40], ['b'])];
    expect(L.mergeLineFragments(lines)).toEqual(lines);
    expect(L.mergeLineFragments(lines)).not.toBe(lines);
    expect(L.mergeLineFragments([])).toEqual([]);
    expect(L.mergeLineFragments(null)).toEqual([]);
  });

  it('ne renvoie jamais le tableau d’entrée (pas d’aliasing pour l’appelant)', () => {
    const lines = [line([40, 200, 224, 360], ['1', 'Santé', 'publique', '12'])];
    const out = L.mergeLineFragments(lines);
    expect(out).not.toBe(lines);
    expect(lines[0]).toHaveLength(4); // l'entrée n'est pas mutée
  });
});

describe('pipeline PDF complet (items → statistiques)', () => {
  // Vérifie que la chaîne réellement enchaînée par `handleFile` pour un PDF —
  // reconstruction, en-tête, colonne identifiant, échelle, notes — donne EXACTEMENT
  // les mêmes chiffres que le même relevé importé en CSV.
  const grades = [
    ['28710001', '4', '18', '10'],
    ['28710002', '6', '17', '11'],
    ['28710003', '6', '16', '12'],
    ['28710004', '7', '16', '9'],
    ['28710005', '7,5', '15', '13'],
    ['28710006', '8', '15', '8'],
    ['28710007', '8', '14', '14'],
    ['28710008', '9', '14', '10'],
    ['28710009', '10', '13', '11'],
    ['28710010', '11', '12', 'ABS'],
    ['28710011', '12', '11', '15'],
    ['28710012', '14', '10', '16'],
  ];
  const header = ['Numéro étudiant', 'Anatomie', 'Biochimie', 'Physiologie'];

  const analyze = (rows: any[][]) => {
    const { hdrs, body } = L.normalizeTable(rows);
    const idCol = L.detectIdCol(body, hdrs);
    const { subjects, students } = L.parseBody(body, hdrs, idCol);
    const scaleMax = L.rawScale(body, hdrs, idCol);
    const subStats: Record<string, any> = {};
    for (const s of subjects) subStats[s] = L.computeStats(students.map((r: any) => r.grades[s]));
    return { hdrs, idCol, subjects, students, scaleMax, subStats };
  };

  const pdfItems = () => {
    const cols = [40, 220, 380, 540];
    const items: Item[] = [];
    // Bandeau de scolarité au-dessus du tableau, comme sur un vrai relevé.
    items.push({ x: 40, y: 12, str: 'Faculté de santé — relevé de notes' });
    header.forEach((s, c) => items.push({ x: cols[c], y: 46, str: s }));
    grades.forEach((row, r) => row.forEach((s, c) => items.push({ x: cols[c], y: 70 + r * 18, str: s })));
    return items;
  };

  it('retrouve l’en-tête, la colonne identifiant et l’échelle depuis un PDF', () => {
    const res = analyze(L.reconstructTableFromItems(pdfItems()));
    expect(res.idCol).toBe(0);
    expect(res.subjects).toEqual(['Anatomie', 'Biochimie', 'Physiologie']);
    expect(res.scaleMax).toBe(20);
    expect(res.students).toHaveLength(12);
  });

  it('donne les mêmes statistiques qu’en CSV, virgule décimale comprise', () => {
    const fromPdf = analyze(L.reconstructTableFromItems(pdfItems()));
    const fromCsv = analyze(L.parseDelimited([header, ...grades].map((r) => r.join(';')).join('\n')));

    expect(fromPdf.subjects).toEqual(fromCsv.subjects);
    for (const s of fromCsv.subjects) {
      expect(fromPdf.subStats[s].n).toBe(fromCsv.subStats[s].n);
      expect(fromPdf.subStats[s].mean).toBeCloseTo(fromCsv.subStats[s].mean, 10);
      expect(fromPdf.subStats[s].median).toBeCloseTo(fromCsv.subStats[s].median, 10);
    }
    // Le 7,5 reste 7,5 (et non 75) par les deux chemins.
    expect(fromPdf.students[4].grades.Anatomie).toBe(7.5);
    expect(fromCsv.students[4].grades.Anatomie).toBe(7.5);
    // L'absence reste une absence : ni 0, ni décalage de colonne.
    expect(fromPdf.students[9].grades.Physiologie).toBeNull();
    expect(fromPdf.subStats.Physiologie.n).toBe(11);
    // Le classement général est identique par les deux chemins.
    const meansOf = (r: typeof fromPdf) =>
      L.cohortMeans(r.students, r.subjects, {}).stats.sorted;
    expect(meansOf(fromPdf)).toEqual(meansOf(fromCsv));
  });

  it('refuse une liste d’affichage extraite d’un PDF (aucune vraie note)', () => {
    const cols = [40, 400, 560];
    const items: Item[] = [];
    ['NUMÉRO ÉTUDIANT', 'SALLE', 'PLACE N°'].forEach((s, c) => items.push({ x: cols[c], y: 20, str: s }));
    for (let i = 0; i < 8; i++) {
      items.push({ x: cols[0], y: 44 + i * 18, str: `28710${100 + i}DUPONT` });
      items.push({ x: cols[1], y: 44 + i * 18, str: 'salle 1-2' });
      items.push({ x: cols[2], y: 44 + i * 18, str: String(i + 1) });
    }
    const res = analyze(L.reconstructTableFromItems(items));
    expect(L.gradeColumnsOf(res.subjects, res.students, res.scaleMax)).toEqual([]);
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
