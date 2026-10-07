import {
  isSectionHeadingPrefix,
  isStudentFollowupMarker,
  isStudentFollowupMarkerPrefix,
  sectionKindOf,
} from '@/ai/chat/parseAssistantMessage';

/** Découpe append-only : seul le bloc ouvert est relu à chaque fragment. */
export interface StreamingBody {
  source: string;
  chunks: readonly string[];
  pending: string;
  deferred: string | null;
}
export const EMPTY_STREAMING_BODY: StreamingBody = { source: '', chunks: [], pending: '', deferred: null };

// Marqueurs d'interface sur leur propre ligne (scores suggérés, cartes d'outil — ADR-0044) :
// la suite est rendue d'un bloc, par le parseur structuré, une fois la réponse complète.
const INTERFACE_MARKER_START = /^<!(?:--|—|–|-)\s*(?:CALC|OUTIL)\s*:/i;
const NUMBERED_LINE = /^\d+[.)]\s+\S/;

/**
 * Début de la série finale de lignes numérotées d'un bloc (`1. …` jusqu'à la fin), ou -1.
 * Ce sont les candidates aux relances étudiantes, qui partent avec le marqueur `[1] + [2] + [3]`.
 */
function trailingNumberedRun(block: string): number {
  const lines = block.split('\n');
  let offset = block.length;
  let runStart = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    offset -= lines[i].length + (i < lines.length - 1 ? 1 : 0);
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (!NUMBERED_LINE.test(trimmed)) break;
    runStart = offset;
  }
  return runStart;
}

/**
 * Première ligne non vide à partir de `from` : `null` si rien n'est encore arrivé,
 * `complete` faux tant que sa fin de ligne n'est pas reçue.
 */
function nextContentLine(pending: string, from: number, done: boolean): { text: string; complete: boolean } | null {
  let cursor = from;
  while (cursor <= pending.length) {
    const newline = pending.indexOf('\n', cursor);
    const end = newline < 0 ? pending.length : newline;
    const text = pending.slice(cursor, end).trim();
    if (text) return { text, complete: newline >= 0 || done };
    if (newline < 0) return null;
    cursor = newline + 1;
  }
  return null;
}

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
    if (!fenced) {
      const marker = isStudentFollowupMarker(trimmed);
      if (marker || sectionKindOf(trimmed) || INTERFACE_MARKER_START.test(trimmed)) {
        // Relances étudiantes : la liste numérotée encore ouverte part avec le marqueur,
        // pour être rendue une seule fois, en propositions à cocher.
        const run = marker ? trailingNumberedRun(pending.slice(start, cursor)) : -1;
        const from = run >= 0 ? start + run : cursor;
        const body = pending.slice(start, from);
        if (body.trim()) chunks = [...chunks, body];
        deferred = pending.slice(from);
        start = pending.length;
        break;
      }
      if (trimmed === '') {
        const body = pending.slice(start, end + 1);
        // Une liste numérotée reste ouverte tant que la ligne suivante peut encore être le
        // marqueur des relances : elle ne sera jamais close puis retirée.
        const next = trailingNumberedRun(body) >= 0 ? nextContentLine(pending, end + 1, done) : undefined;
        const hold =
          next !== undefined &&
          (next === null
            ? !done
            : next.complete
              ? isStudentFollowupMarker(next.text)
              : isStudentFollowupMarkerPrefix(next.text));
        if (!hold) {
          if (body.trim()) chunks = [...chunks, body];
          start = end + 1;
        }
      }
    }
    cursor = end + 1;
  }
  pending = pending.slice(start);
  if (done && pending.trim()) { chunks = [...chunks, pending]; pending = ''; }
  return { source: text, chunks, pending, deferred };
}

/** Position de la première parenthèse restée ouverte, ou -1. */
function firstUnclosedParen(text: string): number {
  const open: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') open.push(i);
    else if (text[i] === ')') open.pop();
  }
  return open.length > 0 ? open[0] : -1;
}

/**
 * Partie affichable du bloc ouvert. Tableaux, fences et marqueurs techniques attendent
 * leur fermeture ; une syntaxe inline incomplète (lien, gras, code, appel de note) n'est
 * jamais montrée sous une forme qui changerait ensuite.
 */
export function visibleStreamingTail(pending: string): string {
  let end = pending.length;

  // Blocs qui n'ont de sens qu'une fois fermés : rien à partir de leur première ligne.
  let lineStart = 0;
  for (const line of pending.split('\n')) {
    if (/^\s*(?:\||```|~~~|<!(?:--|—|–))/.test(line)) {
      end = lineStart;
      break;
    }
    lineStart += line.length + 1;
  }

  // Dernière ligne encore incomplète : titre de section, relances, commentaire, début de fence,
  // `#`, puce ou numéro encore seuls.
  const lastStart = pending.lastIndexOf('\n') + 1;
  const last = pending.slice(lastStart).trim();
  if (
    last &&
    (isSectionHeadingPrefix(last) ||
      isStudentFollowupMarkerPrefix(last) ||
      '<!--'.startsWith(last) ||
      /^<!—$/.test(last) ||
      /^(?:#{1,6}|`+|~+|[-*+•]|\d+[.)]?)$/.test(last))
  ) {
    end = Math.min(end, lastStart);
  }

  const visible = pending.slice(0, end);
  let cut = visible.length;
  // Appel de note en cours (« (SRC1, SRC », « selon SR ») et parenthèse encore ouverte :
  // « (Classe I · SRC1) » deviendra « (Classe I)¹ », jamais « (Classe I · ¹ ».
  const partialCitation = visible.match(/\bS(?:R(?:C\d*)?)?$/);
  if (partialCitation) cut = Math.min(cut, partialCitation.index!);
  const paren = firstUnclosedParen(visible);
  if (paren >= 0) cut = Math.min(cut, paren);
  // Lien en cours : libellé non fermé, libellé fermé en fin de texte (peut recevoir son URL),
  // URL non fermée. Un crochet déjà fermé suivi de texte (« [à vérifier] ») reste visible.
  const bracket = visible.lastIndexOf('[');
  if (bracket >= 0) {
    const rest = visible.slice(bracket);
    if (!rest.includes(']') || /^\[[^\]]*\]$/.test(rest) || /^\[[^\]]*\]\([^)]*$/.test(rest)) {
      cut = Math.min(cut, bracket);
    }
  }
  for (const marker of ['**', '`']) {
    const pieces = visible.split(marker);
    if (pieces.length % 2 === 0) cut = Math.min(cut, visible.lastIndexOf(marker));
  }
  // Marqueur d'interface glissé en milieu de ligne (« … <!--OUTIL:ecos-->») : rien de lui ne
  // s'affiche, ni pendant qu'il arrive (« <!--OUTI », « <!- ») ni une fois fermé (retiré au rendu).
  let comment = -1;
  for (const m of visible.matchAll(/<!(?:--|—|–)/g)) comment = m.index ?? comment;
  if (comment >= 0 && !/(?:>|→|⟶)/.test(visible.slice(comment))) cut = Math.min(cut, comment);
  const commentStart = visible.match(/<!?[-—–]?$/);
  if (commentStart) cut = Math.min(cut, commentStart.index!);
  return visible.slice(0, cut);
}
