/**
 * Timeline des étapes de recherche du chat (2026-07) — « Étapes » à la Vera Health.
 *
 * Depuis le split orchestrateur/rédacteur (migration 0041), la boucle d'outils tourne
 * dans un generateText SERVEUR avant le début du stream : le client ne voyait plus rien
 * pendant la phase la plus longue. Ce module définit la timeline STRUCTURÉE des étapes
 * (analyse → concepts clés → recherche → lecture → vérification → rédaction) que la
 * route /api/chat émet en direct via des data parts `data-research` (createUIMessageStream),
 * dans les DEUX chemins (split et mono-modèle).
 *
 * Les compteurs sont DÉTERMINISTES et honnêtes : « ≈ N publications identifiées » vient
 * du hitCount réel d'Europe PMC (nombre total de résultats correspondant aux requêtes,
 * comme le « Found 419 sources » d'OpenEvidence/Vera), « k lues » du nombre de résumés
 * réellement ouverts, « x/y liens valides » des verdicts HTTP réels. Les métadonnées
 * d'articles (journal, année, type, citations) viennent des réponses Europe PMC — jamais
 * du modèle — et servent à enrichir les fiches sources côté client.
 *
 * Module PUR (aucune dépendance UI/réseau) : testé dans tests/unit/chat-research-timeline.test.ts.
 */

/** Identifiant stable de la data part timeline (réconciliée à chaque écriture). */
export const RESEARCH_DATA_PART_TYPE = 'data-research';
export const RESEARCH_DATA_PART_ID = 'research-timeline';

/** Métadonnées réelles d'un article retrouvé (réponse Europe PMC, jamais le modèle). */
export interface ResearchArticle {
  title: string;
  journal: string | null;
  year: string | null;
  /** Type de publication brut Europe PMC (ex. « review », « randomized controlled trial »). */
  pubType: string | null;
  citedByCount: number | null;
  url: string | null;
  doi: string | null;
  pmid: string | null;
  /** true si le résumé complet a été lu (europe_pmc_article). */
  read?: boolean;
}

/** Événement émis par les outils serveur pendant la boucle de recherche. */
export type ResearchEvent =
  | { kind: 'plan'; concepts: string[]; queries: string[] }
  | { kind: 'search'; query: string; found: number | null; articles?: ResearchArticle[] }
  | { kind: 'web' }
  | { kind: 'trials'; query: string; found: number | null }
  | { kind: 'pubmed' }
  | { kind: 'read'; title: string | null; article?: ResearchArticle | null }
  | { kind: 'verify'; checked: number; ok: number; okUrls: string[] };

export type ResearchPhase = 'analyzing' | 'searching' | 'writing' | 'done';

export type ResearchStepStatus = 'done' | 'active' | 'pending';

export interface ResearchStepView {
  id: 'analyze' | 'concepts' | 'search' | 'trials' | 'pubmed' | 'read' | 'verify' | 'write';
  label: string;
  /** Sous-libellé chiffré (« 3 requêtes générées », « ≈ 419 publications identifiées »). */
  detail: string | null;
  status: ResearchStepStatus;
  /** Puces contextuelles (concepts clés, titres lus…), déjà tronquées. */
  chips: string[];
}

/** Charge utile de la data part `data-research` (émise par la route, rendue par le client). */
export interface ResearchTimelineData {
  phase: ResearchPhase;
  steps: ResearchStepView[];
  /** Somme des résultats correspondants (hitCount Europe PMC + total CT.gov), null si inconnu. */
  totalFound: number | null;
  /** URLs dont le lien a été vérifié OK (fiches sources : pastille « lien vérifié »). */
  verifiedUrls: string[];
  /** Articles réels retrouvés (métadonnées Europe PMC) pour enrichir les fiches sources. */
  articles: ResearchArticle[];
}

const MAX_CHIPS = 4;
const MAX_ARTICLES = 16;
const MAX_CHIP_CHARS = 64;

