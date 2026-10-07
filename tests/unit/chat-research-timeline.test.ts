import { describe, expect, it } from 'vitest';

import {
  buildResearchTimeline,
  cleanSourceUrl,
  domainOf,
  hasResearchTrace,
  reasoningHeadline,
  researchSummaryLine,
} from '@/ai/chat/researchTimeline';

// Forme RÉELLE des parts produites par gpt-6-luna + recherche web OpenAI (relevée en
// 2026-10 sur l'API) : la requête n'est connue qu'à `output-available`, jamais en entrée.
const searchDone = (query: string, queries: string[], urls: string[]) => ({
  type: 'tool-web_search',
  state: 'output-available',
  input: {},
  output: { action: { type: 'search', query, queries }, sources: urls.map((url) => ({ type: 'url', url })) },
});

describe('buildResearchTimeline — déroulé réel, jamais supposé', () => {
  it('avant tout événement : une seule étape active, l’analyse de la question', () => {
    const view = buildResearchTimeline([]);
    expect(view.steps).toHaveLength(1);
    expect(view.steps[0]).toMatchObject({ kind: 'analyze', status: 'active', title: 'Analyse de la question' });
    expect(buildResearchTimeline(undefined).steps).toHaveLength(1);
  });

  it('le résumé de réflexion donne son titre à l’étape d’analyse', () => {
    const view = buildResearchTimeline([
      { type: 'reasoning', state: 'streaming', text: '**Searching medical sources**\n\nI need to check ESC.' },
    ]);
    expect(view.steps).toHaveLength(1);
    expect(view.steps[0]).toMatchObject({ kind: 'analyze', status: 'active', detail: 'Searching medical sources' });
  });

  it('recherche en cours : libellé générique (la requête n’est pas encore connue)', () => {
    const view = buildResearchTimeline([{ type: 'tool-web_search', state: 'input-available', input: {} }]);
    expect(view.steps.map((s) => [s.kind, s.status])).toEqual([
      ['analyze', 'done'],
      ['search', 'active'],
    ]);
    expect(view.steps[1].queries).toEqual([]);
    expect(view.searchCount).toBe(0);
  });

  it('recherche terminée : requêtes exactes dédoublonnées et pages consultées par domaine', () => {
    const view = buildResearchTimeline([
      { type: 'reasoning', state: 'done', text: '**Searching medical sources**' },
      searchDone('ESC 2023 dapagliflozin dose', ['ESC 2023 dapagliflozin dose', 'dapagliflozin 10 mg HF'], [
        'https://www.escardio.org/Guidelines?utm_source=openai',
        'https://academic.oup.com/eurheartj/article/44/37/3627/7246292',
        'https://academic.oup.com/eurheartj/article/44/37/3627/7246292',
        'javascript:alert(1)',
      ]),
    ]);
    const search = view.steps.find((s) => s.kind === 'search')!;
    expect(search.status).toBe('done');
    expect(search.queries).toEqual(['ESC 2023 dapagliflozin dose', 'dapagliflozin 10 mg HF']);
    expect(search.sources).toEqual([
      { url: 'https://www.escardio.org/Guidelines', domain: 'escardio.org' },
      { url: 'https://academic.oup.com/eurheartj/article/44/37/3627/7246292', domain: 'academic.oup.com' },
    ]);
    expect(view.searchCount).toBe(1);
    expect(view.sourceCount).toBe(2);
    // Le modèle travaille encore sans rien émettre : jamais d'écran figé.
    expect(view.steps.at(-1)).toMatchObject({ status: 'active', title: 'Analyse des résultats' });
  });

  it('ouverture d’une page et recherche dans une page', () => {
    const url = 'https://academic.oup.com/eurheartj/article/44/37/3627/7246292';
    const view = buildResearchTimeline([
      { type: 'tool-web_search', state: 'output-available', output: { action: { type: 'openPage', url } } },
      { type: 'tool-web_search', state: 'output-available', output: { action: { type: 'findInPage', url, pattern: '10 mg' } } },
    ]);
    expect(view.steps.slice(1, 3).map((s) => [s.kind, s.title, s.detail])).toEqual([
      ['read', 'Lecture d’une page', undefined],
      ['find', 'Recherche dans la page', '« 10 mg »'],
    ]);
    expect(view.searchCount).toBe(2);
    expect(view.sourceCount).toBe(1);
  });

  it('réflexion entre deux recherches = étape distincte ; résumés consécutifs fusionnés', () => {
    const view = buildResearchTimeline([
      { type: 'reasoning', state: 'done', text: '**Planning**' },
      searchDone('q1', [], ['https://has-sante.fr/a']),
      { type: 'reasoning', state: 'done', text: '**Comparing guidelines**' },
      { type: 'reasoning', state: 'done', text: '**Checking doses**' },
      searchDone('q2', [], ['https://ansm.sante.fr/b']),
    ]);
    expect(view.steps.map((s) => s.kind)).toEqual(['analyze', 'search', 'think', 'search', 'think']);
    expect(view.steps[2].detail).toBe('Checking doses');
  });

  it('rédaction : étape active, sources citées comptées, plus d’étape de repli', () => {
    const view = buildResearchTimeline([
      searchDone('q', [], ['https://has-sante.fr/a']),
      { type: 'text', text: 'La dose recommandée…' },
      { type: 'source-url', url: 'https://has-sante.fr/a?utm_source=openai' },
      { type: 'source-url', url: 'https://has-sante.fr/a' },
    ]);
    expect(view.writing).toBe(true);
    expect(view.steps.at(-1)).toMatchObject({ kind: 'write', status: 'active', detail: '1 source citée' });
    expect(view.steps.filter((s) => s.status === 'active')).toHaveLength(1);
  });

  it('tour terminé : plus aucune étape active', () => {
    const view = buildResearchTimeline(
      [{ type: 'reasoning', state: 'streaming', text: '' }, { type: 'text', text: 'Fin' }],
      { finished: true },
    );
    expect(view.steps.every((s) => s.status === 'done')).toBe(true);
  });

  it('recherche échouée : signalée, jamais comptée', () => {
    const view = buildResearchTimeline([{ type: 'tool-web_search', state: 'output-error' }], { finished: true });
    expect(view.steps[1]).toMatchObject({ status: 'error', title: 'Recherche interrompue' });
    expect(view.searchCount).toBe(0);
  });

  it('ignore les outils étrangers et les parts malformées', () => {
    const view = buildResearchTimeline([null, 42, { type: 'tool-calculator', state: 'output-available' }, { type: 'step-start' }]);
    expect(view.steps.map((s) => s.kind)).toEqual(['analyze']);
  });
});

