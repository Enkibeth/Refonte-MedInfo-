/**
 * Déroulé vertical de la génération d'une réponse du chat (2026-10, demande Hugo :
 * « savoir où elle en est, quelles sources elle consulte »).
 *
 * La timeline « Étapes » d'avant (ADR-0037, retirée avec la boucle agentique) racontait
 * les outils serveur. Il n'y a plus qu'UN appel LLM, mais il produit encore une trace
 * RÉELLE dans le flux, que ce module met en forme dans l'ordre où elle arrive :
 *
 *   - les parts `reasoning` : résumés de réflexion du modèle (OpenAI `reasoningSummary`,
 *     réflexion Claude) — on en garde le titre, jamais un texte inventé ;
 *   - les parts `tool-web_search` (recherche du provider, exécutée DANS l'appel) : une fois
 *     terminées, elles portent l'action exacte — requêtes tapées (`search`), page ouverte
 *     (`openPage`), motif cherché dans une page (`findInPage`) — et les URL consultées ;
 *   - les parts `source-url` : sources effectivement citées dans la réponse ;
 *   - la première part `text` non vide : début de la rédaction.
 *
 * Aucune étape « à venir » n'est affichée : on ne montre que ce qui s'est produit. Seule
 * concession, l'étape active de repli (« Analyse des résultats ») entre deux événements,
 * quand le modèle travaille sans encore rien émettre — sinon l'écran semblerait figé.
 *
 * Module PUR (aucune dépendance UI/réseau), défensif sur la forme des parts (elle varie
 * selon le provider et la version de l'AI SDK) : testé dans tests/unit/chat-research-timeline.test.ts.
 */

export type TimelineStepKind = 'analyze' | 'think' | 'search' | 'read' | 'find' | 'write';
export type TimelineStepStatus = 'done' | 'active' | 'error';

export interface TimelineSource {
  url: string;
  /** Domaine lisible (sans « www. »). */
  domain: string;
}

export interface TimelineStep {
  id: string;
  kind: TimelineStepKind;
  status: TimelineStepStatus;
  title: string;
  /** Précision courte (titre du résumé de réflexion, motif cherché, sources citées…). */
  detail?: string;
  /** Requêtes réellement envoyées au moteur de recherche. */
  queries: string[];
  /** Pages consultées par cette étape. */
  sources: TimelineSource[];
}

export interface ResearchTimelineView {
  steps: TimelineStep[];
  /** Nombre d'actions de recherche (requêtes, ouvertures de page, recherches dans une page). */
  searchCount: number;
  /** Nombre de pages distinctes consultées. */
  sourceCount: number;
  /** Nombre de sources distinctes citées dans la réponse. */
  citedCount: number;
  /** La rédaction a commencé (premier fragment de texte reçu). */
  writing: boolean;
}

const WEB_TOOLS = new Set(['web_search', 'web_search_preview', 'google_search']);

type AnyPart = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Nom d'outil d'une part (`tool-<name>` ou `dynamic-tool` + `toolName`), sinon null. */
function toolName(part: AnyPart): string | null {
  const type = str(part.type);
  if (type === 'dynamic-tool') return str(part.toolName) || null;
  if (type.startsWith('tool-')) return type.slice(5) || null;
  return null;
}

/** Domaine d'une URL http(s), sans « www. » ; null si l'URL n'est pas exploitable. */
export function domainOf(url: string): string | null {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, '') || null;
  } catch {
    return null;
  }
}

/** URL nettoyée des traceurs ajoutés par le provider (`utm_source=openai`). */
export function cleanSourceUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(key)) u.searchParams.delete(key);
    }
    return u.toString().replace(/\?$/, '');
  } catch {
    return url;
  }
}

function toSource(url: unknown): TimelineSource | null {
  const raw = str(url).trim();
  if (!raw) return null;
  const domain = domainOf(raw);
  return domain ? { url: cleanSourceUrl(raw), domain } : null;
}

function compact(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Titre d'un résumé de réflexion : le premier intertitre en gras (« **Searching medical
 * sources** », format des résumés OpenAI), sinon la première phrase, bornée.
 */
