/**
 * Texte de refus de la garde d'entrée (ADR-0029) — TEXTE PUR, au format du
 * contrat de sortie v3 : le refus canonique verbatim (source unique,
 * src/compliance/disclosures.ts) + une section INTERACTION d'options cliquables
 * parsée nativement par parseAssistantMessage (aucun changement UI).
 *
 * UX : un refus n'est jamais un cul-de-sac. Chaque option est une QUESTION
 * d'information générale que l'utilisateur peut envoyer telle quelle — soit
 * reformulée par l'étage 2 à partir de sa question, soit générique en repli.
 * Jamais de conseil individualisé dans les options (non-MDSW).
 */
import { CANONICAL_REFUSAL } from '@/compliance/disclosures';
import type { GuardCategory } from './types';

/** Options génériques de repli quand l'étage 2 n'a pas fourni de reformulations. */
const FALLBACK_OPTIONS = [
  'Quand faut-il consulter un médecin pour ce type de symptômes ?',
  'Comment se préparer à une consultation médicale ?',
];

const EMERGENCY_OPTIONS = [
  'Quels signes doivent faire appeler le 15 ou le 112 ?',
  'Poser une question d’information générale',
];

function interactionSection(options: string[]): string {
  const lines = options
    .map((option) => option.replace(/[[\]\r\n]/g, ' ').trim())
    .filter((option) => option.length > 0)
    .slice(0, 3)
    .map((option) => `[${option}]`);
  if (lines.length === 0) return '';
  return `\n\nINTERACTION\n${lines.join('\n')}`;
}

export function buildRefusalText(
  category: GuardCategory,
  opts: { reformulations?: string[] } = {},
): string {
  if (category === 'emergency') {
    return (
      `**Si c’est une urgence, appelez le 15 (SAMU) ou le 112 dès maintenant.**\n\n` +
      CANONICAL_REFUSAL +
      interactionSection(EMERGENCY_OPTIONS)
    );
  }

  const reformulations = (opts.reformulations ?? []).filter((q) => q.trim().length >= 8);
  const options = reformulations.length > 0 ? reformulations : FALLBACK_OPTIONS;
  return (
    CANONICAL_REFUSAL +
    `\n\nVous pouvez en revanche me poser la question sous forme d’information générale :` +
    interactionSection(options)
  );
}
