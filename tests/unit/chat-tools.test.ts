import { describe, it, expect, vi } from 'vitest';

import {
  isSafePublicHttpUrl,
  buildEuropePmcSearchUrl,
  formatEuropePmcResults,
  buildClinicalTrialsSearchUrl,
  formatClinicalTrialsResults,
  verdictForHttpStatus,
  formatLinkCheckResults,
  buildChatTools,
  buildChatToolsSection,
  pubmedMcpServers,
  PUBMED_MCP_URL,
  CHAT_TOOL_NAMES,
  MAX_URLS_PER_CALL,
} from '@/ai/chat/tools';
import { verifySourceLinksTool } from '@/ai/chat/tools/verifyLinks';

// ── Garde anti-SSRF ────────────────────────────────────────────────────────────

describe('isSafePublicHttpUrl — URLs publiques nommées uniquement', () => {
  it.each([
    'https://www.has-sante.fr/jcms/p_3192564',
    'https://doi.org/10.1093/eurheartj/ehae176',
    'http://europepmc.org/abstract/MED/12345',
  ])('accepte %s', (url) => {
    expect(isSafePublicHttpUrl(url)).toBe(true);
  });

  it.each([
    'ftp://example.com/file',
    'file:///etc/passwd',
    'https://localhost/admin',
    'https://intranet/secret',
    'https://127.0.0.1/health',
    'https://10.0.0.4/meta',
    'https://[::1]/x',
    'https://user:pass@example.com/',
    'https://api.service.internal/keys',
    'https://nas.local/share',
    'pas une url',
  ])('refuse %s', (url) => {
    expect(isSafePublicHttpUrl(url)).toBe(false);
  });
});

// ── Europe PMC ─────────────────────────────────────────────────────────────────

