import { describe, it, expect, vi } from 'vitest';

import {
  buildResearchTimeline,
  finalizeResearchTimeline,
  researchTimelineOfParts,
  matchArticleForSource,
  isVerifiedUrl,
  domainOfUrl,
  webSearchCallsOfStep,
  RESEARCH_DATA_PART_ID,
  type ResearchArticle,
  type ResearchEvent,
} from '@/ai/chat/researchTimeline';
import {
  europePmcHitCount,
  articlesFromEuropePmcResults,
  articleFromEuropePmcArticle,
  clinicalTrialsTotalCount,
  planResearchTool,
  formatPlanResearchResult,
} from '@/ai/chat/tools';
import { europePmcSearchTool, europePmcArticleTool } from '@/ai/chat/tools/europePmc';
import { verifySourceLinksTool } from '@/ai/chat/tools/verifyLinks';

const ARTICLE: ResearchArticle = {
  title: 'Apixaban in elderly patients with atrial fibrillation',
  journal: 'European Heart Journal',
  year: '2024',
  pubType: 'randomized controlled trial',
  citedByCount: 42,
  url: 'https://doi.org/10.1093/eurheartj/ehae176',
  doi: '10.1093/eurheartj/ehae176',
  pmid: '38000001',
};

// ── buildResearchTimeline ─────────────────────────────────────────────────────

describe('buildResearchTimeline — étapes et statuts', () => {
  it('phase analyzing : seule l’analyse est active, la rédaction à venir', () => {
    const t = buildResearchTimeline([], 'analyzing');
    expect(t.steps.map((s) => s.id)).toEqual(['analyze', 'write']);
    expect(t.steps[0].status).toBe('active');
    expect(t.steps[1].status).toBe('pending');
    expect(t.totalFound).toBeNull();
  });

  it('le plan fait apparaître l’étape concepts avec le nombre de requêtes et les chips', () => {
    const events: ResearchEvent[] = [
      { kind: 'plan', concepts: ['hyponatrémie', 'SIADH', 'spironolactone'], queries: ['q1', 'q2'] },
    ];
    const t = buildResearchTimeline(events, 'searching');
    const concepts = t.steps.find((s) => s.id === 'concepts');
    expect(concepts).toBeDefined();
    expect(concepts!.detail).toContain('2 requêtes');
    expect(concepts!.chips).toEqual(['hyponatrémie', 'SIADH', 'spironolactone']);
    expect(concepts!.status).toBe('active'); // dernier événement
    expect(t.steps.find((s) => s.id === 'analyze')!.status).toBe('done');
  });

  it('agrège les hitCounts en « publications identifiées » (le « 419 sources ») et les lectures', () => {
    const events: ResearchEvent[] = [
      { kind: 'plan', concepts: ['a'], queries: ['q1', 'q2'] },
      { kind: 'search', query: 'apixaban elderly', found: 400, articles: [ARTICLE] },
      { kind: 'search', query: 'af anticoagulation', found: 19 },
      { kind: 'web' },
      { kind: 'read', title: ARTICLE.title, article: ARTICLE },
    ];
    const t = buildResearchTimeline(events, 'searching');
    expect(t.totalFound).toBe(419);
    const search = t.steps.find((s) => s.id === 'search');
    expect(search!.detail).toContain('≈ 419 publications identifiées');
    expect(search!.detail).toContain('1 recherche web');
    expect(search!.chips).toEqual(['apixaban elderly', 'af anticoagulation']);
    const read = t.steps.find((s) => s.id === 'read');
    expect(read!.detail).toBe('1 résumé analysé');
    expect(read!.status).toBe('active');
    expect(search!.status).toBe('done');
    // L'article lu est marqué read et dédupliqué (recherche + lecture = 1 entrée).
    expect(t.articles).toHaveLength(1);
    expect(t.articles[0].read).toBe(true);
  });

  it('hitCount inconnu (échec réseau) → pas de chiffre inventé', () => {
    const t = buildResearchTimeline([{ kind: 'search', query: 'q', found: null }], 'searching');
    expect(t.totalFound).toBeNull();
    expect(t.steps.find((s) => s.id === 'search')!.detail).toBeNull();
  });

  it('la vérification expose x/y liens valides et les URLs OK', () => {
    const events: ResearchEvent[] = [
      { kind: 'verify', checked: 5, ok: 4, okUrls: ['https://a.fr', 'https://b.fr'] },
    ];
    const t = buildResearchTimeline(events, 'searching');
    expect(t.steps.find((s) => s.id === 'verify')!.detail).toBe('4/5 liens valides');
    expect(t.verifiedUrls).toEqual(['https://a.fr', 'https://b.fr']);
  });

  it('phase writing : tout est fait sauf la rédaction (active) ; done : tout est fait', () => {
    const events: ResearchEvent[] = [{ kind: 'search', query: 'q', found: 3 }];
    const writing = buildResearchTimeline(events, 'writing');
    expect(writing.steps.find((s) => s.id === 'write')!.status).toBe('active');
    expect(writing.steps.filter((s) => s.id !== 'write').every((s) => s.status === 'done')).toBe(true);

    const done = finalizeResearchTimeline(writing);
    expect(done.phase).toBe('done');
    expect(done.steps.every((s) => s.status === 'done')).toBe(true);
  });

  it('essais cliniques et PubMed n’apparaissent que s’ils ont eu lieu', () => {
    const none = buildResearchTimeline([{ kind: 'search', query: 'q', found: 1 }], 'searching');
    expect(none.steps.map((s) => s.id)).not.toContain('trials');
    expect(none.steps.map((s) => s.id)).not.toContain('pubmed');

    const t = buildResearchTimeline(
      [
        { kind: 'trials', query: 'sglt2 heart failure', found: 12 },
        { kind: 'pubmed' },
      ],
      'searching',
    );
    expect(t.steps.find((s) => s.id === 'trials')!.detail).toContain('12 essais');
    expect(t.steps.map((s) => s.id)).toContain('pubmed');
  });
});

