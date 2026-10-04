/**
 * Chargement « proactif » des fonctionnalités IA (2026-09, retour Hugo : « on clique sur
 * Générer un QCM et rien n'explique ce qui se passe »).
 *
 * Un appel IA non streamé dure de quelques secondes à plus d'une minute, sans aucun signal
 * intermédiaire du serveur. Un simple spinner laisse l'utilisateur deviner si ça marche.
 * Ce module décrit, pour chaque tâche, les ÉTAPES RÉELLES de ce que fait le serveur (dans
 * leur ordre), et fait avancer l'affichage d'une étape à l'autre selon le temps écoulé.
 *
 * Honnêteté de l'affichage : le serveur ne renvoie aucun point d'étape, donc
 * - les libellés décrivent ce que la route fait VRAIMENT (jamais une étape inventée) ;
 * - l'avancée est une ESTIMATION temporelle : la dernière étape reste « en cours » tant
 *   que la réponse n'est pas arrivée, et la barre ne se remplit jamais (un plein dirait
 *   « terminé ») ;
 * - au-delà d'un délai long, un message de patience remplace toute promesse de durée.
 *
 * Module PUR (aucune dépendance UI ni réseau), testé dans tests/unit/staged-progress.test.ts.
 */

export interface ProgressStep {
  /** Ce que fait le serveur pendant cette étape (« Rédaction des propositions… »). */
  label: string;
  /** Temps écoulé (ms) à partir duquel l'étape devient l'étape en cours. */
  afterMs: number;
}

export interface ProgressPlan {
  /** Titre court de la tâche (« Création de ton QCM »). */
  title: string;
  /** Étapes dans l'ordre ; la première commence à 0 ms. */
  steps: ProgressStep[];
  /** Au-delà (ms), message de patience affiché sous les étapes. */
  slowAfterMs: number;
}

/** Message de patience : jamais de durée promise, seulement l'état. */
export const SLOW_MESSAGE = 'Toujours en cours. Les contenus détaillés prennent parfois plus longtemps : tu peux rester sur la page.';

/** Plafond de la barre : jamais pleine tant que la réponse n'est pas arrivée. */
export const PROGRESS_CEILING = 0.94;

export const PROGRESS_PLANS = {
  qcm: {
    title: 'Création de ton QCM type EDN',
    steps: [
      { label: 'Lecture de la réponse et du sujet', afterMs: 0 },
      { label: 'Choix des notions à tester', afterMs: 3_000 },
      { label: 'Rédaction des questions et propositions', afterMs: 8_000 },
      { label: 'Rédaction des justifications, proposition par proposition', afterMs: 18_000 },
      { label: 'Vérification de la grille de correction', afterMs: 30_000 },
    ],
    slowAfterMs: 50_000,
  },
  analyze: {
    title: 'Analyse du document',
    steps: [
      { label: 'Envoi sécurisé du document', afterMs: 0 },
      { label: 'Lecture du document par l’IA', afterMs: 2_000 },
      { label: 'Repérage des éléments importants', afterMs: 7_000 },
      { label: 'Rédaction du résumé en langage clair', afterMs: 14_000 },
    ],
    slowAfterMs: 40_000,
  },
  translate: {
    title: 'Traduction du document',
    steps: [
      { label: 'Envoi sécurisé du document', afterMs: 0 },
      { label: 'Lecture du document par l’IA', afterMs: 2_000 },
      { label: 'Traduction, en gardant les termes médicaux exacts', afterMs: 7_000 },
    ],
    slowAfterMs: 40_000,
  },
  ecosEvaluate: {
    title: 'Correction de ta station',
    steps: [
      { label: 'Relecture de ton échange avec le patient', afterMs: 0 },
      { label: 'Comparaison avec la grille de la station', afterMs: 5_000 },
      { label: 'Calcul de la note sur 20', afterMs: 14_000 },
      { label: 'Rédaction des points forts et des axes de progrès', afterMs: 20_000 },
    ],
    slowAfterMs: 50_000,
  },
  revisionBoost: {
    title: 'Analyse de ton planning',
    steps: [
      { label: 'Lecture de tes blocs et de tes échéances', afterMs: 0 },
      { label: 'Repérage des semaines chargées', afterMs: 4_000 },
      { label: 'Rédaction des conseils d’organisation', afterMs: 10_000 },
    ],
    slowAfterMs: 40_000,
  },
  audioTranscription: {
    title: 'Transcription de l’enregistrement',
    steps: [
      { label: 'Envoi de l’audio', afterMs: 0 },
      { label: 'Transcription de la parole en texte', afterMs: 3_000 },
      { label: 'Identification des interlocuteurs', afterMs: 15_000 },
    ],
    slowAfterMs: 60_000,
  },
  audioReport: {
    title: 'Compte rendu de la consultation',
    steps: [
      { label: 'Envoi de l’audio', afterMs: 0 },
      { label: 'Transcription de la parole en texte', afterMs: 3_000 },
      { label: 'Identification des interlocuteurs', afterMs: 15_000 },
      { label: 'Rédaction du compte rendu structuré', afterMs: 25_000 },
    ],
    slowAfterMs: 75_000,
  },
  blogGenerate: {
    title: 'Rédaction de l’article',
    steps: [
      { label: 'Choix de l’angle et du plan', afterMs: 0 },
      { label: 'Rédaction des sections', afterMs: 8_000 },
      { label: 'Création de l’image de couverture', afterMs: 45_000 },
      { label: 'Enregistrement du brouillon', afterMs: 80_000 },
    ],
    slowAfterMs: 120_000,
  },
} satisfies Record<string, ProgressPlan>;

export type ProgressPlanKey = keyof typeof PROGRESS_PLANS;

/** Index de l'étape en cours pour un temps écoulé (0 si négatif ou plan vide). */
export function activeStepIndex(steps: ProgressStep[], elapsedMs: number): number {
  let index = 0;
  for (let i = 0; i < steps.length; i++) {
    if (elapsedMs >= steps[i].afterMs) index = i;
  }
  return index;
}

/**
 * Fraction de la barre, monotone croissante en fonction du temps et plafonnée à
 * PROGRESS_CEILING : chaque étape occupe une part égale, remplie progressivement jusqu'au
 * début de l'étape suivante ; la dernière s'approche du plafond sans jamais l'atteindre.
 */
export function progressFraction(plan: ProgressPlan, elapsedMs: number): number {
  const { steps } = plan;
  if (steps.length === 0 || elapsedMs <= 0) return 0;
  const i = activeStepIndex(steps, elapsedMs);
  const share = 1 / steps.length;
  const start = steps[i].afterMs;
  const next = steps[i + 1]?.afterMs;
  // Dernière étape : approche asymptotique sur une durée comparable à la précédente.
  const span = next !== undefined ? next - start : Math.max(10_000, plan.slowAfterMs - start);
  const within = next !== undefined
    ? Math.min(1, (elapsedMs - start) / span)
    : 1 - Math.exp(-(elapsedMs - start) / span);
  return Math.min(PROGRESS_CEILING, share * (i + within));
}

/** Temps écoulé lisible : « 8 s », « 1 min 05 ». */
export function formatElapsed(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  if (total < 60) return `${total} s`;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min} min ${String(sec).padStart(2, '0')}`;
}

/** L'attente est-elle anormalement longue (message de patience) ? */
export function isSlow(plan: ProgressPlan, elapsedMs: number): boolean {
  return elapsedMs >= plan.slowAfterMs;
}
