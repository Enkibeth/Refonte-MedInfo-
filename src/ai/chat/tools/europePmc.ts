/**
 * Outil `europe_pmc_search` — recherche dans la littérature biomédicale via l'API REST
 * publique Europe PMC (couvre PubMed/MEDLINE + PMC + preprints, sans clé d'API).
 *
 * Objectif qualité : quand le chatbot cite une étude ([ÉTUDE]), les métadonnées
 * (auteurs, journal, année, DOI, nombre de citations) viennent d'une base réelle —
 * jamais de référence inventée. Fonctionne avec tous les providers (gpt-5.2, Claude,
 * Gemini) : simple outil AI SDK, pas de connecteur propriétaire.
 *
 * La construction d'URL et le formatage des résultats sont purs et testés
 * (tests/unit/chat-tools.test.ts) ; seul `execute` touche le réseau.
 */
import { tool } from 'ai';
import { z } from 'zod';

const EUROPE_PMC_ENDPOINT = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';
const EUROPE_PMC_ARTICLE_ENDPOINT = 'https://www.ebi.ac.uk/europepmc/webservices/rest/article';
const FETCH_TIMEOUT_MS = 8_000;

/** Tri des résultats (workflow evidence-first) : pertinence (défaut), récence ou citations. */
export type EuropePmcSort = 'relevance' | 'recent' | 'cited';

const SORT_PARAMS: Record<Exclude<EuropePmcSort, 'relevance'>, string> = {
  recent: 'P_PDATE_D desc',
  cited: 'CITED desc',
};

export function buildEuropePmcSearchUrl(
  query: string,
  limit?: number,
  sort?: EuropePmcSort,
): string {
  const pageSize = Math.min(Math.max(Math.floor(limit ?? 5), 1), 8);
  const params = new URLSearchParams({
    query: query.trim().slice(0, 300),
    format: 'json',
    pageSize: String(pageSize),
    resultType: 'core',
  });
  if (sort && sort !== 'relevance') params.set('sort', SORT_PARAMS[sort]);
  return `${EUROPE_PMC_ENDPOINT}?${params.toString()}`;
}

interface EuropePmcResult {
  title?: string;
  authorString?: string;
  journalTitle?: string;
  pubYear?: string;
  doi?: string;
  pmid?: string;
  source?: string;
  id?: string;
  pubType?: string;
  citedByCount?: number;
  abstractText?: string;
}

