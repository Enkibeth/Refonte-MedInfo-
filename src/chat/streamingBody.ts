/** Découpe append-only : seul le bloc ouvert est relu à chaque fragment. */
export interface StreamingBody {
  source: string;
  chunks: readonly string[];
  pending: string;
  deferred: string | null;
}
export const EMPTY_STREAMING_BODY: StreamingBody = { source: '', chunks: [], pending: '', deferred: null };
const SECTION = /^(?:SOURCES(?: UTILISÉES)?|APPROFONDISSEMENTS|QUESTIONS_PATIENT|INTERACTION|AUTO[-\s]?R[ÉE]FLEXION)\s*$/;

export function advanceStreamingBody(previous: StreamingBody, text: string, done: boolean): StreamingBody {
  const base = text.startsWith(previous.source) ? previous : EMPTY_STREAMING_BODY;
  const delta = text.slice(base.source.length);
  if (base.deferred !== null) return { ...base, source: text, deferred: base.deferred + delta };
  let pending = base.pending + delta;
  let chunks = base.chunks;
  let deferred: string | null = null;
  let fenced = false;
  let cursor = 0;
  let start = 0;
  for (const line of pending.split('\n')) {
    const end = cursor + line.length;
    const complete = end < pending.length || done;
    if (!complete) break;
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) fenced = !fenced;
    if (!fenced && (SECTION.test(trimmed) || /^<!--\s*CALC:/.test(trimmed))) {
      const body = pending.slice(start, cursor);
      if (body.trim()) chunks = [...chunks, body];
      deferred = pending.slice(cursor);
      start = pending.length;
      break;
    }
    if (!fenced && trimmed === '') {
      const body = pending.slice(start, end + 1);
      if (body.trim()) chunks = [...chunks, body];
      start = end + 1;
    }
    cursor = end + 1;
  }
  pending = pending.slice(start);
  if (done && pending.trim()) { chunks = [...chunks, pending]; pending = ''; }
  return { source: text, chunks, pending, deferred };
}

/** Les tableaux/fences et marqueurs techniques incomplets attendent leur fermeture. */
export function visibleStreamingTail(pending: string): string {
  const first = pending.trimStart();
  if (/^(?:\||`|~|<!--)/.test(first)) return '';
  const headings = ['SOURCES', 'APPROFONDISSEMENTS', 'QUESTIONS_PATIENT', 'INTERACTION', 'AUTO-RÉFLEXION'];
  if (headings.some(h => h.startsWith(first.trim()) || first.startsWith(h))) return '';
  // N’affiche pas une syntaxe partielle qui se transformerait ensuite en lien/code/gras.
  let end = pending.length;
  const partialCitation = pending.match(/\(?SRC\d*$/);
  if (partialCitation) end = Math.min(end, partialCitation.index!);
  const openLink = pending.lastIndexOf('[');
  if (openLink >= 0 && !pending.slice(openLink).includes(')')) end = Math.min(end, openLink);
  for (const marker of ['**', '`']) {
    const pieces = pending.split(marker);
    if (pieces.length % 2 === 0) end = Math.min(end, pending.lastIndexOf(marker));
  }
  if (/^#{1,3}$/.test(first.trim()) || /^\d+[.)]?$/.test(first.trim())) return '';
  return pending.slice(0, end);
}
