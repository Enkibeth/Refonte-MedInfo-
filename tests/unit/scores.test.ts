import { describe, it, expect } from 'vitest';

import {
  ALL_SCORES,
  CATEGORIES,
  countByCategory,
  getScore,
  normalize,
  searchScores,
  type RiskLevel,
  type ScoreDefinition,
} from '@/scores';

const LEVELS: RiskLevel[] = ['info', 'low', 'moderate', 'high', 'critical'];

/** Valeurs par défaut d'un score : choix = 1re option, nombres = default ?? min. */
function baseValues(def: ScoreDefinition, overrides: Record<string, number> = {}): Record<string, number> {
  const v: Record<string, number> = {};
  for (const f of def.fields) {
    if (f.kind === 'choice') v[f.id] = f.options[0].value;
    else v[f.id] = f.default ?? f.min ?? 1;
  }
  return { ...v, ...overrides };
}

function compute(id: string, overrides: Record<string, number> = {}) {
  const def = getScore(id);
  if (!def) throw new Error(`Score introuvable : ${id}`);
  return def.compute(baseValues(def, overrides));
}

describe('scores — intégrité du catalogue', () => {
  it('les identifiants de score sont uniques', () => {
    const ids = ALL_SCORES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque catégorie déclarée contient au moins un score', () => {
    const used = new Set(ALL_SCORES.map((s) => s.category));
    for (const c of CATEGORIES) expect(used.has(c.id)).toBe(true);
  });

  it('chaque score appartient à une catégorie connue', () => {
    const known = new Set(CATEGORIES.map((c) => c.id));
    for (const s of ALL_SCORES) expect(known.has(s.category)).toBe(true);
  });

  it('les identifiants de champ sont uniques au sein d’un score', () => {
    for (const s of ALL_SCORES) {
      const ids = s.fields.map((f) => f.id);
      expect(new Set(ids).size, `champs dupliqués dans ${s.id}`).toBe(ids.length);
    }
  });

  it('chaque score a un nom, un but et des mots-clés', () => {
    for (const s of ALL_SCORES) {
      expect(s.name.length).toBeGreaterThan(3);
      expect(s.purpose.length).toBeGreaterThan(10);
      expect(s.keywords.length).toBeGreaterThan(0);
      expect(s.fields.length).toBeGreaterThan(0);
    }
  });

  it('countByCategory somme au nombre total de scores', () => {
    const counts = countByCategory();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(ALL_SCORES.length);
  });

  it('chaque score, rempli, calcule une valeur finie et une interprétation valide', () => {
    for (const s of ALL_SCORES) {
      const r = s.compute(baseValues(s));
      expect(Number.isFinite(r.value), `valeur non finie pour ${s.id}`).toBe(true);
      expect(r.incomplete, `${s.id} incomplet alors que rempli`).toBeFalsy();
      expect(LEVELS).toContain(r.interpretation.level);
      expect(r.display.length).toBeGreaterThan(0);
    }
  });

  it('un champ numérique manquant rend le résultat incomplet (pas de valeur trompeuse)', () => {
    // CKD-EPI sans créatinine ni âge.
    const ckd = getScore('ckd-epi')!;
    const r = ckd.compute({ sex: 0 });
    expect(r.incomplete).toBe(true);
    expect(Number.isNaN(r.value)).toBe(true);
  });
});