function chip(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_CHIP_CHARS ? `${clean.slice(0, MAX_CHIP_CHARS - 1)}…` : clean;
}

function plural(n: number, singular: string, pluralForm?: string): string {
  return n > 1 ? (pluralForm ?? `${singular}s`) : singular;
}

/** Clé de déduplication d'un article (PMID > DOI > URL > titre). */
function articleKey(a: ResearchArticle): string {
  return a.pmid ?? a.doi ?? a.url ?? a.title.toLowerCase();
}

/**
 * Construit la timeline affichable depuis les événements accumulés. L'ordre des étapes
 * est canonique (analyse → concepts → recherche → essais → PubMed → lecture → vérification
 * → rédaction) ; seules les étapes réellement traversées apparaissent (hors analyse et
 * rédaction, toujours présentes).
 */
export function buildResearchTimeline(
  events: readonly ResearchEvent[],
  phase: ResearchPhase,
): ResearchTimelineData {
  const plans = events.filter((e) => e.kind === 'plan');
  const searches = events.filter((e) => e.kind === 'search');
  const webs = events.filter((e) => e.kind === 'web');
  const trials = events.filter((e) => e.kind === 'trials');
  const pubmeds = events.filter((e) => e.kind === 'pubmed');
  const reads = events.filter((e) => e.kind === 'read');
  const verifies = events.filter((e) => e.kind === 'verify');

  // Agrégat honnête « N sources identifiées » : somme des hitCounts connus.
  const counted = [...searches, ...trials].map((e) => e.found).filter((n): n is number => typeof n === 'number' && n >= 0);
  const totalFound = counted.length > 0 ? counted.reduce((a, b) => a + b, 0) : null;

  // Articles dédupliqués (les lectures marquent read: true sur l'article correspondant).
  const articleMap = new Map<string, ResearchArticle>();
  for (const s of searches) {
    for (const a of s.articles ?? []) {
      const key = articleKey(a);
      if (!articleMap.has(key) && articleMap.size < MAX_ARTICLES) articleMap.set(key, { ...a });
    }
  }
  for (const r of reads) {
    if (!r.article) continue;
    const key = articleKey(r.article);
    const existing = articleMap.get(key);
    if (existing) {
      // La lecture (fiche complète) raffine les métadonnées de la recherche.
      articleMap.set(key, { ...existing, ...withoutNulls(r.article), read: true });
    } else if (articleMap.size < MAX_ARTICLES) {
      articleMap.set(key, { ...r.article, read: true });
    }
  }

  const verifiedUrls = [...new Set(verifies.flatMap((v) => v.okUrls))];

  const steps: ResearchStepView[] = [];

  steps.push({
    id: 'analyze',
    label: 'Analyse de la question',
    detail: phase === 'analyzing' ? null : 'Question médicale — recherche des meilleures preuves',
    status: 'pending',
    chips: [],
  });

  if (plans.length > 0) {
    const lastPlan = plans[plans.length - 1];
    const nQueries = lastPlan.queries.length;
    steps.push({
      id: 'concepts',
      label: 'Identification des concepts médicaux clés',
      detail:
        nQueries > 0
          ? `${nQueries} ${plural(nQueries, 'requête')} de recherche ${plural(nQueries, 'générée')}`
          : null,
      status: 'pending',
      chips: lastPlan.concepts.slice(0, MAX_CHIPS).map(chip),
    });
  }

  if (searches.length > 0 || webs.length > 0) {
    const parts: string[] = [];
    if (totalFound != null) {
      parts.push(`≈ ${totalFound} ${plural(totalFound, 'publication')} ${plural(totalFound, 'identifiée')}`);
    }
    if (webs.length > 0) {
      parts.push(`${webs.length} ${plural(webs.length, 'recherche')} web`);
    }
    steps.push({
      id: 'search',
      label: 'Recherche dans la littérature',
      detail: parts.length > 0 ? parts.join(' · ') : null,
      status: 'pending',
      chips: searches.slice(0, MAX_CHIPS).map((s) => chip(s.query)),
    });
  }

  if (trials.length > 0) {
    const found = trials
      .map((t) => t.found)
      .filter((n): n is number => typeof n === 'number' && n >= 0)
      .reduce((a, b) => a + b, 0);
    steps.push({
      id: 'trials',
      label: 'Recherche d’essais cliniques',
      detail: found > 0 ? `≈ ${found} ${plural(found, 'essai')} ${plural(found, 'correspondant')}` : null,
      status: 'pending',
      chips: trials.slice(0, MAX_CHIPS).map((t) => chip(t.query)),
    });
  }

  if (pubmeds.length > 0) {
    steps.push({
      id: 'pubmed',
      label: 'Recherche PubMed approfondie',
      detail: null,
      status: 'pending',
      chips: [],
    });
  }

  if (reads.length > 0) {
    steps.push({
      id: 'read',
      label: 'Lecture des études retenues',
      detail: `${reads.length} ${plural(reads.length, 'résumé')} ${plural(reads.length, 'analysé')}`,
      status: 'pending',
      chips: reads
        .map((r) => r.title)
        .filter((t): t is string => !!t && t.trim().length > 0)
        .slice(0, MAX_CHIPS)
        .map(chip),
    });
  }

  if (verifies.length > 0) {
    const checked = verifies.reduce((a, v) => a + v.checked, 0);
    const ok = verifies.reduce((a, v) => a + v.ok, 0);
    steps.push({
      id: 'verify',
      label: 'Vérification des liens sources',
      detail: `${ok}/${checked} ${plural(checked, 'lien valide', 'liens valides')}`,
      status: 'pending',
      chips: [],
    });
  }

  steps.push({
    id: 'write',
    label: 'Rédaction de la réponse',
    detail: null,
    status: 'pending',
    chips: [],
  });

  applyStatuses(steps, events, phase);

  return { phase, steps, totalFound, verifiedUrls, articles: [...articleMap.values()] };
}