// ── Extraction côté client ────────────────────────────────────────────────────

describe('researchTimelineOfParts — data part du message assistant', () => {
  it('retrouve la DERNIÈRE data part timeline, défensif sur la forme', () => {
    const t1 = buildResearchTimeline([], 'analyzing');
    const t2 = buildResearchTimeline([{ kind: 'search', query: 'q', found: 7 }], 'searching');
    const parts = [
      { type: 'step-start' },
      { type: 'data-research', id: RESEARCH_DATA_PART_ID, data: t1 },
      { type: 'text', text: '…' },
      { type: 'data-research', id: RESEARCH_DATA_PART_ID, data: t2 },
    ];
    expect(researchTimelineOfParts(parts)?.totalFound).toBe(7);
  });

  it('null si absent ou malformé', () => {
    expect(researchTimelineOfParts(undefined)).toBeNull();
    expect(researchTimelineOfParts([{ type: 'text', text: 'x' }])).toBeNull();
    expect(researchTimelineOfParts([{ type: 'data-research', data: { steps: 'nope' } }])).toBeNull();
    expect(researchTimelineOfParts([null, 42, 'x'])).toBeNull();
  });
});

// ── Enrichissement des fiches sources ─────────────────────────────────────────

describe('matchArticleForSource / isVerifiedUrl / domainOfUrl', () => {
  it('rapproche par URL exacte, DOI ou PMID — jamais par à-peu-près', () => {
    const byUrl = matchArticleForSource({ url: 'https://doi.org/10.1093/eurheartj/ehae176/' }, [ARTICLE]);
    expect(byUrl).toBe(ARTICLE);
    const byPmid = matchArticleForSource(
      { url: 'https://pubmed.ncbi.nlm.nih.gov/38000001/' },
      [ARTICLE],
    );
    expect(byPmid).toBe(ARTICLE);
    expect(matchArticleForSource({ url: 'https://www.has-sante.fr/reco' }, [ARTICLE])).toBeNull();
    expect(matchArticleForSource({ url: null }, [ARTICLE])).toBeNull();
    expect(matchArticleForSource(null, [ARTICLE])).toBeNull();
  });

  it('isVerifiedUrl : correspondance insensible au slash final et à la casse', () => {
    expect(isVerifiedUrl('https://www.HAS-sante.fr/reco/', ['https://www.has-sante.fr/reco'])).toBe(true);
    expect(isVerifiedUrl('https://autre.fr', ['https://www.has-sante.fr/reco'])).toBe(false);
    expect(isVerifiedUrl(null, ['https://a.fr'])).toBe(false);
    expect(isVerifiedUrl('https://a.fr', null)).toBe(false);
  });

  it('domainOfUrl : domaine lisible sans www, null si invalide', () => {
    expect(domainOfUrl('https://www.has-sante.fr/jcms/p_1')).toBe('has-sante.fr');
    expect(domainOfUrl('pas une url')).toBeNull();
    expect(domainOfUrl(null)).toBeNull();
  });
});

// ── Recherches web provider (steps) ───────────────────────────────────────────

describe('webSearchCallsOfStep — outils exécutés par le provider', () => {
  it('compte web_search/google_search depuis toolCalls ou le contenu de l’étape', () => {
    expect(webSearchCallsOfStep({ toolCalls: [{ toolName: 'web_search' }, { toolName: 'europe_pmc_search' }] })).toBe(1);
    expect(
      webSearchCallsOfStep({
        content: [
          { type: 'tool-call', toolName: 'google_search' },
          { type: 'tool-call', toolName: 'google_search' },
          { type: 'text', text: 'x' },
        ],
      }),
    ).toBe(2);
    expect(webSearchCallsOfStep({})).toBe(0);
    expect(webSearchCallsOfStep(null)).toBe(0);
  });
});

// ── Compteurs réels extraits des réponses API ─────────────────────────────────

