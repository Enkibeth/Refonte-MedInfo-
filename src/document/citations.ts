/**
 * Citations ancrées de l'analyse de document (API Citations d'Anthropic, ADR-0030 suivi).
 *
 * Quand le modèle de la feature `analyze` est un modèle Claude, chaque affirmation du
 * résultat peut être ancrée à un passage exact du document analysé (page du PDF ou
 * extrait du texte). Le serveur sérialise ces passages en pied de flux
 * `<!--CITATIONS:…-->` (même convention que `<!--CALC:…-->` du chat) ; le client les
 * détache du texte et les affiche dans une section « Passages du document cités ».
 *
 * Module pur (client + serveur), sans dépendance réseau — testé dans
 * tests/unit/document-citations.test.ts.
 */

export interface DocumentCitation {
  /** Passage exact cité du document (tronqué). */
  text: string;
  /** Pages du PDF (1-indexées) quand la source est un PDF. */
  startPage?: number;
  endPage?: number;
}

export const CITATIONS_MARKER = '<!--CITATIONS:';
const CITATIONS_END = '-->';
const MAX_CITATIONS = 15;
const MAX_CITATION_LENGTH = 400;

/** Forme minimale des sources `document` renvoyées par l'AI SDK (provider Anthropic). */
interface DocumentSourceLike {
  sourceType?: string;
  providerMetadata?: {
    anthropic?: {
      citedText?: unknown;
      startPageNumber?: unknown;
      endPageNumber?: unknown;
    };
  };
}

function coercePage(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

/**
 * Extrait les citations exploitables des sources du stream (sourceType `document`).
 * Déduplique les passages identiques et borne le nombre/la longueur.
 */
export function citationsFromSources(sources: readonly unknown[]): DocumentCitation[] {
  const seen = new Set<string>();
  const citations: DocumentCitation[] = [];
  for (const raw of sources) {
    const source = raw as DocumentSourceLike;
    if (source?.sourceType !== 'document') continue;
    const meta = source.providerMetadata?.anthropic;
    const cited = typeof meta?.citedText === 'string' ? meta.citedText : '';
    // Le marqueur de fin ne doit jamais apparaître dans le passage sérialisé.
    const text = cited.replace(/-->/g, '→').replace(/\s+/g, ' ').trim().slice(0, MAX_CITATION_LENGTH);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      text,
      startPage: coercePage(meta?.startPageNumber),
      endPage: coercePage(meta?.endPageNumber),
    });
    if (citations.length >= MAX_CITATIONS) break;
  }
  return citations;
}

/** Pied de flux sérialisé, ou chaîne vide s'il n'y a aucune citation. */
export function buildCitationsFooter(sources: readonly unknown[]): string {
  const citations = citationsFromSources(sources);
  if (citations.length === 0) return '';
  return `\n\n${CITATIONS_MARKER}${JSON.stringify(citations)}${CITATIONS_END}`;
}

/**
 * Texte affichable pendant le streaming : coupe tout à partir du marqueur (même
 * partiel) pour qu'aucun fragment de pied de flux ne s'affiche à l'écran.
 */
export function visibleAnalysisText(raw: string): string {
  const idx = raw.indexOf(CITATIONS_MARKER);
  const cut = idx >= 0 ? raw.slice(0, idx) : raw;
  // Marqueur encore incomplet en fin de flux (ex. « <!--CITA ») : on le masque aussi.
  for (let len = Math.min(CITATIONS_MARKER.length - 1, cut.length); len > 3; len--) {
    if (cut.endsWith(CITATIONS_MARKER.slice(0, len))) return cut.slice(0, cut.length - len).trimEnd();
  }
  return idx >= 0 ? cut.trimEnd() : cut;
}

/** Sépare le résultat archivé/streamé en texte + citations (tolère l'absence de pied). */
export function splitAnalysisResult(raw: string): { text: string; citations: DocumentCitation[] } {
  const idx = raw.indexOf(CITATIONS_MARKER);
  if (idx < 0) return { text: raw, citations: [] };
  const end = raw.lastIndexOf(CITATIONS_END);
  const text = raw.slice(0, idx).trimEnd();
  if (end <= idx) return { text, citations: [] };
  try {
    const parsed = JSON.parse(raw.slice(idx + CITATIONS_MARKER.length, end));
    if (!Array.isArray(parsed)) return { text, citations: [] };
    const citations = parsed
      .filter((c): c is DocumentCitation => typeof (c as DocumentCitation)?.text === 'string')
      .map((c) => ({
        text: c.text.slice(0, MAX_CITATION_LENGTH),
        startPage: coercePage(c.startPage),
        endPage: coercePage(c.endPage),
      }));
    return { text, citations };
  } catch {
    return { text, citations: [] };
  }
}

/** Libellé de pages d'une citation (« p. 3 » ou « p. 3–5 »), null hors PDF. */
export function citationPagesLabel(citation: DocumentCitation): string | null {
  if (!citation.startPage) return null;
  if (citation.endPage && citation.endPage !== citation.startPage) {
    return `p. ${citation.startPage}–${citation.endPage}`;
  }
  return `p. ${citation.startPage}`;
}
