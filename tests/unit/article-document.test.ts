import { describe, it, expect } from 'vitest';

import {
  MAX_ARTICLE_JSON_CHARS,
  buildAiSectionContext,
  citationOrder,
  coerceArticleId,
  coerceDocType,
  countText,
  formatReferenceApa,
  formatReferenceVancouver,
  parseOriginalityReport,
  renderCitations,
  sanitizeArticlePayload,
} from '@/article/articleDocument';

describe('coerceArticleId', () => {
  it('accepte un uuid valide', () => {
    expect(coerceArticleId('123e4567-e89b-42d3-a456-426614174000')).toBe(
      '123e4567-e89b-42d3-a456-426614174000',
    );
  });
  it('rejette tout le reste (injection, nombre, null)', () => {
    expect(coerceArticleId('abc')).toBeNull();
    expect(coerceArticleId(42)).toBeNull();
    expect(coerceArticleId(null)).toBeNull();
    expect(coerceArticleId("1; drop table article_documents;--")).toBeNull();
  });
});

describe('coerceDocType', () => {
  it('accepte les types connus et retombe sur original sinon', () => {
    expect(coerceDocType('thesis')).toBe('thesis');
    expect(coerceDocType('abstract')).toBe('abstract');
    expect(coerceDocType('n-importe-quoi')).toBe('original');
    expect(coerceDocType(undefined)).toBe('original');
  });
});

describe('sanitizeArticlePayload', () => {
  it('refuse un document absent ou non-objet', () => {
    expect(sanitizeArticlePayload({}).ok).toBe(false);
    expect(sanitizeArticlePayload({ document: 'texte' }).ok).toBe(false);
    expect(sanitizeArticlePayload({ document: [1, 2] }).ok).toBe(false);
  });

  it('refuse un document trop volumineux', () => {
    const big = { blob: 'x'.repeat(MAX_ARTICLE_JSON_CHARS + 10) };
    expect(sanitizeArticlePayload({ document: big }).ok).toBe(false);
  });

  it('dérive le titre depuis meta.title si absent, avec repli neutre', () => {
    const r1 = sanitizeArticlePayload({
      document: { meta: { title: '  Pronostic des SCA ST+  ', docType: 'abstract' } },
    });
    expect(r1).toMatchObject({
      ok: true,
      value: { title: 'Pronostic des SCA ST+', docType: 'abstract' },
    });

    const r2 = sanitizeArticlePayload({ document: { sections: [] } });
    expect(r2).toMatchObject({ ok: true, value: { title: 'Article sans titre', docType: 'original' } });
  });

  it('le titre explicite du payload prime et est borné/normalisé', () => {
    const r = sanitizeArticlePayload({
      title: '  Mon    étude \n cas-témoins  ',
      docType: 'review',
      document: { meta: { title: 'autre' } },
    });
    expect(r).toMatchObject({ ok: true, value: { title: 'Mon étude cas-témoins', docType: 'review' } });
  });
});

describe('countText — référence du comptage (miroir dans public/article.html)', () => {
  it('compte caractères avec/sans espaces et mots', () => {
    expect(countText('Infarctus du myocarde')).toEqual({
      withSpaces: 21,
      withoutSpaces: 19,
      words: 3,
    });
  });

  it('normalise les fins de ligne CRLF (comptage stable Windows/Mac)', () => {
    expect(countText('a\r\nb')).toEqual({ withSpaces: 3, withoutSpaces: 2, words: 2 });
  });

  it('texte vide ou non-string → zéros', () => {
    expect(countText('')).toEqual({ withSpaces: 0, withoutSpaces: 0, words: 0 });
    expect(countText(undefined)).toEqual({ withSpaces: 0, withoutSpaces: 0, words: 0 });
    expect(countText('   ')).toEqual({ withSpaces: 3, withoutSpaces: 0, words: 0 });
  });
});

describe('citations [@id] → [n] (ordre d’apparition, style Vancouver)', () => {
  const sections = [
    'Contexte [@rev2020]. Objectif [@essai2023] et encore [@rev2020].',
    'Méthodes [@cohorte] puis [@inconnu].',
  ];
  const known = ['essai2023', 'rev2020', 'cohorte', 'jamais-cite'];

  it('numérote dans l’ordre de première apparition, sans doublon', () => {
    const order = citationOrder(sections, known);
    expect(order.ordered).toEqual(['rev2020', 'essai2023', 'cohorte']);
    expect(order.unknown).toEqual(['inconnu']);
    expect(order.uncited).toEqual(['jamais-cite']);
  });

  it('rend [n] pour les connus et [?] pour les inconnus', () => {
    const { ordered } = citationOrder(sections, known);
    expect(renderCitations(sections[0], ordered)).toBe('Contexte [1]. Objectif [2] et encore [1].');
    expect(renderCitations(sections[1], ordered)).toBe('Méthodes [3] puis [?].');
  });

  it('sections vides et texte sans citation passent sans bruit', () => {
    const order = citationOrder([undefined, 'texte sans appel'], ['a']);
    expect(order).toEqual({ ordered: [], unknown: [], uncited: ['a'] });
  });
});

