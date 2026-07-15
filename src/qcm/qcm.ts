/**
 * QCM/QCS type EDN — module PUR (types, validation, notation déterministe).
 *
 * Feature « Section QCM » du chatbot étudiant (2026-07) : l'étudiant clique pour
 * générer, à la demande, un mini-examen de QCM (plusieurs bonnes réponses possibles)
 * et QCS (une seule bonne réponse) sur le sujet de la conversation en cours, dans le
 * format et avec la NOTATION de l'EDN (réforme R2C).
 *
 * Aucune dépendance UI/réseau : testé dans tests/unit/qcm.test.ts. La notation ne fait
 * JAMAIS confiance à un score renvoyé par l'IA — elle est recalculée ici à partir de la
 * grille de correction (propositions marquées correct/incorrect) et des cases cochées.
 *
 * Barème EDN (grille CNCI, « discordances ») appliqué question par question :
 *   - QCS (une seule bonne réponse) : tout ou rien — 1 si la SEULE proposition cochée est
 *     la bonne, 0 sinon (aucune coche, mauvaise coche, ou plusieurs coches → 0).
 *   - QCM (plusieurs bonnes réponses possibles) : on compte les « discordances » = nombre
 *     de propositions où la réponse de l'étudiant diffère de la grille (bonne oubliée OU
 *     mauvaise cochée). 0 discordance → 1 ; 1 → 0,5 ; 2 → 0,2 ; ≥ 3 → 0.
 */

export type QcmKind = 'QCM' | 'QCS';

export interface QcmProposition {
  /** Texte de la proposition (A, B, C… générés à l'affichage). */
  text: string;
  /** true si la proposition fait partie de la grille de correction. */
  correct: boolean;
  /** Justification pédagogique courte, affichée à la correction. */
  explanation: string;
}

export interface QcmQuestion {
  kind: QcmKind;
  /** Énoncé de la question (peut inclure une courte vignette clinique). */
  stem: string;
  /** 3 à 6 propositions (EDN : pas forcément 5). */
  propositions: QcmProposition[];
}

export interface Qcm {
  title: string;
  /** Sujet ou discipline (ex. « Cardiologie — Insuffisance cardiaque »). */
  topic: string;
  questions: QcmQuestion[];
}

/** Bornes de format (défense en profondeur — le prompt les impose déjà côté IA). */
export const QCM_LIMITS = {
  minQuestions: 1,
  maxQuestions: 15,
  minPropositions: 3,
  maxPropositions: 8,
} as const;

// ── Validation d'un objet brut (sortie IA ou payload client) ─────────────────

function cleanString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validateProposition(raw: unknown): QcmProposition | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const text = cleanString(p.text, 600);
  if (!text) return null;
  return {
    text,
    correct: Boolean(p.correct),
    explanation: cleanString(p.explanation, 1200),
  };
}

function validateQuestion(raw: unknown): QcmQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const q = raw as Record<string, unknown>;
  const stem = cleanString(q.stem, 2000);
  if (!stem) return null;

  const propositions: QcmProposition[] = [];
  if (Array.isArray(q.propositions)) {
    for (const rawProp of q.propositions) {
      const prop = validateProposition(rawProp);
      if (prop) propositions.push(prop);
      if (propositions.length >= QCM_LIMITS.maxPropositions) break;
    }
  }
  if (propositions.length < QCM_LIMITS.minPropositions) return null;

  const correctCount = propositions.filter((p) => p.correct).length;
  // Un QCS a exactement une bonne réponse ; sinon on le traite comme un QCM.
  // Une question sans aucune bonne réponse est rejetée (grille inexploitable).
  if (correctCount === 0) return null;
  const declaredKind = q.kind === 'QCS' || q.kind === 'QCM' ? (q.kind as QcmKind) : null;
  const kind: QcmKind = declaredKind ?? (correctCount === 1 ? 'QCS' : 'QCM');
  // On refuse un QCS incohérent (plusieurs bonnes réponses) : on le reclasse en QCM.
  const normalizedKind: QcmKind = kind === 'QCS' && correctCount !== 1 ? 'QCM' : kind;

  return { kind: normalizedKind, stem, propositions };
}

