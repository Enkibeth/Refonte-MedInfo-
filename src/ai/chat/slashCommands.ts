/**
 * Commandes « / » du composeur (2026-10, ADR-0044) — lanceur d'outils DÉTERMINISTE.
 *
 * `/ecos cardiologie`, `/score HAS-BLED`, `/partiels`, `/présentation fibrillation atriale`…
 * ouvrent l'outil tout de suite, sans appel au modèle : le chemin rapide de l'utilisateur
 * qui sait ce qu'il veut. Même résultat qu'une carte d'action (même relais, même paramètre
 * borné), et même cloisonnement : seuls les outils ouverts au rôle sont proposés.
 *
 * ⚠️ Module PUR (aucune dépendance UI) : tests/unit/chat-slash-commands.test.ts.
 */
import {
  cleanModuleActionParam,
  moduleActionCard,
  type ChatModuleAction,
  type ModuleActionTool,
} from '@/ai/chat/moduleActions';

export interface SlashCommandSpec {
  tool: ModuleActionTool;
  /** Nom affiché, sans la barre (« ecos »). */
  command: string;
  /** Autres noms acceptés (accents et casse ignorés). */
  aliases: string[];
  /** Indication du paramètre (« spécialité »), null si l'outil n'en prend pas. */
  argHint: string | null;
  /** Libellé court du menu (tient sur une ligne de téléphone à côté de la commande). */
  label: string;
}

const COMMANDS: SlashCommandSpec[] = [
  { tool: 'partiel', command: 'partiels', aliases: ['partiel', 'notes', 'classement', 'rang'], argHint: null, label: 'Mes partiels' },
  { tool: 'ecos', command: 'ecos', aliases: ['station'], argHint: 'spécialité', label: 'Station ECOS' },
  { tool: 'scores', command: 'score', aliases: ['scores', 'calcul', 'calculer'], argHint: 'nom', label: 'Score clinique' },
  { tool: 'revision', command: 'révisions', aliases: ['revision', 'planning', 'planifier'], argHint: null, label: 'Planning' },
  { tool: 'presentation', command: 'présentation', aliases: ['presentations', 'slides', 'diapo', 'diapos', 'diaporama'], argHint: 'sujet', label: 'Diapositives' },
  { tool: 'article', command: 'article', aliases: ['these', 'abstract', 'redaction', 'manuscrit'], argHint: null, label: 'Rédaction' },
  { tool: 'cv-builder', command: 'cv', aliases: ['curriculum'], argHint: null, label: 'CV médical' },
  { tool: 'document', command: 'document', aliases: ['doc', 'ordonnance', 'analyse'], argHint: null, label: 'Analyse de document' },
  { tool: 'audio', command: 'audio', aliases: ['dictee', 'consultation', 'compte-rendu'], argHint: null, label: 'Compte rendu' },
];

/** Nombre maximal de suggestions affichées. */
export const SLASH_SUGGESTIONS_MAX = 9;

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Découpe une saisie commençant par « / » : nom de commande et argument. Null sinon. */
export function splitSlashInput(input: string): { name: string; arg: string; hasSpace: boolean } | null {
  if (!input.startsWith('/') || input.startsWith('//')) return null;
  const body = input.slice(1);
  const match = body.match(/^(\S*)(\s+([\s\S]*))?$/);
  if (!match) return null;
  return { name: fold(match[1]), arg: (match[3] ?? '').trim(), hasSpace: match[2] !== undefined };
}

function namesOf(spec: SlashCommandSpec): string[] {
  return [spec.command, ...spec.aliases].map(fold);
}

/** Commandes ouvertes à ce rôle, dans l'ordre du registre. */
export function slashCommandsFor(tools: ModuleActionTool[]): SlashCommandSpec[] {
  return COMMANDS.filter((c) => tools.includes(c.tool));
}

/**
 * Suggestions à afficher pendant la saisie : toutes les commandes après « / » seul, celles
 * dont un nom commence par ce qui est tapé, puis, une fois l'argument commencé, la seule
 * commande reconnue (pour rappeler ce qu'elle attend).
 */
export function slashSuggestions(input: string, tools: ModuleActionTool[]): SlashCommandSpec[] {
  const parsed = splitSlashInput(input);
  if (!parsed) return [];
  const available = slashCommandsFor(tools);
  if (parsed.hasSpace) {
    const exact = available.find((c) => namesOf(c).includes(parsed.name));
    return exact ? [exact] : [];
  }
  if (!parsed.name) return available.slice(0, SLASH_SUGGESTIONS_MAX);
  const starts = available.filter((c) => namesOf(c).some((n) => n.startsWith(parsed.name)));
  const contains = available.filter((c) => !starts.includes(c) && namesOf(c).some((n) => n.includes(parsed.name)));
  return [...starts, ...contains].slice(0, SLASH_SUGGESTIONS_MAX);
}

/**
 * Commande complète prête à exécuter (nom exact d'un outil ouvert au rôle), ou null : une
 * saisie qui ne correspond à rien reste un message ordinaire.
 */
export function parseSlashCommand(input: string, tools: ModuleActionTool[]): ChatModuleAction | null {
  const parsed = splitSlashInput(input.trim());
  if (!parsed || !parsed.name) return null;
  const spec = slashCommandsFor(tools).find((c) => namesOf(c).includes(parsed.name));
  if (!spec) return null;
  return { tool: spec.tool, param: spec.argHint ? cleanModuleActionParam(parsed.arg) : null };
}

/** Saisie à proposer quand on choisit une suggestion qui attend un paramètre. */
export function slashCompletion(spec: SlashCommandSpec): string {
  return `/${spec.command} `;
}

/** Libellé complet de la suggestion (celui de la carte d'action, pour les lecteurs d'écran). */
export function slashLabel(spec: SlashCommandSpec): string {
  return moduleActionCard({ tool: spec.tool, param: null }).title;
}

const EXAMPLES: Partial<Record<ModuleActionTool, string>> = {
  ecos: '/ecos cardiologie',
  scores: '/score HAS-BLED',
  partiel: '/partiels',
  presentation: '/présentation asthme',
  revision: '/révisions',
  document: '/document',
  audio: '/audio',
};

/** Deux exemples de commandes pour l'astuce de l'état vide (outils du rôle seulement). */
export function slashExamples(tools: ModuleActionTool[]): string[] {
  return slashCommandsFor(tools)
    .map((c) => EXAMPLES[c.tool])
    .filter((e): e is string => !!e)
    .slice(0, 2);
}