export function reasoningHeadline(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const bold = /\*\*([^*\n]{2,120})\*\*/.exec(t);
  if (bold) return compact(bold[1], 90);
  const firstSentence = t.split(/(?<=[.!?])\s|\n/)[0] ?? t;
  return compact(firstSentence.replace(/[*_#`]/g, ''), 90);
}

function pushUnique(list: TimelineSource[], source: TimelineSource | null) {
  if (source && !list.some((s) => s.url === source.url)) list.push(source);
}

/**
 * Construit le déroulé à partir des `parts` du message assistant.
 * `finished` : le tour est terminé (plus d'étape active, la rédaction est faite).
 */
export function buildResearchTimeline(
  parts: unknown,
  opts: { finished?: boolean } = {},
): ResearchTimelineView {
  const finished = opts.finished === true;
  const list: AnyPart[] = Array.isArray(parts)
    ? parts.filter((p): p is AnyPart => p != null && typeof p === 'object')
    : [];

  const steps: TimelineStep[] = [];
  const consulted = new Set<string>();
  const cited = new Set<string>();
  let searchCount = 0;
  let writing = false;

  const add = (step: Omit<TimelineStep, 'id' | 'queries' | 'sources'> & Partial<TimelineStep>) => {
    steps.push({ queries: [], sources: [], ...step, id: `${step.kind}-${steps.length}` });
  };

  for (const part of list) {
    const type = str(part.type);

    if (type === 'reasoning') {
      const headline = reasoningHeadline(str(part.text));
      const streaming = part.state === 'streaming';
      const prev = steps[steps.length - 1];
      // Un même bloc de réflexion arrive souvent en plusieurs résumés consécutifs : une
      // seule étape, dont le titre suit le dernier résumé reçu.
      if (prev && (prev.kind === 'think' || prev.kind === 'analyze') && !writing) {
        if (headline) prev.detail = headline;
        prev.status = streaming ? 'active' : 'done';
        continue;
      }
      if (writing) continue;
      add({
        kind: steps.length === 0 ? 'analyze' : 'think',
        status: streaming ? 'active' : 'done',
        title: steps.length === 0 ? 'Analyse de la question' : 'Réflexion',
        ...(headline ? { detail: headline } : {}),
      });
      continue;
    }

    const name = toolName(part);
    if (name && WEB_TOOLS.has(name)) {
      if (steps.length === 0) add({ kind: 'analyze', status: 'done', title: 'Analyse de la question' });
      const state = str(part.state);
      if (state === 'output-error' || state === 'output-denied') {
        add({ kind: 'search', status: 'error', title: 'Recherche interrompue' });
        continue;
      }
      if (state !== 'output-available') {
        // La requête n'est connue qu'à la fin de l'action (le provider ne la diffuse pas
        // avant) : libellé générique tant qu'elle tourne.
        add({ kind: 'search', status: 'active', title: 'Recherche sur Internet' });
        continue;
      }
      searchCount += 1;
      const output = (part.output ?? {}) as AnyPart;
      const action = (output.action ?? {}) as AnyPart;
      const sources: TimelineSource[] = [];
      for (const s of Array.isArray(output.sources) ? output.sources : []) {
        if (s && typeof s === 'object') pushUnique(sources, toSource((s as AnyPart).url));
      }
      const actionType = str(action.type);
      if (actionType === 'openPage') {
        pushUnique(sources, toSource(action.url));
        add({ kind: 'read', status: 'done', title: 'Lecture d’une page', sources });
      } else if (actionType === 'findInPage') {
        pushUnique(sources, toSource(action.url));
        const pattern = compact(str(action.pattern), 60);
        add({
          kind: 'find',
          status: 'done',
          title: 'Recherche dans la page',
          ...(pattern ? { detail: `« ${pattern} »` } : {}),
          sources,
        });
      } else {
        const queries: string[] = [];
        const rawQueries = Array.isArray(action.queries) ? action.queries : [];
        for (const q of [str(action.query), ...rawQueries.map(str)]) {
          const c = compact(q, 140);
          if (c && !queries.includes(c)) queries.push(c);
        }
        add({ kind: 'search', status: 'done', title: 'Recherche sur Internet', queries, sources });
      }
      for (const s of sources) consulted.add(s.url);
      continue;
    }

    if (type === 'source-url') {
      const source = toSource(part.url);
      if (source) cited.add(source.url);
      continue;
    }

    if (type === 'text' && str(part.text).trim() && !writing) {
      if (steps.length === 0) add({ kind: 'analyze', status: 'done', title: 'Analyse de la question' });
      writing = true;
      add({ kind: 'write', status: 'active', title: 'Rédaction de la réponse' });
    }
  }

  if (finished) {
    for (const s of steps) if (s.status === 'active') s.status = 'done';
  } else if (!writing) {
    const last = steps[steps.length - 1];
    if (!last) {
      add({ kind: 'analyze', status: 'active', title: 'Analyse de la question' });
    } else if (last.status !== 'active') {
      // Le modèle travaille entre deux événements sans rien émettre : jamais d'écran figé.
      add({
        kind: 'think',
        status: 'active',
        title: searchCount > 0 ? 'Analyse des résultats' : 'Réflexion',
      });
    }
  }

  // Une étape antérieure à l'étape active est forcément terminée (le flux est séquentiel) :
  // une part restée « streaming » ne doit pas laisser deux pastilles actives à l'écran.
  const activeIndex = steps.map((s) => s.status).lastIndexOf('active');
  steps.forEach((s, i) => {
    if (i < activeIndex && s.status === 'active') s.status = 'done';
  });

  const write = steps.find((s) => s.kind === 'write');
  if (write && cited.size > 0) {
    write.detail = `${cited.size} source${cited.size > 1 ? 's' : ''} citée${cited.size > 1 ? 's' : ''}`;
  }

  return { steps, searchCount, sourceCount: consulted.size, citedCount: cited.size, writing };
}

/** Le déroulé a-t-il quelque chose à raconter au-delà de « analyse → rédaction » ? */
export function hasResearchTrace(view: ResearchTimelineView): boolean {
  return view.searchCount > 0 || view.steps.some((s) => s.kind === 'think' || Boolean(s.detail && s.kind === 'analyze'));
}

/** Résumé une ligne pour l'en-tête replié (« 3 recherches · 14 pages consultées »). */
export function researchSummaryLine(view: ResearchTimelineView): string {
  const parts: string[] = [];
  if (view.searchCount > 0) {
    parts.push(`${view.searchCount} recherche${view.searchCount > 1 ? 's' : ''}`);
  }
  if (view.sourceCount > 0) {
    parts.push(`${view.sourceCount} page${view.sourceCount > 1 ? 's' : ''} consultée${view.sourceCount > 1 ? 's' : ''}`);
  }
  if (parts.length === 0) parts.push(`${view.steps.length} étape${view.steps.length > 1 ? 's' : ''}`);
  return parts.join(' · ');
}