describe('scores — exactitude des calculs (à points)', () => {
  it('CHA₂DS₂-VASc : femme + ≥75 ans + HTA = 4 (risque élevé)', () => {
    const r = compute('cha2ds2-vasc', { sex: 1, age: 2, htn: 1 });
    expect(r.value).toBe(4);
    expect(r.interpretation.level).toBe('high');
  });

  it('HAS-BLED : HTA + rénal + âge > 65 = 3 (risque élevé)', () => {
    const r = compute('has-bled', { htn: 1, renal: 1, elderly: 1 });
    expect(r.value).toBe(3);
    expect(r.interpretation.level).toBe('high');
  });

  it('TIMI NSTEMI : 5 items positifs = 5 (risque élevé)', () => {
    const r = compute('timi-nstemi', { age: 1, riskFactors: 1, knownCad: 1, aspirin: 1, angina: 1 });
    expect(r.value).toBe(5);
    expect(r.interpretation.level).toBe('high');
  });

  it('Wells EP : signes de TVP + EP probable + tachycardie = 7,5 (forte probabilité)', () => {
    const r = compute('wells-ep', { dvtSigns: 3, peLikely: 3, tachycardia: 1.5 });
    expect(r.value).toBeCloseTo(7.5, 5);
    expect(r.interpretation.level).toBe('high');
  });

  it('Wells EP : seule une hémoptysie = 1 (faible probabilité)', () => {
    const r = compute('wells-ep', { hemoptysis: 1 });
    expect(r.value).toBe(1);
    expect(r.interpretation.level).toBe('low');
  });

  it('Wells TVP : diagnostic alternatif plus probable = −2 (faible)', () => {
    const r = compute('wells-tvp', { altDiagnosis: -2 });
    expect(r.value).toBe(-2);
    expect(r.interpretation.level).toBe('low');
  });

  it('Genève révisé : FC ≥ 95 + ATCD MTEV + douleur unilatérale = 11 (fort)', () => {
    const r = compute('geneve-ep', { heartRate: 5, previousVte: 3, unilateralPain: 3 });
    expect(r.value).toBe(11);
    expect(r.interpretation.level).toBe('high');
  });

  it('PESI : âge 70 + homme + cancer = 110 (classe IV, élevé)', () => {
    const r = compute('pesi', { age: 70, male: 10, cancer: 30 });
    expect(r.value).toBe(110);
    expect(r.interpretation.level).toBe('high');
  });

  it('CURB-65 : confusion + urée + âge = 3 (gravité élevée)', () => {
    const r = compute('curb-65', { confusion: 1, urea: 1, age: 1 });
    expect(r.value).toBe(3);
    expect(r.interpretation.level).toBe('high');
  });

  it('Glasgow : réponses minimales = 3 (grave) ; maximales = 15 (léger)', () => {
    const worst = compute('glasgow', { eye: 1, verbal: 1, motor: 1 });
    expect(worst.value).toBe(3);
    expect(worst.interpretation.level).toBe('critical');
    const best = compute('glasgow', { eye: 4, verbal: 5, motor: 6 });
    expect(best.value).toBe(15);
    expect(best.interpretation.level).toBe('low');
  });

  it('NEWS2 : tout normal = 0 ; FR ≥ 25 + SpO₂ ≤ 91 = 6 (intermédiaire)', () => {
    const normalScore = compute('news2');
    expect(normalScore.value).toBe(0);
    expect(normalScore.interpretation.level).toBe('low');
    const raised = compute('news2', { respRate: 3, spo2: 3 });
    expect(raised.value).toBe(6);
    expect(raised.interpretation.level).toBe('moderate');
  });

  it('Child-Pugh : tout minimal = 5 (A) ; tout maximal = 15 (C)', () => {
    const a = compute('child-pugh');
    expect(a.value).toBe(5);
    expect(a.interpretation.label).toBe('Classe A');
    const c = compute('child-pugh', { bilirubin: 3, albumin: 3, inr: 3, ascites: 3, encephalopathy: 3 });
    expect(c.value).toBe(15);
    expect(c.interpretation.label).toBe('Classe C');
  });

  it('CAGE : ≥ 2 réponses positives = dépistage positif', () => {
    const r = compute('cage', { cut: 1, eyeOpener: 1 });
    expect(r.value).toBe(2);
    expect(r.interpretation.level).toBe('high');
  });
});