/** Copie sans les champs null/undefined (pour raffiner sans écraser par du vide). */
function withoutNulls(a: ResearchArticle): Partial<ResearchArticle> {
  const out: Partial<ResearchArticle> = {};
  for (const [k, v] of Object.entries(a) as [keyof ResearchArticle, unknown][]) {
    if (v != null) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

const STEP_OF_EVENT: Record<ResearchEvent['kind'], ResearchStepView['id']> = {
  plan: 'concepts',
  search: 'search',
  web: 'search',
  trials: 'trials',
  pubmed: 'pubmed',
  read: 'read',
  verify: 'verify',
};

/** Statuts : tout ce qui précède l'étape « courante » est fait, la courante est active. */
function applyStatuses(
  steps: ResearchStepView[],
  events: readonly ResearchEvent[],
  phase: ResearchPhase,
): void {
  if (phase === 'done') {
    for (const s of steps) s.status = 'done';
    return;
  }
  if (phase === 'analyzing') {
    for (const s of steps) s.status = s.id === 'analyze' ? 'active' : 'pending';
    return;
  }
  if (phase === 'writing') {
    for (const s of steps) s.status = s.id === 'write' ? 'active' : 'done';
    return;
  }
  // phase 'searching' : une étape n'existe (hors analyse/rédaction) que si ses événements
  // ont eu lieu → elle est faite, sauf celle du DERNIER événement, encore active. La
  // rédaction reste à venir, l'analyse est acquise dès qu'on cherche.
  const last = events[events.length - 1];
  const activeId = last ? STEP_OF_EVENT[last.kind] : 'analyze';
  for (const s of steps) {
    s.status = s.id === 'write' ? 'pending' : s.id === activeId ? 'active' : 'done';
  }
}

// ── Côté client : extraction depuis le message UI et finalisation ─────────────

interface PartLike {
  type?: unknown;
  data?: unknown;
}

/** Dernière data part timeline d'un message assistant, sinon null. Défensif sur la forme. */
export function researchTimelineOfParts(parts: unknown): ResearchTimelineData | null {
  if (!Array.isArray(parts)) return null;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i] as PartLike | null;
    if (p == null || typeof p !== 'object') continue;
    if (p.type !== RESEARCH_DATA_PART_TYPE) continue;
    const data = p.data as ResearchTimelineData | null;
    if (data && Array.isArray(data.steps)) return data;
  }
  return null;
}

