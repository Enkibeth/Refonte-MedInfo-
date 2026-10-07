/**
 * Passerelle ECOS → chat (ADR-0044) : après l'évaluation d'une station, l'étudiant peut la
 * retravailler avec le chatbot étudiant. Message PRÉ-REMPLI (jamais envoyé d'office) : la
 * station est fictive et l'évaluation pédagogique ; la transcription de la simulation,
 * elle, n'est jamais reprise (elle n'est conservée nulle part, ADR-0032).
 *
 * ⚠️ Module PUR : tests/unit/ecos-chat-debrief.test.ts.
 */

/** Part de l'évaluation reprise dans le message (le reste du message tient en 1 000 car.). */
export const DEBRIEF_EVALUATION_MAX_CHARS = 4500;

const NBSP = ' ';

function oneLine(text: string, max: number): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Message prêt à relire dans le chat, ou null sans évaluation exploitable. */
export function ecosDebriefMessage(input: {
  title: string;
  specialty?: string | null;
  score?: number | null;
  evaluation: string;
}): string | null {
  const evaluation = (input.evaluation || '').trim();
  if (!evaluation) return null;
  const title = oneLine(input.title || 'sans titre', 140);
  const specialty = input.specialty ? oneLine(input.specialty, 80) : '';
  const score =
    typeof input.score === 'number' && Number.isFinite(input.score)
      ? ` Ma note${NBSP}: ${String(input.score).replace('.', ',')}/20.`
      : '';
  const clipped =
    evaluation.length > DEBRIEF_EVALUATION_MAX_CHARS
      ? `${evaluation.slice(0, DEBRIEF_EVALUATION_MAX_CHARS).trimEnd()}\n[…]`
      : evaluation;
  return [
    `J'ai passé la station ECOS «${NBSP}${title}${NBSP}» (${specialty ? `${specialty}, ` : ''}cas fictif).${score} Voici l'évaluation reçue${NBSP}:`,
    '',
    clipped,
    '',
    "Aide-moi à retravailler cette station : reprends un par un les éléments manqués, explique ce qu'il fallait demander ou faire et pourquoi, puis pose-moi 3 questions pour vérifier que c'est acquis.",
  ].join('\n');
}