function bestUrl(r: EuropePmcResult): string | null {
  if (r.doi) return `https://doi.org/${r.doi}`;
  if (r.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`;
  if (r.source && r.id) return `https://europepmc.org/abstract/${r.source}/${r.id}`;
  return null;
}

/** Formate la réponse JSON d'Europe PMC en liste compacte lisible par le modèle. */
export function formatEuropePmcResults(json: unknown): string {
  const results = (json as { resultList?: { result?: EuropePmcResult[] } } | null)?.resultList
    ?.result;
  if (!Array.isArray(results) || results.length === 0) {
    return 'Aucun article trouvé pour cette requête. Reformule (termes anglais, syntaxe PubMed) ou élargis la recherche.';
  }
  const lines = results.map((r, i) => {
    const head = [
      r.title?.replace(/\.$/, ''),
      r.authorString ? `— ${r.authorString}` : null,
      r.journalTitle || r.pubYear
        ? `(${[r.journalTitle, r.pubYear].filter(Boolean).join(', ')})`
        : null,
    ]
      .filter(Boolean)
      .join(' ');
    const meta = [
      r.pubType ? `Type : ${r.pubType}` : null,
      typeof r.citedByCount === 'number' ? `Citations : ${r.citedByCount}` : null,
      r.doi ? `DOI : ${r.doi}` : null,
      r.pmid ? `PMID : ${r.pmid}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const url = bestUrl(r);
    const abstract = r.abstractText
      ? `Résumé : ${r.abstractText.replace(/<[^>]+>/g, '').slice(0, 350)}…`
      : null;
    return [`${i + 1}. ${head}`, meta || null, url ? `URL : ${url}` : null, abstract]
      .filter(Boolean)
      .join('\n   ');
  });
  return lines.join('\n');
}

export function europePmcSearchTool(fetchImpl: typeof fetch = fetch) {
  return tool({
    description:
      'Recherche dans la littérature biomédicale réelle (Europe PMC : PubMed/MEDLINE, PMC). ' +
      'Renvoie titre, auteurs, journal, année, type de publication, DOI/PMID, URL stable et nombre de citations. ' +
      "À utiliser dès que tu cites une étude scientifique : ne cite jamais un article que tu n'as pas retrouvé ici ou par la recherche web. " +
      'Requête en anglais recommandée ; la syntaxe PubMed (AND, OR, "…") est acceptée. ' +
      'Pour lire le résumé complet d’un résultat, enchaîne avec europe_pmc_article (PMID ou DOI).',
    inputSchema: z.object({
      query: z.string().min(2).describe('Requête de recherche (mots-clés, anglais recommandé)'),
      limit: z.number().int().min(1).max(8).optional().describe('Nombre de résultats (défaut 5)'),
      sort: z
        .enum(['relevance', 'recent', 'cited'])
        .optional()
        .describe(
          'Tri : relevance (défaut), recent (publications les plus récentes), cited (les plus citées)',
        ),
    }),
    execute: async ({ query, limit, sort }: { query: string; limit?: number; sort?: EuropePmcSort }) => {
      try {
        const res = await fetchImpl(buildEuropePmcSearchUrl(query, limit, sort), {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { accept: 'application/json' },
        });
        if (!res.ok) return `Recherche Europe PMC indisponible (HTTP ${res.status}). Appuie-toi sur la recherche web.`;
        return formatEuropePmcResults(await res.json());
      } catch {
        return 'Recherche Europe PMC indisponible (réseau). Appuie-toi sur la recherche web.';
      }
    },
  });
}

// ── Lecture d'article (workflow evidence-first, à la OpenEvidence) ─────────────
//
// La recherche ne renvoie qu'un extrait de résumé (350 caractères) : suffisant pour
// choisir les articles, pas pour fonder une affirmation. `europe_pmc_article` renvoie
// le résumé COMPLET d'un article identifié (PMID ou DOI) pour que la synthèse s'appuie
// sur le contenu réel de l'étude — jamais sur son seul titre.

// Audit latence 2026-07 : les résumés lus s'accumulent dans le contexte à chaque étape
// (2-3 lectures/réponse). 2000 caractères couvrent l'essentiel d'un abstract structuré
// (contexte/méthode/résultats/conclusion) tout en réduisant d'un tiers les tokens injectés.
const MAX_ABSTRACT_CHARS = 2_000;

/**
 * URL Europe PMC pour lire un article par PMID (endpoint article) ou DOI (recherche
 * exacte DOI:"…"). Renvoie null si l'identifiant n'est ni un PMID ni un DOI plausible.
 */
export function buildEuropePmcArticleUrl(id: string): string | null {
  const trimmed = id.trim();
  if (/^\d{1,9}$/.test(trimmed)) {
    return `${EUROPE_PMC_ARTICLE_ENDPOINT}/MED/${trimmed}?resultType=core&format=json`;
  }
  const doi = trimmed.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '');
  if (/^10\.\S+\/\S+$/.test(doi)) {
    const params = new URLSearchParams({
      query: `DOI:"${doi.slice(0, 200)}"`,
      format: 'json',
      pageSize: '1',
      resultType: 'core',
    });
    return `${EUROPE_PMC_ENDPOINT}?${params.toString()}`;
  }
  return null;
}

/** Formate un article (endpoint article `{result}` ou recherche `{resultList}`) avec résumé complet. */
export function formatEuropePmcArticle(json: unknown): string {
  const record = json as
    | { result?: EuropePmcResult; resultList?: { result?: EuropePmcResult[] } }
    | null;
  const r = record?.result ?? record?.resultList?.result?.[0];
  if (!r || (!r.title && !r.abstractText)) {
    return 'Article introuvable pour cet identifiant. Vérifie le PMID/DOI (repars des résultats de europe_pmc_search).';
  }
  const head = [
    r.title?.replace(/\.$/, ''),
    r.authorString ? `— ${r.authorString}` : null,
    r.journalTitle || r.pubYear
      ? `(${[r.journalTitle, r.pubYear].filter(Boolean).join(', ')})`
      : null,
  ]
    .filter(Boolean)
    .join(' ');
  const meta = [
    r.pubType ? `Type : ${r.pubType}` : null,
    typeof r.citedByCount === 'number' ? `Citations : ${r.citedByCount}` : null,
    r.doi ? `DOI : ${r.doi}` : null,
    r.pmid ? `PMID : ${r.pmid}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const url = bestUrl(r);
  const abstract = r.abstractText
    ? `Résumé complet :\n${r.abstractText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_ABSTRACT_CHARS)}`
    : 'Résumé indisponible pour cet article (appuie-toi sur les métadonnées et la recherche web).';
  return [head, meta || null, url ? `URL : ${url}` : null, abstract].filter(Boolean).join('\n');
}

export function europePmcArticleTool(fetchImpl: typeof fetch = fetch) {
  return tool({
    description:
      "Lit le résumé COMPLET d'un article scientifique identifié par son PMID ou son DOI (Europe PMC). " +
      'À utiliser après europe_pmc_search sur les 2-3 articles qui fonderont ta réponse : ' +
      "chaque affirmation appuyée sur une étude doit venir de son résumé réel, jamais de son seul titre. " +
      'Appelle-le pour CHAQUE article retenu EN PARALLÈLE (tous les appels dans le même tour) et passe le paramètre title.',
    inputSchema: z.object({
      id: z.string().min(2).describe("PMID (ex : 38000001) ou DOI (ex : 10.1093/eurheartj/ehae176) de l'article"),
      // Latence perçue : le titre est affiché dans la bulle de statut du client pendant
      // la lecture (« Lecture : “…” ») — il ne change rien à la requête Europe PMC.
      title: z
        .string()
        .optional()
        .describe("Titre de l'article, repris du résultat de recherche (affiché à l'utilisateur pendant la lecture)"),
    }),
    execute: async ({ id }: { id: string; title?: string }) => {
      const url = buildEuropePmcArticleUrl(id);
      if (!url) {
        return 'Identifiant non reconnu : fournis un PMID numérique ou un DOI (10.xxxx/…).';
      }
      try {
        const res = await fetchImpl(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { accept: 'application/json' },
        });
        if (!res.ok) return `Lecture Europe PMC indisponible (HTTP ${res.status}). Appuie-toi sur les métadonnées de la recherche.`;
        return formatEuropePmcArticle(await res.json());
      } catch {
        return 'Lecture Europe PMC indisponible (réseau). Appuie-toi sur les métadonnées de la recherche.';
      }
    },
  });
}