describe('buildEuropePmcSearchUrl', () => {
  it('construit la requête REST attendue (json, resultType core)', () => {
    const url = new URL(buildEuropePmcSearchUrl('atrial fibrillation anticoagulation', 3));
    expect(url.origin + url.pathname).toBe('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    expect(url.searchParams.get('query')).toBe('atrial fibrillation anticoagulation');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('pageSize')).toBe('3');
    expect(url.searchParams.get('resultType')).toBe('core');
  });

  it('borne pageSize entre 1 et 8 (défaut 5) et tronque la requête', () => {
    expect(new URL(buildEuropePmcSearchUrl('x')).searchParams.get('pageSize')).toBe('5');
    expect(new URL(buildEuropePmcSearchUrl('x', 99)).searchParams.get('pageSize')).toBe('8');
    expect(new URL(buildEuropePmcSearchUrl('x', -2)).searchParams.get('pageSize')).toBe('1');
    const longQuery = 'a'.repeat(500);
    expect(new URL(buildEuropePmcSearchUrl(longQuery)).searchParams.get('query')).toHaveLength(300);
  });
});

describe('formatEuropePmcResults', () => {
  const fixture = {
    resultList: {
      result: [
        {
          title: 'Anticoagulation in atrial fibrillation.',
          authorString: 'Dupont A, Martin B.',
          journalTitle: 'Eur Heart J',
          pubYear: '2024',
          doi: '10.1093/eurheartj/test',
          pmid: '38000001',
          pubType: 'review',
          citedByCount: 42,
          abstractText: '<p>Background: anticoagulation…</p>',
        },
        { title: 'No identifiers study', source: 'MED', id: '999' },
      ],
    },
  };

  it('rend une liste compacte avec métadonnées réelles et URL DOI prioritaire', () => {
    const out = formatEuropePmcResults(fixture);
    expect(out).toContain('1. Anticoagulation in atrial fibrillation — Dupont A, Martin B. (Eur Heart J, 2024)');
    expect(out).toContain('DOI : 10.1093/eurheartj/test');
    expect(out).toContain('Citations : 42');
    expect(out).toContain('URL : https://doi.org/10.1093/eurheartj/test');
    // Les balises HTML de l'abstract sont retirées.
    expect(out).not.toContain('<p>');
    // Repli europepmc.org quand ni DOI ni PMID.
    expect(out).toContain('URL : https://europepmc.org/abstract/MED/999');
  });

  it('message actionnable quand aucun résultat ou JSON inattendu', () => {
    expect(formatEuropePmcResults({ resultList: { result: [] } })).toContain('Aucun article');
    expect(formatEuropePmcResults(null)).toContain('Aucun article');
    expect(formatEuropePmcResults({ weird: true })).toContain('Aucun article');
  });
});

// ── ClinicalTrials.gov ─────────────────────────────────────────────────────────

describe('buildClinicalTrialsSearchUrl', () => {
  it('construit la requête v2 avec filtre recrutement optionnel', () => {
    const url = new URL(buildClinicalTrialsSearchUrl('heart failure sglt2', { limit: 4, recruitingOnly: true }));
    expect(url.origin + url.pathname).toBe('https://clinicaltrials.gov/api/v2/studies');
    expect(url.searchParams.get('query.term')).toBe('heart failure sglt2');
    expect(url.searchParams.get('pageSize')).toBe('4');
    expect(url.searchParams.get('filter.overallStatus')).toBe('RECRUITING');
    expect(
      new URL(buildClinicalTrialsSearchUrl('x')).searchParams.get('filter.overallStatus'),
    ).toBeNull();
  });
});

describe('formatClinicalTrialsResults', () => {
  const fixture = {
    studies: [
      {
        protocolSection: {
          identificationModule: { nctId: 'NCT05555555', briefTitle: 'SGLT2 in HFpEF' },
          statusModule: { overallStatus: 'RECRUITING', startDateStruct: { date: '2025-03' } },
          designModule: { phases: ['PHASE3'] },
          conditionsModule: { conditions: ['Heart Failure', 'HFpEF'] },
          sponsorCollaboratorsModule: { leadSponsor: { name: 'CHU Test' } },
        },
      },
    ],
  };

  it('rend NCT, statut, phase et URL officielle', () => {
    const out = formatClinicalTrialsResults(fixture);
    expect(out).toContain('[NCT05555555] SGLT2 in HFpEF');
    expect(out).toContain('Statut : RECRUITING');
    expect(out).toContain('Phase : PHASE3');
    expect(out).toContain('URL : https://clinicaltrials.gov/study/NCT05555555');
  });

  it('message actionnable quand aucun essai', () => {
    expect(formatClinicalTrialsResults({ studies: [] })).toContain('Aucun essai');
    expect(formatClinicalTrialsResults(null)).toContain('Aucun essai');
  });
});

// ── Vérification des liens ─────────────────────────────────────────────────────

describe('verdictForHttpStatus', () => {
  it('2xx/3xx = ok, 4xx/5xx = cassé', () => {
    expect(verdictForHttpStatus(200)).toBe('ok');
    expect(verdictForHttpStatus(301)).toBe('ok');
    expect(verdictForHttpStatus(404)).toBe('broken');
    expect(verdictForHttpStatus(500)).toBe('broken');
  });
});

describe('formatLinkCheckResults', () => {
  it('liste chaque verdict et résume le nombre d’URLs à corriger', () => {
    const out = formatLinkCheckResults([
      { url: 'https://a.fr/x', status: 'ok', httpStatus: 200 },
      { url: 'https://b.fr/y', status: 'broken', httpStatus: 404 },
      { url: 'https://c.local/z', status: 'unsafe' },
    ]);
    expect(out).toContain('https://a.fr/x → OK (200)');
    expect(out).toContain('CASSÉ (HTTP 404)');
    expect(out).toContain('REFUSÉ');
    expect(out).toContain('2 URL(s) à corriger');
  });

  it('résumé positif quand tout répond', () => {
    expect(
      formatLinkCheckResults([{ url: 'https://a.fr', status: 'ok', httpStatus: 200 }]),
    ).toContain('Toutes les URLs répondent');
  });
});

async function runVerify(
  tool: ReturnType<typeof verifySourceLinksTool>,
  urls: string[],
): Promise<string> {
  const out = await tool.execute!({ urls }, { toolCallId: 't', messages: [] } as never);
  return out as string;
}

describe('verify_source_links (execute, fetch mocké)', () => {
  const makeResponse = (status: number, url: string) =>
    ({ status, url, body: null }) as unknown as Response;

  it('vérifie en HEAD, retombe en GET quand HEAD est refusé, refuse les URLs non publiques', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('https://head-405.fr')) {
        return makeResponse(init?.method === 'HEAD' ? 405 : 200, url);
      }
      return makeResponse(200, url);
    });
    const tool = verifySourceLinksTool(fetchMock as unknown as typeof fetch);
    const out = await runVerify(tool, ['https://ok.fr/page', 'https://head-405.fr/doc', 'https://127.0.0.1/meta']);

    expect(out).toContain('https://ok.fr/page → OK (200)');
    expect(out).toContain('https://head-405.fr/doc → OK (200)');
    expect(out).toContain('https://127.0.0.1/meta → REFUSÉ');
    // L'URL interne n'a JAMAIS été fetchée (anti-SSRF).
    expect(fetchMock.mock.calls.every(([u]) => !String(u).includes('127.0.0.1'))).toBe(true);
  });

  it('déduplique et borne le nombre d’URLs', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => makeResponse(200, String(input)));
    const tool = verifySourceLinksTool(fetchMock as unknown as typeof fetch);
    const urls = Array.from({ length: MAX_URLS_PER_CALL }, (_, i) => `https://site${i}.fr/`);
    await runVerify(tool, [...urls, ...urls]);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_URLS_PER_CALL);
  });

  it('réseau en échec → INJOIGNABLE, jamais une exception', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('boom');
    });
    const tool = verifySourceLinksTool(fetchMock as unknown as typeof fetch);
    const out = await runVerify(tool, ['https://down.fr/x']);
    expect(out).toContain('INJOIGNABLE');
  });
});

