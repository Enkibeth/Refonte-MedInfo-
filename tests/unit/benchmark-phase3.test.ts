// Tests Phase 3 du benchmark (pilote, anonymisation aveugle, accord inter-évaluateurs,
// calibration juge↔humain). Importe les modules ESM .mjs (vitest gère l'ESM).
// Aucun appel réseau : tout est pur / déterministe.

import { describe, expect, it } from 'vitest';

import { cohenKappa, pearson, agreementStrength, linearBias } from '../../scripts/eval/lib/agreement.mjs';
import { stratifiedSample } from '../../scripts/eval/lib/sampling.mjs';
import { buildAnonymized } from '../../scripts/eval/benchmark-anonymize.mjs';
import { computeAgreement } from '../../scripts/eval/benchmark-agreement.mjs';
import { validateLock } from '../../scripts/eval/benchmark-preflight.mjs';

describe('agreement — κ de Cohen', () => {
  it('accord parfait → κ = 1', () => {
    const a = ['1', '0', '1', '0', '1'];
    const b = ['1', '0', '1', '0', '1'];
    expect(cohenKappa(a, b)).toBe(1);
  });

  it('deux annotateurs systématiquement opposés → κ < 0', () => {
    const a = ['1', '0', '1', '0', '1', '0'];
    const b = ['0', '1', '0', '1', '0', '1'];
    expect(cohenKappa(a, b)).toBeLessThan(0);
  });

  it('cas chiffré reproductible (po=0,7 ; pe=0,5 → κ=0,4)', () => {
    // 10 items. Marges A = 5/5, B = 5/5. Accord observé = 7/10.
    // A: 1 1 1 1 1 0 0 0 0 0
    // B: 1 1 1 1 0 0 0 0 1 1  → coïncident sur idx 0-3 (1=1) et 5-7 (0=0) = 7 accords.
    const a = ['1', '1', '1', '1', '1', '0', '0', '0', '0', '0'];
    const b = ['1', '1', '1', '1', '0', '0', '0', '0', '1', '1'];
    // po = 0,7 ; pe = 0,5*0,5 + 0,5*0,5 = 0,5 ; κ = (0,7−0,5)/(1−0,5) = 0,4.
    expect(cohenKappa(a, b)).toBeCloseTo(0.4, 10);
  });

  it('accord = hasard → κ ≈ 0', () => {
    // Marges égales, accord observé == accord attendu.
    const a = ['x', 'y', 'x', 'y'];
    const b = ['x', 'y', 'y', 'x']; // po = 0,5 ; pe = 0,5 → κ = 0
    expect(cohenKappa(a, b)).toBeCloseTo(0, 10);
  });

  it('un seul label des deux côtés (marge dégénérée) → κ = 1 si accord total', () => {
    expect(cohenKappa(['0', '0', '0'], ['0', '0', '0'])).toBe(1);
  });

  it('rejette des longueurs différentes', () => {
    expect(() => cohenKappa(['1'], ['1', '0'])).toThrow();
  });
});

describe('agreement — Pearson / strength / bias', () => {
  it('corrélation parfaite positive sur une série connue → r = 1', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10]; // y = 2x
    expect(pearson(x, y)).toBeCloseTo(1, 10);
  });

  it('corrélation parfaite négative → r = −1', () => {
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 10);
  });

  it('série constante → r = 0 (variance nulle)', () => {
    expect(pearson([5, 5, 5], [1, 2, 3])).toBe(0);
  });

  it('agreementStrength suit Landis & Koch', () => {
    expect(agreementStrength(1)).toContain('parfait');
    expect(agreementStrength(0.7)).toBe('fort');
    expect(agreementStrength(0.5)).toBe('modéré');
    expect(agreementStrength(-0.1)).toContain('désaccord');
  });

  it('linearBias mesure le décalage moyen signé (juge − humain)', () => {
    expect(linearBias([12, 13, 11], [10, 10, 10])).toBeCloseTo(2, 10);
    expect(linearBias([8, 9], [10, 11])).toBeCloseTo(-2, 10);
  });
});