describe('formatage des références', () => {
  const ref = {
    id: 'essai2023',
    authors: ['Dupont J', 'Martin A', 'Nguyen T'],
    title: 'Early invasive strategy in elderly patients with NSTEMI',
    journal: 'Eur Heart J',
    year: '2023',
    volume: '44',
    issue: '12',
    pages: '1021-1030',
    doi: '10.1000/ehj.2023.1021',
  };

  it('Vancouver : auteurs. Titre. Journal. Année;Vol(Num):Pages. doi:', () => {
    expect(formatReferenceVancouver(ref)).toBe(
      'Dupont J, Martin A, Nguyen T. Early invasive strategy in elderly patients with NSTEMI. ' +
        'Eur Heart J. 2023;44(12):1021-1030. doi:10.1000/ehj.2023.1021',
    );
  });

  it('Vancouver : plus de 6 auteurs → « et al. »', () => {
    const many = { ...ref, authors: ['A A', 'B B', 'C C', 'D D', 'E E', 'F F', 'G G'] };
    expect(formatReferenceVancouver(many)).toContain('A A, B B, C C, D D, E E, F F, et al.');
  });

  it('Vancouver : référence minimale (titre + url) reste propre', () => {
    expect(
      formatReferenceVancouver({ id: 'x', title: 'Recommandation HAS 2024', url: 'https://has-sante.fr/x' }),
    ).toBe('Recommandation HAS 2024. https://has-sante.fr/x');
  });

  it('APA : Auteurs (année). Titre. Journal, Vol(Num), pages. doi url', () => {
    expect(formatReferenceApa(ref)).toBe(
      'Dupont J, Martin A & Nguyen T (2023). Early invasive strategy in elderly patients with NSTEMI. ' +
        'Eur Heart J, 44(12), 1021-1030. https://doi.org/10.1000/ehj.2023.1021',
    );
  });
});

describe('buildAiSectionContext — minimisation avant envoi IA', () => {
  const document = {
    meta: { title: 'Pronostic des SCA', docType: 'original', targetJournal: 'Archives des maladies du cœur', authors: 'C. Doré' },
    sections: [
      { id: 's1', title: 'Introduction', content: 'Contexte [@rev2020].' },
      { id: 's2', title: 'Méthodes', content: 'Étude rétrospective [@cohorte].' },
    ],
    references: [
      { id: 'rev2020', title: 'Revue 2020' },
      { id: 'cohorte', title: 'Cohorte 2021' },
    ],
  };

  it('renvoie plan + section ciblée avec citations rendues [n]', () => {
    const ctx = buildAiSectionContext(document, 's2');
    expect(ctx).not.toBeNull();
    expect(ctx!.outline).toEqual(['Introduction', 'Méthodes']);
    expect(ctx!.sectionTitle).toBe('Méthodes');
    expect(ctx!.text).toBe('Étude rétrospective [2].');
    expect(ctx!.meta.targetJournal).toBe('Archives des maladies du cœur');
    // Minimisation : les auteurs ne font pas partie du contexte envoyé.
    expect(JSON.stringify(ctx)).not.toContain('Doré');
  });

  it('section inconnue → null (le serveur refuse proprement)', () => {
    expect(buildAiSectionContext(document, 'zzz')).toBeNull();
    expect(buildAiSectionContext(null, 's1')).toBeNull();
  });
});

describe('parseOriginalityReport — parseur tolérant mais fail-closed', () => {
  it('parse un rapport JSON propre', () => {
    const rep = parseOriginalityReport(
      JSON.stringify({
        verdict: 'attention',
        riskScore: 42,
        summary: 'Deux passages proches de sources publiées.',
        findings: [
          {
            passage: 'texte suspect',
            concern: 'formulation quasi identique',
            sourceTitle: 'Article X',
            sourceUrl: 'https://exemple.org/article-x',
            suggestion: 'reformuler en citant',
          },
        ],
      }),
    );
    expect(rep).not.toBeNull();
    expect(rep!.verdict).toBe('attention');
    expect(rep!.riskScore).toBe(42);
    expect(rep!.findings).toHaveLength(1);
    expect(rep!.findings[0].sourceUrl).toBe('https://exemple.org/article-x');
  });

  it('tolère les balises de code et du texte autour', () => {
    const raw = '```json\n{"verdict":"ok","riskScore":3,"summary":"RAS","findings":[]}\n```';
    expect(parseOriginalityReport(raw)?.verdict).toBe('ok');
  });

  it('verdict absent ou inconnu → null (jamais un faux « tout va bien »)', () => {
    expect(parseOriginalityReport('{"riskScore":10}')).toBeNull();
    expect(parseOriginalityReport('{"verdict":"super"}')).toBeNull();
    expect(parseOriginalityReport('pas du json')).toBeNull();
  });

  it('borne le score dans [0,100] et filtre les URLs non http(s)', () => {
    const rep = parseOriginalityReport(
      JSON.stringify({
        verdict: 'risque',
        riskScore: 250,
        summary: 's',
        findings: [{ passage: 'p', concern: 'c', sourceUrl: 'javascript:alert(1)' }],
      }),
    );
    expect(rep!.riskScore).toBe(100);
    expect(rep!.findings[0].sourceUrl).toBeUndefined();
  });
});