describe('hitCount / totalCount / métadonnées d’articles', () => {
  it('europePmcHitCount lit le total réel, défensif', () => {
    expect(europePmcHitCount({ hitCount: 419 })).toBe(419);
    expect(europePmcHitCount({ hitCount: -1 })).toBeNull();
    expect(europePmcHitCount({})).toBeNull();
    expect(europePmcHitCount(null)).toBeNull();
  });

  it('clinicalTrialsTotalCount lit le total réel, défensif', () => {
    expect(clinicalTrialsTotalCount({ totalCount: 12 })).toBe(12);
    expect(clinicalTrialsTotalCount({})).toBeNull();
    expect(clinicalTrialsTotalCount(null)).toBeNull();
  });

  it('articlesFromEuropePmcResults extrait les métadonnées réelles (URL DOI en tête)', () => {
    const json = {
      hitCount: 2,
      resultList: {
        result: [
          {
            title: 'Titre A.',
            journalTitle: 'EHJ',
            pubYear: '2024',
            pubType: 'review',
            citedByCount: 7,
            doi: '10.1/abc',
            pmid: '1',
          },
          { abstractText: 'sans titre → ignoré' },
        ],
      },
    };
    const arts = articlesFromEuropePmcResults(json);
    expect(arts).toHaveLength(1);
    expect(arts[0]).toMatchObject({
      title: 'Titre A',
      journal: 'EHJ',
      year: '2024',
      pubType: 'review',
      citedByCount: 7,
      url: 'https://doi.org/10.1/abc',
    });
    expect(articlesFromEuropePmcResults(null)).toEqual([]);
  });

  it('articleFromEuropePmcArticle couvre les deux formes de réponse', () => {
    expect(articleFromEuropePmcArticle({ result: { title: 'X', pmid: '9' } })?.pmid).toBe('9');
    expect(
      articleFromEuropePmcArticle({ resultList: { result: [{ title: 'Y', doi: '10.2/z' }] } })?.doi,
    ).toBe('10.2/z');
    expect(articleFromEuropePmcArticle({})).toBeNull();
  });
});

// ── Hooks d'événements des outils ─────────────────────────────────────────────

const toolCtx = { toolCallId: 't', messages: [] } as never;

describe('hooks onEvent des outils — événements réels vers la timeline', () => {
  it('plan_research émet le plan et confirme sans réseau', async () => {
    const events: ResearchEvent[] = [];
    const tool = planResearchTool((e) => events.push(e));
    const out = (await tool.execute!(
      { concepts: ['SIADH', 'natrémie'], queries: ['siadh spironolactone sodium'] },
      toolCtx,
    )) as string;
    expect(events).toEqual([
      { kind: 'plan', concepts: ['SIADH', 'natrémie'], queries: ['siadh spironolactone sodium'] },
    ]);
    expect(out).toContain('Plan enregistré');
    expect(formatPlanResearchResult(['a'], ['b'])).toContain('1 concept');
  });

  it('europe_pmc_search émet requête + hitCount + articles ; found null en échec', async () => {
    const events: ResearchEvent[] = [];
    const okJson = {
      hitCount: 419,
      resultList: { result: [{ title: 'T', pmid: '1' }] },
    };
    const okFetch = vi.fn(async () => new Response(JSON.stringify(okJson), { status: 200 }));
    await europePmcSearchTool(okFetch as unknown as typeof fetch, (e) => events.push(e)).execute!(
      { query: 'apixaban elderly' },
      toolCtx,
    );
    expect(events[0]).toMatchObject({ kind: 'search', query: 'apixaban elderly', found: 419 });

    const koFetch = vi.fn(async () => new Response('down', { status: 503 }));
    await europePmcSearchTool(koFetch as unknown as typeof fetch, (e) => events.push(e)).execute!(
      { query: 'q2' },
      toolCtx,
    );
    expect(events[1]).toMatchObject({ kind: 'search', query: 'q2', found: null });
  });

  it('europe_pmc_article émet la lecture avec le titre affichable', async () => {
    const events: ResearchEvent[] = [];
    const json = { result: { title: 'Titre lu', pmid: '38000001', abstractText: 'abc' } };
    const okFetch = vi.fn(async () => new Response(JSON.stringify(json), { status: 200 }));
    await europePmcArticleTool(okFetch as unknown as typeof fetch, (e) => events.push(e)).execute!(
      { id: '38000001', title: 'Titre du résultat' },
      toolCtx,
    );
    expect(events[0]).toMatchObject({ kind: 'read', title: 'Titre du résultat' });
    expect((events[0] as { article?: { pmid?: string } }).article?.pmid).toBe('38000001');
  });

  it('verify_source_links émet checked/ok et les URLs valides (URL finale incluse si redirigée)', async () => {
    const events: ResearchEvent[] = [];
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('cassee')
        ? new Response('', { status: 404 })
        : new Response('', { status: 200 }),
    );
    await verifySourceLinksTool(fetchImpl as unknown as typeof fetch, (e) => events.push(e)).execute!(
      { urls: ['https://www.has-sante.fr/ok', 'https://www.esc.org/cassee'] },
      toolCtx,
    );
    expect(events).toHaveLength(1);
    const v = events[0] as Extract<ResearchEvent, { kind: 'verify' }>;
    expect(v.checked).toBe(2);
    expect(v.ok).toBe(1);
    expect(v.okUrls).toContain('https://www.has-sante.fr/ok');
  });
});