describe('sampling — stratifiedSample', () => {
  // Population : 20 items, 2 dimensions (D1 ×12, D2 ×8).
  const population = Array.from({ length: 20 }, (_, i) => ({
    id: `Q${String(i + 1).padStart(2, '0')}`,
    dimension: i < 12 ? 'D1' : 'D2',
  }));

  it('déterminisme : même seed → même échantillon', () => {
    const a = stratifiedSample(population, { n: 10, strata: ['dimension'], seed: 42 });
    const b = stratifiedSample(population, { n: 10, strata: ['dimension'], seed: 42 });
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it('seed différent → échantillon (probablement) différent mais même taille', () => {
    const a = stratifiedSample(population, { n: 10, strata: ['dimension'], seed: 1 });
    const c = stratifiedSample(population, { n: 10, strata: ['dimension'], seed: 999 });
    expect(a).toHaveLength(10);
    expect(c).toHaveLength(10);
  });

  it('n correct et proportions de strate respectées', () => {
    const sample = stratifiedSample(population, { n: 10, strata: ['dimension'], seed: 7 });
    expect(sample).toHaveLength(10);
    const d1 = sample.filter((x) => x.dimension === 'D1').length;
    const d2 = sample.filter((x) => x.dimension === 'D2').length;
    // Proportion attendue : D1 = round(10*12/20)=6, D2 = round(10*8/20)=4.
    expect(d1).toBe(6);
    expect(d2).toBe(4);
  });

  it('n ≥ population → renvoie toute la population', () => {
    const sample = stratifiedSample(population, { n: 50, strata: ['dimension'], seed: 1 });
    expect(sample).toHaveLength(20);
  });

  it('seed string accepté (hashSeed) et déterministe', () => {
    const a = stratifiedSample(population, { n: 6, strata: ['dimension'], seed: 'pilote' });
    const b = stratifiedSample(population, { n: 6, strata: ['dimension'], seed: 'pilote' });
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(a).toHaveLength(6);
  });
});

describe('anonymize — round-trip scellage/dé-scellage', () => {
  const rows = [
    { model: 'medinfo', model_version: 'medinfo-public-v2.0.0-stub', mode: 'rag', run_id: 'r1', run_index: '1', question_id: 'SAFE-001', safebox_action_attendue: 'refus_canonique', commentaire: JSON.stringify({ reponse_modele: 'Texte de refus canonique.' }) },
    { model: 'openai', model_version: 'openai-stub', mode: 'base', run_id: 'r1', run_index: '1', question_id: 'SAFE-001', safebox_action_attendue: 'refus_canonique', commentaire: JSON.stringify({ reponse_modele: 'Première réponse simulée.' }) },
    { model: 'anthropic', model_version: 'anthropic-stub', mode: 'base', run_id: 'r1', run_index: '1', question_id: 'PUB-001', safebox_action_attendue: '', commentaire: JSON.stringify({ reponse_modele: 'Seconde réponse simulée.' }) },
  ];

  it('la clé scellée permet de retrouver le modèle depuis blind_label, et le paquet ne révèle pas le modèle', () => {
    const { records, sealing } = buildAnonymized(rows, 'seed-test') as {
      records: Array<{ blind_label: string }>;
      sealing: Record<string, { model: string }>;
    };
    expect(records).toHaveLength(3);

    // Aucun champ du record ne doit révéler l'identité du modèle.
    for (const r of records) {
      const serialized = JSON.stringify(r).toLowerCase();
      expect(serialized).not.toContain('medinfo');
      expect(serialized).not.toContain('openai');
      expect(serialized).not.toContain('anthropic');
      // Mais l'étiquette aveugle dé-scelle bien vers le bon modèle.
      expect(sealing[r.blind_label]).toBeDefined();
    }

    // Round-trip : chaque blind_label → modèle d'origine.
    const labels = records.map((r) => r.blind_label);
    expect(new Set(labels).size).toBe(3); // étiquettes uniques
    const models = labels.map((l) => sealing[l].model).sort();
    expect(models).toEqual(['anthropic', 'medinfo', 'openai']);
  });

  it('le scellage est déterministe pour un même seed', () => {
    const a = buildAnonymized(rows, 'seed-test');
    const b = buildAnonymized(rows, 'seed-test');
    expect(a.records.map((r) => r.blind_label)).toEqual(b.records.map((r) => r.blind_label));
  });
});

describe('agreement — détection des désaccords', () => {
  function packetPair(overrides: Array<{ a: Record<string, string>; b: Record<string, string> }>) {
    const base = (i: number) => ({
      blind_label: `REP-${i}`,
      question_id: `Q${i}`,
      total_100: '80',
      safebox_classement: 'reponse_correcte',
      flag_source_inventee: '0',
      flag_diagnostic_individualise: '0',
      flag_posologie_dangereuse: '0',
      flag_urgence_ratee: '0',
      flag_reco_therapeutique_perso: '0',
      flag_contredit_reco_officielle: '0',
    });
    return overrides.map((o, i) => ({
      label: `REP-${i}`,
      a: { ...base(i), ...o.a },
      b: { ...base(i), ...o.b },
    }));
  }

  it('flagge un écart total > 15 pts', () => {
    const pairs = packetPair([
      { a: { total_100: '90' }, b: { total_100: '70' } }, // écart 20 → désaccord
      { a: { total_100: '80' }, b: { total_100: '75' } }, // écart 5 → ok
    ]);
    const res = computeAgreement(pairs);
    expect(res.disagreements).toHaveLength(1);
    expect(res.disagreements[0].blind_label).toBe('REP-0');
    expect(res.disagreements[0].reasons.join()).toContain('écart total');
  });

  it('flagge une divergence sur un flag éliminatoire et sur le classement safe-box', () => {
    const pairs = packetPair([
      { a: { flag_urgence_ratee: '1' }, b: { flag_urgence_ratee: '0' } },
      { a: { safebox_classement: 'refus_correct' }, b: { safebox_classement: 'faux_negatif' } },
    ]);
    const res = computeAgreement(pairs);
    expect(res.disagreements).toHaveLength(2);
    expect(res.disagreements.map((d) => d.reasons.join()).join()).toContain('flag_urgence_ratee');
    expect(res.disagreements.map((d) => d.reasons.join()).join()).toContain('safebox_classement');
  });

  it('κ parfait quand A et B sont identiques (pas de breach sûreté)', () => {
    const pairs = packetPair([
      { a: { flag_urgence_ratee: '1' }, b: { flag_urgence_ratee: '1' } },
      { a: { flag_urgence_ratee: '0' }, b: { flag_urgence_ratee: '0' } },
    ]);
    const res = computeAgreement(pairs) as unknown as {
      kappas: Record<string, { kappa: number }>;
      safetyBreaches: unknown[];
    };
    expect(res.kappas.flag_urgence_ratee.kappa).toBe(1);
    expect(res.safetyBreaches).toHaveLength(0);
  });
});

describe('preflight — validateLock', () => {
  const keyPresent = (fam: string) => fam === 'openai' || fam === 'anthropic';

  it('offline : structure valide, medinfo signalé en stub (warning), pas d\'erreur bloquante', () => {
    const lock = {
      models: [
        { name: 'MedInfo', provider: 'medinfo', model_id_exact: 'medinfo-public-v2.0.0-stub', date_figee: '____', mode: 'base' },
        { name: 'OpenAI', provider: 'openai', model_id_exact: '____', date_figee: '____', mode: 'base' },
      ],
    };
    const res = validateLock(lock, { live: false, keyPresent });
    expect(res.ok).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('live : refuse un id non figé et refuse medinfo stub', () => {
    const lock = {
      models: [
        { name: 'MedInfo', provider: 'medinfo', model_id_exact: 'medinfo-public-v2.0.0-stub', date_figee: '2026-06-15', mode: 'base' },
        { name: 'OpenAI', provider: 'openai', model_id_exact: '____', date_figee: '2026-06-15', mode: 'base' },
      ],
    };
    const res = validateLock(lock, { live: true, keyPresent });
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toContain('medinfo');
    expect(res.errors.join()).toContain('non figé');
  });

  it('live : OK quand les versions sont figées, datées et les clés présentes', () => {
    const lock = {
      models: [
        { name: 'OpenAI', provider: 'openai', model_id_exact: 'gpt-4o-2024-08-06', date_figee: '2026-06-15', mode: 'base' },
        { name: 'Claude', provider: 'anthropic', model_id_exact: 'claude-sonnet-4-5-20250929', date_figee: '2026-06-15', mode: 'base' },
      ],
    };
    const res = validateLock(lock, { live: true, keyPresent });
    expect(res.ok).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('structure invalide → ok=false', () => {
    expect(validateLock({}, { live: false, keyPresent }).ok).toBe(false);
    expect(validateLock(null as unknown as object, { live: false, keyPresent }).ok).toBe(false);
  });
});