describe('aides', () => {
  it('reasoningHeadline : intertitre en gras, sinon première phrase bornée', () => {
    expect(reasoningHeadline('**Searching sources**\n\nI need')).toBe('Searching sources');
    expect(reasoningHeadline('Je vérifie la posologie. Puis le reste.')).toBe('Je vérifie la posologie.');
    expect(reasoningHeadline('')).toBe('');
    expect(reasoningHeadline('x'.repeat(200)).length).toBeLessThanOrEqual(90);
  });

  it('domainOf / cleanSourceUrl', () => {
    expect(domainOf('https://www.has-sante.fr/x')).toBe('has-sante.fr');
    expect(domainOf('ftp://x.org')).toBeNull();
    expect(cleanSourceUrl('https://a.org/p?utm_source=openai')).toBe('https://a.org/p');
    expect(cleanSourceUrl('https://a.org/p?id=3&utm_source=openai')).toBe('https://a.org/p?id=3');
  });

  it('hasResearchTrace et résumé une ligne', () => {
    const bare = buildResearchTimeline([{ type: 'text', text: 'Bonjour !' }], { finished: true });
    expect(hasResearchTrace(bare)).toBe(false);
    const rich = buildResearchTimeline(
      [searchDone('a', [], ['https://a.org/1', 'https://b.org/2']), searchDone('b', [], ['https://c.org/3']), { type: 'text', text: 'ok' }],
      { finished: true },
    );
    expect(hasResearchTrace(rich)).toBe(true);
    expect(researchSummaryLine(rich)).toBe('2 recherches · 3 pages consultées');
  });
});
