/**
 * Diagramme natif du chat (2026-07) — parseur PUR, sans dépendance.
 *
 * Le modèle peut inclure un schéma dans sa réponse via un bloc de code balisé
 * ```medinfo-diagram … ``` contenant un JSON simple (nœuds + branches). Ce module
 * valide/normalise ce JSON en une structure sûre, et sait le retrouver dans un texte
 * assistant. Le RENDU (boîtes + connecteurs) est cross-platform (src/ui/chat/DiagramView.tsx) ;
 * ici, zéro React, zéro réseau — juste du parsing bornant (anti-abus).
 *
 * Choix produit : format maison volontairement simple (flux vertical avec décisions),
 * rendu identique web ET mobile, plutôt qu'une dépendance de diagramme lourde et web-only.
 */
export type DiagramNodeKind = 'start' | 'step' | 'decision' | 'end';

export interface DiagramBranch {
  label: string;
  text: string;
}

export interface DiagramNode {
  kind: DiagramNodeKind;
  text: string;
  branches?: DiagramBranch[];
}

export interface DiagramSpec {
  title: string | null;
  nodes: DiagramNode[];
}

const NODE_KINDS: DiagramNodeKind[] = ['start', 'step', 'decision', 'end'];

/** Bornes anti-abus (le modèle est cadré, mais on ne fait jamais confiance à l'entrée). */
const MAX_NODES = 12;
const MAX_BRANCHES = 4;
const MAX_TEXT = 160;
const MAX_LABEL = 40;
const MAX_TITLE = 120;

function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

function coerceBranch(raw: unknown): DiagramBranch | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const text = clean(obj.text, MAX_TEXT);
  if (!text) return null;
  return { label: clean(obj.label, MAX_LABEL), text };
}

function coerceNode(raw: unknown): DiagramNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const kind = NODE_KINDS.includes(obj.kind as DiagramNodeKind)
    ? (obj.kind as DiagramNodeKind)
    : 'step';
  const text = clean(obj.text, MAX_TEXT);
  if (!text) return null;
  const node: DiagramNode = { kind, text };
  if (kind === 'decision' && Array.isArray(obj.branches)) {
    const branches = obj.branches
      .map(coerceBranch)
      .filter((b): b is DiagramBranch => b !== null)
      .slice(0, MAX_BRANCHES);
    if (branches.length > 0) node.branches = branches;
  }
  return node;
}

/** Valide/normalise un objet (déjà parsé) en DiagramSpec, ou null si inexploitable. */
export function coerceDiagramSpec(raw: unknown): DiagramSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.nodes)) return null;
  const nodes = obj.nodes
    .map(coerceNode)
    .filter((n): n is DiagramNode => n !== null)
    .slice(0, MAX_NODES);
  if (nodes.length === 0) return null;
  const title = clean(obj.title, MAX_TITLE);
  return { title: title || null, nodes };
}

/** Parse le contenu JSON d'un bloc ```medinfo-diagram``` → DiagramSpec | null. */
export function parseDiagramSpec(jsonBody: string): DiagramSpec | null {
  const trimmed = jsonBody.trim();
  if (!trimmed) return null;
  try {
    return coerceDiagramSpec(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

/** Marqueur de bloc diagramme dans le texte assistant. */
export const DIAGRAM_FENCE = 'medinfo-diagram';

// Bloc ```medinfo-diagram … ``` (tolère espaces après le langage et fin de texte sans newline).
const DIAGRAM_BLOCK_RE = /```medinfo-diagram[^\n]*\n([\s\S]*?)```/g;

export interface DiagramExtraction {
  /** Texte sans les blocs diagramme (remplacés par un marqueur ⟦DIAGRAM:n⟧). */
  text: string;
  /** Diagrammes valides, dans l'ordre d'apparition. */
  diagrams: DiagramSpec[];
}

/** Jeton de remplacement d'un diagramme dans le flux texte (index = position dans `diagrams`). */
export function diagramPlaceholder(index: number): string {
  return `⟦DIAGRAM:${index}⟧`;
}

/**
 * Extrait les blocs diagramme d'un texte assistant : renvoie le texte avec chaque bloc
 * VALIDE remplacé par un marqueur `⟦DIAGRAM:n⟧`, et la liste des diagrammes. Un bloc
 * invalide (JSON cassé, vide) est simplement retiré (jamais affiché en JSON brut).
 */
export function extractDiagrams(text: string): DiagramExtraction {
  const diagrams: DiagramSpec[] = [];
  const out = text.replace(DIAGRAM_BLOCK_RE, (_match, body: string) => {
    const spec = parseDiagramSpec(body);
    if (!spec) return ''; // bloc inexploitable : on l'efface, jamais de JSON brut à l'écran
    diagrams.push(spec);
    return diagramPlaceholder(diagrams.length - 1);
  });
  return { text: out, diagrams };
}

/**
 * Remplace chaque bloc ```medinfo-diagram``` par sa version TEXTE (export PDF / copie).
 * Un bloc invalide est retiré. Sert au « texte propre » partagé Copier/export.
 */
export function replaceDiagramsWithText(text: string): string {
  return text.replace(DIAGRAM_BLOCK_RE, (_match, body: string) => {
    const spec = parseDiagramSpec(body);
    return spec ? diagramToText(spec) : '';
  });
}

/**
 * Représentation TEXTE d'un diagramme (export PDF / copie) : un plan lisible, puisque
 * le rendu graphique n'existe pas hors de l'app.
 */
export function diagramToText(spec: DiagramSpec): string {
  const lines: string[] = [];
  if (spec.title) lines.push(spec.title);
  spec.nodes.forEach((node, i) => {
    lines.push(`${i + 1}. ${node.text}`);
    if (node.branches) {
      for (const branch of node.branches) {
        lines.push(`   - ${branch.label ? `${branch.label} : ` : ''}${branch.text}`);
      }
    }
  });
  return lines.join('\n');
}