/**
 * Valide et normalise un QCM brut (sortie IA). Retourne null si rien d'exploitable
 * (fail-closed : on n'affiche jamais un QCM sans grille de correction fiable).
 */
export function validateQcm(raw: unknown): Qcm | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const questions: QcmQuestion[] = [];
  if (Array.isArray(r.questions)) {
    for (const rawQ of r.questions) {
      const q = validateQuestion(rawQ);
      if (q) questions.push(q);
      if (questions.length >= QCM_LIMITS.maxQuestions) break;
    }
  }
  if (questions.length < QCM_LIMITS.minQuestions) return null;

  return {
    title: cleanString(r.title, 200) || 'QCM d’entraînement',
    topic: cleanString(r.topic, 200),
    questions,
  };
}

// ── Notation déterministe (barème EDN) ───────────────────────────────────────

export interface QuestionScore {
  /** Points obtenus sur cette question (0 à 1). */
  score: number;
  /** Nombre de discordances (QCM) — 0 pour un QCS traité en tout-ou-rien. */
  discordances: number;
  /** true si la question est parfaitement juste (score === 1). */
  perfect: boolean;
  /** Indices des propositions correctes (pour surligner la grille). */
  correctIndices: number[];
}

/**
 * Note une question à partir des indices cochés par l'étudiant.
 * `selected` : ensemble des indices de propositions cochées (0-based).
 */
export function scoreQuestion(question: QcmQuestion, selected: ReadonlySet<number>): QuestionScore {
  const correctIndices = question.propositions
    .map((p, i) => (p.correct ? i : -1))
    .filter((i) => i >= 0);

  if (question.kind === 'QCS') {
    // Tout ou rien : exactement la bonne proposition, et elle seule.
    const perfect = selected.size === 1 && correctIndices.length === 1 && selected.has(correctIndices[0]);
    return { score: perfect ? 1 : 0, discordances: perfect ? 0 : 1, perfect, correctIndices };
  }

  // QCM : discordance = proposition où la coche de l'étudiant ≠ grille.
  let discordances = 0;
  question.propositions.forEach((p, i) => {
    if (p.correct !== selected.has(i)) discordances += 1;
  });

  let score: number;
  if (discordances === 0) score = 1;
  else if (discordances === 1) score = 0.5;
  else if (discordances === 2) score = 0.2;
  else score = 0;

  return { score, discordances, perfect: discordances === 0, correctIndices };
}

export interface QcmResult {
  perQuestion: QuestionScore[];
  /** Somme des points (0 à nombre de questions). */
  total: number;
  /** Nombre de questions (score maximal). */
  max: number;
  /** Note ramenée sur 20 (arrondie au demi-point, comme l'EDN). */
  over20: number;
  /** Nombre de questions parfaitement justes. */
  perfectCount: number;
}

/** Arrondit au demi-point le plus proche (convention d'affichage EDN). */
function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/**
 * Note l'ensemble du QCM. `answers` : pour chaque question (même ordre), l'ensemble
 * des indices cochés. Une entrée absente est traitée comme « aucune coche ».
 */
export function scoreQcm(qcm: Qcm, answers: ReadonlyArray<ReadonlySet<number>>): QcmResult {
  const perQuestion = qcm.questions.map((q, i) => scoreQuestion(q, answers[i] ?? new Set<number>()));
  const total = perQuestion.reduce((sum, r) => sum + r.score, 0);
  const max = qcm.questions.length;
  const over20 = max > 0 ? roundHalf((total / max) * 20) : 0;
  const perfectCount = perQuestion.filter((r) => r.perfect).length;
  return { perQuestion, total, max, over20, perfectCount };
}

/** Lettre d'affichage d'une proposition (A, B, C…). */
export function propositionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