// ── Disponibilité par chatbot + section système ───────────────────────────────

describe('buildChatTools — disponibilité par chatbot', () => {
  it('les 3 chatbots ont littérature + vérification des liens', () => {
    for (const bot of ['public', 'student', 'professional'] as const) {
      const tools = buildChatTools(bot);
      expect(Object.keys(tools)).toContain(CHAT_TOOL_NAMES.europePmc);
      expect(Object.keys(tools)).toContain(CHAT_TOOL_NAMES.verifyLinks);
    }
  });

  it('les essais cliniques sont réservés au chatbot professionnel', () => {
    expect(Object.keys(buildChatTools('professional'))).toContain(CHAT_TOOL_NAMES.clinicalTrials);
    expect(Object.keys(buildChatTools('public'))).not.toContain(CHAT_TOOL_NAMES.clinicalTrials);
    expect(Object.keys(buildChatTools('student'))).not.toContain(CHAT_TOOL_NAMES.clinicalTrials);
  });
});

describe('pubmedMcpServers — connecteur PubMed MCP (Claude + chatbot pro uniquement)', () => {
  it('actif seulement pour provider anthropic ET chatbot professionnel', () => {
    expect(pubmedMcpServers('anthropic', 'professional', {})).toEqual([
      { type: 'url', name: 'pubmed', url: PUBMED_MCP_URL },
    ]);
    expect(pubmedMcpServers('openai', 'professional', {})).toBeNull();
    expect(pubmedMcpServers('anthropic', 'public', {})).toBeNull();
    expect(pubmedMcpServers('anthropic', 'student', {})).toBeNull();
  });

  it("l'env PUBMED_MCP_URL surcharge ou désactive (off / vide)", () => {
    expect(
      pubmedMcpServers('anthropic', 'professional', { PUBMED_MCP_URL: 'https://autre.example/mcp' }),
    ).toEqual([{ type: 'url', name: 'pubmed', url: 'https://autre.example/mcp' }]);
    expect(pubmedMcpServers('anthropic', 'professional', { PUBMED_MCP_URL: 'off' })).toBeNull();
    expect(pubmedMcpServers('anthropic', 'professional', { PUBMED_MCP_URL: '  ' })).toBeNull();
  });
});

describe('buildChatToolsSection — consigne système', () => {
  it('mentionne les outils PubMed MCP uniquement quand le connecteur est actif', () => {
    expect(buildChatToolsSection('professional', { pubmedMcp: true })).toContain('PubMed (serveur officiel');
    expect(buildChatToolsSection('professional')).not.toContain('serveur officiel');
  });

  it('décrit uniquement les outils réellement disponibles pour le chatbot', () => {
    const pro = buildChatToolsSection('professional');
    expect(pro).toContain(CHAT_TOOL_NAMES.europePmc);
    expect(pro).toContain(CHAT_TOOL_NAMES.clinicalTrials);
    expect(pro).toContain(CHAT_TOOL_NAMES.verifyLinks);

    const pub = buildChatToolsSection('public');
    expect(pub).not.toContain(CHAT_TOOL_NAMES.clinicalTrials);
    expect(pub).toContain('SOURCES');
    // Les prompts produit restent la source de vérité du format.
    expect(pub).toContain('ne changent RIEN au format');
  });
});