describe('scores — exactitude des formules', () => {
  it('index de choc : FC 120 / PAS 80 = 1,5 (élevé)', () => {
    const r = compute('index-de-choc', { hr: 120, sbp: 80 });
    expect(r.value).toBeCloseTo(1.5, 5);
    expect(r.interpretation.level).toBe('high');
  });

  it('CKD-EPI 2021 : femme, 50 ans, créat 79,56 µmol/L ≈ 78 mL/min/1,73 m²', () => {
    const r = compute('ckd-epi', { creat: 79.56, age: 50, sex: 1 });
    expect(r.value).toBeGreaterThan(76);
    expect(r.value).toBeLessThan(80);
  });

  it('Cockcroft-Gault : homme 60 ans, 80 kg, créat 90 µmol/L ≈ 87 mL/min', () => {
    const r = compute('cockcroft', { creat: 90, age: 60, weight: 80, sex: 1.23 });
    expect(r.value).toBeCloseTo(87.47, 1);
  });

  it('calcémie corrigée : Ca 2,1 mmol/L, albumine 30 g/L = 2,30 (normale)', () => {
    const r = compute('calcemie-corrigee', { calcium: 2.1, albumin: 30 });
    expect(r.value).toBeCloseTo(2.3, 5);
    expect(r.interpretation.level).toBe('low');
  });

  it('trou anionique : Na 140, Cl 100, HCO₃ 16 = 24 (augmenté)', () => {
    const r = compute('trou-anionique', { sodium: 140, chloride: 100, bicarbonate: 16 });
    expect(r.value).toBe(24);
    expect(r.interpretation.level).toBe('high');
  });

  it('MELD : bili 34,2 / INR 2 / créat 176,8 µmol/L = 23 (élevé)', () => {
    const r = compute('meld', { bilirubin: 34.2, inr: 2, creat: 176.8, dialysis: 0 });
    expect(r.value).toBe(23);
    expect(r.interpretation.level).toBe('high');
  });

  it('FIB-4 : 60 ans, AST 60, ALT 30, plaquettes 100 ≈ 6,57 (fibrose probable)', () => {
    const r = compute('fib-4', { age: 60, ast: 60, alt: 30, platelets: 100 });
    expect(r.value).toBeCloseTo(6.57, 1);
    expect(r.interpretation.level).toBe('high');
  });

  it('IMC : 70 kg / 175 cm ≈ 22,9 (normal)', () => {
    const r = compute('imc', { weight: 70, height: 175 });
    expect(r.value).toBeCloseTo(22.86, 1);
    expect(r.interpretation.level).toBe('low');
  });
});

describe('scores — recherche par NOM', () => {
  it('« chads » retrouve CHA₂DS₂-VASc en tête', () => {
    expect(searchScores('chads')[0]?.id).toBe('cha2ds2-vasc');
  });

  it('le sigle exact avec indices « CHA₂DS₂-VASc » retrouve le score', () => {
    expect(searchScores('CHA₂DS₂-VASc')[0]?.id).toBe('cha2ds2-vasc');
  });

  it('insensible aux accents : « geneve » = « genève »', () => {
    expect(searchScores('geneve').map((s) => s.id)).toContain('geneve-ep');
    expect(searchScores('genève').map((s) => s.id)).toContain('geneve-ep');
  });

  it('« glasgow » retrouve le GCS', () => {
    expect(searchScores('glasgow').map((s) => s.id)).toContain('glasgow');
  });
});

describe('scores — recherche par FONCTION (nom oublié)', () => {
  it('« risque hémorragique anticoagulant » retrouve HAS-BLED en tête', () => {
    expect(searchScores('risque hémorragique anticoagulant')[0]?.id).toBe('has-bled');
  });

  it('« probabilité embolie pulmonaire » retrouve Wells/Genève', () => {
    const ids = searchScores('probabilité embolie pulmonaire').map((s) => s.id);
    expect(ids).toContain('wells-ep');
    expect(ids).toContain('geneve-ep');
  });

  it('« clairance rénale » retrouve Cockcroft et CKD-EPI', () => {
    const ids = searchScores('clairance rénale').map((s) => s.id);
    expect(ids).toContain('cockcroft');
    expect(ids).toContain('ckd-epi');
  });

  it('« gravité pneumonie » retrouve CURB-65', () => {
    expect(searchScores('gravité pneumonie').map((s) => s.id)).toContain('curb-65');
  });

  it('« sevrage alcool dépistage » retrouve AUDIT-C / CAGE', () => {
    const ids = searchScores('alcool dépistage').map((s) => s.id);
    expect(ids).toContain('audit-c');
    expect(ids).toContain('cage');
  });
});

describe('scores — recherche : filtres et bornes', () => {
  it('requête vide → tous les scores', () => {
    expect(searchScores('').length).toBe(ALL_SCORES.length);
  });

  it('filtre de catégorie → seuls les scores de cette catégorie', () => {
    const cardio = searchScores('', { category: 'cardio' });
    expect(cardio.length).toBeGreaterThan(0);
    expect(cardio.every((s) => s.category === 'cardio')).toBe(true);
  });

  it('requête sans correspondance → aucun résultat', () => {
    expect(searchScores('xyzqwerty')).toHaveLength(0);
  });

  it('normalize gère casse, accents et indices', () => {
    expect(normalize('CHA₂DS₂-VASc')).toBe('cha2ds2 vasc');
    expect(normalize('Genève  révisé')).toBe('geneve revise');
  });
});
