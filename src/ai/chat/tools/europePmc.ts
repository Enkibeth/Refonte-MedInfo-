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
const FETCH_TIMEOUT_MS = 8_000;

export function buildEuropePmcSearchUrl(query: string, limit?: number): string {
  const pageSize = Math.min(Math.max(Math.floor(limit ?? 5), 1), 8);
  const params = new URLSearchParams({
    query: query.trim().slice(0, 300),
    format: 'json',
    pageSize: String(pageSize),
    resultType: 'core',
  });
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
      'Requête en anglais recommandée ; la syntaxe PubMed (AND, OR, "…") est acceptée.',
    inputSchema: z.object({
      query: z.string().min(2).describe('Requête de recherche (mots-clés, anglais recommandé)'),
      limit: z.number().int().min(1).max(8).optional().describe('Nombre de résultats (défaut 5)'),
    }),
    execute: async ({ query, limit }: { query: string; limit?: number }) => {
      try {
        const res = await fetchImpl(buildEuropePmcSearchUrl(query, limit), {
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