/**
 * Timeline d'un message TERMINÉ : toutes les étapes passent à « fait » (la réponse est
 * là). La route n'émet pas de data part finale après le stream de texte — c'est l'état
 * du message côté client qui fait foi.
 */
export function finalizeResearchTimeline(data: ResearchTimelineData): ResearchTimelineData {
  return {
    ...data,
    phase: 'done',
    steps: data.steps.map((s) => ({ ...s, status: 'done' as const })),
  };
}

// ── Enrichissement des fiches sources (métadonnées réelles Europe PMC) ────────

interface SourceLike {
  url?: string | null;
  title?: string | null;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

/**
 * Retrouve l'article réel correspondant à une source citée : par URL exacte, puis par
 * DOI/PMID contenu dans l'URL de la source. null si aucun rapprochement sûr — on
 * n'enrichit jamais une fiche avec les métadonnées d'un autre article.
 */
export function matchArticleForSource(
  source: SourceLike | null | undefined,
  articles: readonly ResearchArticle[] | null | undefined,
): ResearchArticle | null {
  if (!source?.url || !Array.isArray(articles) || articles.length === 0) return null;
  const url = normalizeUrl(source.url);
  for (const a of articles) {
    if (a.url && normalizeUrl(a.url) === url) return a;
  }
  for (const a of articles) {
    if (a.doi && url.includes(a.doi.toLowerCase())) return a;
    if (a.pmid && /pubmed\.ncbi\.nlm\.nih\.gov|europepmc\.org/.test(url) && url.includes(`/${a.pmid}`))
      return a;
  }
  return null;
}

/** Une URL a-t-elle été vérifiée OK pendant la recherche ? (pastille « lien vérifié ») */
export function isVerifiedUrl(
  url: string | null | undefined,
  verifiedUrls: readonly string[] | null | undefined,
): boolean {
  if (!url || !Array.isArray(verifiedUrls)) return false;
  const target = normalizeUrl(url);
  return verifiedUrls.some((v) => normalizeUrl(v) === target);
}

/** Domaine lisible d'une URL (« has-sante.fr ») pour les fiches sources ; null si invalide. */
export function domainOfUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

// ── Détection des recherches web provider (onStepFinish) ─────────────────────

const WEB_SEARCH_TOOL_NAMES = new Set(['web_search', 'google_search', 'web_search_preview']);

interface StepLike {
  toolCalls?: unknown;
  content?: unknown;
}

/**
 * Nombre d'appels de recherche web (outil exécuté par le provider) dans une étape de la
 * boucle — ces appels ne passent pas par nos hooks d'outils. Défensif sur la forme des
 * steps (elle varie selon la version de l'AI SDK, comme stepMetrics).
 */
export function webSearchCallsOfStep(step: unknown): number {
  if (step == null || typeof step !== 'object') return 0;
  const s = step as StepLike;
  let count = 0;
  const fromCalls = Array.isArray(s.toolCalls) ? s.toolCalls : [];
  for (const call of fromCalls) {
    const name = (call as { toolName?: unknown } | null)?.toolName;
    if (typeof name === 'string' && WEB_SEARCH_TOOL_NAMES.has(name)) count++;
  }
  if (count > 0) return count;
  const content = Array.isArray(s.content) ? s.content : [];
  for (const part of content) {
    const p = part as { type?: unknown; toolName?: unknown } | null;
    if (p?.type === 'tool-call' && typeof p.toolName === 'string' && WEB_SEARCH_TOOL_NAMES.has(p.toolName)) {
      count++;
    }
  }
  return count;
}
