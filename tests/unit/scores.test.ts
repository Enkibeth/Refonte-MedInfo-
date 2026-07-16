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

  it('Ganzoni : 70 kg, Hb 9 → 15 g/dL = 1508 mg (réserves 500)', () => {
    const r = compute('ganzoni', { weight: 70, hbActual: 9, hbTarget: 15 });
    expect(r.value).toBe(1508);
  });

  it('Ganzoni : Hb déjà ≥ cible → réserves seulement (500 mg ≥ 35 kg)', () => {
    const r = compute('ganzoni', { weight: 70, hbActual: 15, hbTarget: 15 });
    expect(r.value).toBe(500);
    expect(r.interpretation.label).toBe('Réserves seulement');
  });

  it('Ganzoni : enfant < 35 kg → réserves = 15 mg/kg (20 kg, Hb 8 → 12 = 492 mg)', () => {
    const r = compute('ganzoni', { weight: 20, hbActual: 8, hbTarget: 12 });
    expect(r.value).toBe(492);
  });
});

describe('scores — recherche par NOM', () => {
  it('« chads vasc » retrouve CHA₂DS₂-VASc en tête ; « chads » retrouve les deux scores', () => {
    expect(searchScores('chads vasc')[0]?.id).toBe('cha2ds2-vasc');
    const chads = searchScores('chads').map((s) => s.id);
    expect(chads).toContain('cha2ds2-vasc');
    expect(chads).toContain('chads2');
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

  it('« déficit en fer » et « carence martiale anémie » retrouvent le Ganzoni', () => {
    expect(searchScores('déficit en fer').map((s) => s.id)).toContain('ganzoni');
    expect(searchScores('carence fer anémie').map((s) => s.id)).toContain('ganzoni');
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

describe('scores — gériatrie', () => {
  it('G8 : profil altéré (défaut) = 0 → positif ; > 14 → négatif', () => {
    expect(compute('g8').interpretation.level).toBe('high'); // tout au minimum = 0
    const good = compute('g8', {
      appetite: 2, weightLoss: 3, mobility: 2, neuro: 2, bmi: 2, drugs: 1, selfHealth: 1, age: 2,
    });
    expect(good.value).toBe(15);
    expect(good.interpretation.level).toBe('low');
    const borderline = compute('g8', {
      appetite: 2, weightLoss: 3, mobility: 2, neuro: 2, bmi: 1, drugs: 1, selfHealth: 1, age: 2,
    });
    expect(borderline.value).toBe(14);
    expect(borderline.interpretation.level).toBe('high');
  });

  it('mini-GDS : 0 → peu probable ; ≥ 1 → positif', () => {
    expect(compute('mini-gds').value).toBe(0);
    expect(compute('mini-gds').interpretation.level).toBe('low');
    expect(compute('mini-gds', { sad: 1 }).interpretation.level).toBe('high');
  });

  it('GDS-15 : items inversés comptés correctement (5 = léger, 10 = sévère)', () => {
    expect(compute('gds-15').value).toBe(0);
    const mild = compute('gds-15', { satisfied: 1, dropped: 1, empty: 1, bored: 1, afraid: 1 });
    expect(mild.value).toBe(5);
    expect(mild.interpretation.level).toBe('moderate');
    const severe = compute('gds-15', {
      satisfied: 1, dropped: 1, empty: 1, bored: 1, afraid: 1,
      helpless: 1, stayHome: 1, memory: 1, worthless: 1, desperate: 1,
    });
    expect(severe.value).toBe(10);
    expect(severe.interpretation.level).toBe('high');
  });

  it('ADL de Katz : 6 = autonome ; 2 = dépendance sévère', () => {
    expect(compute('adl-katz').value).toBe(6); // défaut = tout indépendant
    const dependent = compute('adl-katz', { toileting: 0, transfer: 0, continence: 0, feeding: 0 });
    expect(dependent.value).toBe(2);
    expect(dependent.interpretation.level).toBe('high');
  });

  it('MMSE : 30 = normal ; 21 = démence légère à modérée ; champ manquant = incomplet', () => {
    const full = compute('mmse', { orientationTime: 5, orientationPlace: 5, registration: 3, attention: 5, recall: 3, language: 9 });
    expect(full.value).toBe(30);
    expect(full.interpretation.level).toBe('low');
    const dementia = compute('mmse', { orientationTime: 3, orientationPlace: 3, registration: 3, attention: 3, recall: 1, language: 8 });
    expect(dementia.value).toBe(21);
    expect(dementia.interpretation.level).toBe('high');
    const partial = getScore('mmse')!.compute({ orientationTime: 5 });
    expect(partial.incomplete).toBe(true);
  });

  it('MoCA : bonus « ≤ 12 ans d’études » plafonné à 30', () => {
    const capped = compute('moca', { visuospatial: 5, naming: 3, attention: 6, language: 3, abstraction: 2, recall: 5, orientation: 6, education: 1 });
    expect(capped.value).toBe(30);
    const mci = compute('moca', { visuospatial: 4, naming: 3, attention: 5, language: 3, abstraction: 1, recall: 2, orientation: 4, education: 0 });
    expect(mci.value).toBe(22);
    expect(mci.interpretation.level).toBe('moderate');
  });

  it('CAM : algorithme (1 ET 2) ET (3 OU 4)', () => {
    expect(compute('cam').display).toBe('Négatif');
    expect(compute('cam', { acuteFluctuating: 1, inattention: 1 }).display).toBe('Négatif');
    const pos = compute('cam', { acuteFluctuating: 1, inattention: 1, consciousness: 1 });
    expect(pos.display).toBe('Positif');
    expect(pos.interpretation.level).toBe('high');
  });

  it('Clinical Frailty Scale : ≥ 5 = fragilité', () => {
    expect(compute('clinical-frailty', { level: 2 }).interpretation.level).toBe('low');
    expect(compute('clinical-frailty', { level: 5 }).interpretation.level).toBe('high');
    expect(compute('clinical-frailty', { level: 8 }).interpretation.level).toBe('critical');
  });

  it('Timed Up and Go : < 12 s normal, ≥ 20 s risque élevé', () => {
    expect(compute('timed-up-and-go', { time: 8 }).interpretation.level).toBe('low');
    expect(compute('timed-up-and-go', { time: 15 }).interpretation.level).toBe('moderate');
    expect(compute('timed-up-and-go', { time: 25 }).interpretation.level).toBe('high');
  });

  it('Braden : défaut = risque minime ; tout minimal = risque très élevé', () => {
    expect(compute('braden').value).toBe(23);
    const highRisk = compute('braden', { sensory: 1, moisture: 1, activity: 1, mobility: 1, nutrition: 1, friction: 1 });
    expect(highRisk.value).toBe(6);
    expect(highRisk.interpretation.level).toBe('critical');
  });

  it('Charlson : pondérations (métastase = 6) et âge', () => {
    expect(compute('charlson').value).toBe(0);
    expect(compute('charlson', { metastasis: 6 }).value).toBe(6);
    const mixed = compute('charlson', { age: 2, mi: 1, chf: 1 });
    expect(mixed.value).toBe(4);
    expect(mixed.interpretation.level).toBe('high');
  });
});

describe('scores — nouveaux scores (autres domaines)', () => {
  it('SOFA : défaut 0 ; défaillance sévère', () => {
    expect(compute('sofa').value).toBe(0);
    const severe = compute('sofa', { respiration: 3, cardiovascular: 3, cns: 2, renal: 2 });
    expect(severe.value).toBe(10);
    expect(severe.interpretation.level).toBe('high');
  });

  it('SIRS : ≥ 2 critères', () => {
    expect(compute('sirs').interpretation.level).toBe('low');
    expect(compute('sirs', { temp: 1, hr: 1 }).interpretation.level).toBe('moderate');
  });

  it('HEART : 10 = élevé, 2 = faible, 6 = intermédiaire', () => {
    expect(compute('heart', { history: 2, ecg: 2, age: 2, riskFactors: 2, troponin: 2 }).interpretation.level).toBe('high');
    expect(compute('heart', { history: 1, age: 1 }).interpretation.level).toBe('low');
    expect(compute('heart', { history: 2, ecg: 1, age: 1, riskFactors: 1, troponin: 1 }).value).toBe(6);
  });

  it('CHADS₂ : ICC + HTA + AVC = 4 (élevé)', () => {
    const r = compute('chads2', { chf: 1, htn: 1, stroke: 2 });
    expect(r.value).toBe(4);
    expect(r.interpretation.level).toBe('high');
  });

  it('QTc Bazett : QT 400 ms à 75/min ≈ 447 ms (limite) ; ≥ 500 critique', () => {
    const r = compute('qtc-bazett', { qt: 400, hr: 75, sex: 0 });
    expect(r.value).toBeCloseTo(447.2, 0);
    expect(r.interpretation.level).toBe('moderate');
    expect(compute('qtc-bazett', { qt: 500, hr: 60, sex: 0 }).interpretation.level).toBe('critical');
  });

  it('Alvarado : sensibilité FID + hyperleucocytose = poids 2', () => {
    const r = compute('alvarado', { tenderness: 2, leukocytosis: 2, migration: 1, fever: 1, anorexia: 1 });
    expect(r.value).toBe(7);
    expect(r.interpretation.level).toBe('high');
  });

  it('Rockall : âge ≥ 80 + hypotension + comorbidités = 7 (élevé)', () => {
    const r = compute('rockall', { age: 2, shock: 2, comorbidity: 3 });
    expect(r.value).toBe(7);
    expect(r.interpretation.level).toBe('high');
  });

  it('FeUrée : Uurée 200, Purée 15, Ucréat 8000, Pcréat 180 = 30 % (fonctionnelle)', () => {
    const r = compute('feurea', { uUrea: 200, pUrea: 15, uCreat: 8000, pCreat: 180 });
    expect(r.value).toBeCloseTo(30, 5);
    expect(r.interpretation.level).toBe('moderate');
  });

  it('Winter : HCO₃ 12 → PaCO₂ attendue 26 mmHg', () => {
    const r = compute('winter', { bicarbonate: 12 });
    expect(r.value).toBe(26);
    const resp = getScore('winter')!.compute({ bicarbonate: 12, measuredPaco2: 35 });
    expect(resp.interpretation.label).toBe('Acidose respiratoire associée');
  });

  it('Light : ratio protéines pleural/sérique > 0,5 → exsudat', () => {
    const r = compute('light-criteria', { pleuralProtein: 40, serumProtein: 70, pleuralLdh: 150, serumLdh: 200, serumLdhUln: 250 });
    expect(r.display).toBe('Exsudat');
  });

  it('PERC : aucun critère = négatif ; un critère = positif', () => {
    expect(compute('perc').interpretation.label).toBe('PERC négatif');
    expect(compute('perc', { age: 1 }).interpretation.label).toBe('PERC positif');
  });

  it('STOP-BANG : ≥ 5 = risque élevé', () => {
    expect(compute('stop-bang', { snore: 1, tired: 1, observed: 1, pressure: 1, bmi: 1 }).interpretation.level).toBe('high');
  });

  it('Hunt & Hess / mRS / ICH', () => {
    expect(compute('hunt-hess', { grade: 4 }).interpretation.level).toBe('critical');
    expect(compute('rankin', { grade: 3 }).interpretation.level).toBe('high');
    expect(compute('ich-score', { gcs: 2, volume: 1, age: 1 }).value).toBe(4);
  });

  it('Mallampati / Aldrete', () => {
    expect(compute('mallampati', { class: 4 }).interpretation.level).toBe('high');
    expect(compute('aldrete').value).toBe(10); // défaut = tout au mieux
    expect(compute('aldrete', { activity: 0, respiration: 1, circulation: 1, consciousness: 1, saturation: 1 }).interpretation.level).toBe('high');
  });

  it('Fagerström : ≥ 5 = dépendance forte', () => {
    expect(compute('fagerstrom', { delay: 3, number: 3 }).interpretation.level).toBe('high');
  });
});

describe('scores — recherche gériatrie et nouveaux', () => {
  it('« G8 » et « oncogériatrie » retrouvent le G8', () => {
    expect(searchScores('G8').map((s) => s.id)).toContain('g8');
    expect(searchScores('oncogériatrie').map((s) => s.id)).toContain('g8');
  });

  it('« dépression sujet âgé » retrouve mini-GDS et GDS-15', () => {
    const ids = searchScores('dépression sujet âgé').map((s) => s.id);
    expect(ids).toContain('mini-gds');
    expect(ids).toContain('gds-15');
  });

  it('« mémoire démence » retrouve MMSE et MoCA', () => {
    const ids = searchScores('démence cognition').map((s) => s.id);
    expect(ids).toContain('mmse');
    expect(ids).toContain('moca');
  });

  it('« escarre » retrouve Braden ; « chute » retrouve le TUG', () => {
    expect(searchScores('escarre').map((s) => s.id)).toContain('braden');
    expect(searchScores('chute').map((s) => s.id)).toContain('timed-up-and-go');
  });

  it('la catégorie gériatrie contient au moins 12 scores', () => {
    expect(searchScores('', { category: 'geriatrie' }).length).toBeGreaterThanOrEqual(12);
  });
});
