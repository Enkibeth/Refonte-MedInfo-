/**
 * Directives de réponse dynamiques injectées dans le system prompt du chat (toutes personas).
 *
 * Trois apports, décidés avec Hugo (ADR-0021), appliqués SANS dégrader le safe-box non-MDSW :
 *   1. Contexte utilisateur (prénom/nom/âge/sexe) — personnalisation de l'INFORMATION GÉNÉRALE
 *      uniquement ; n'autorise jamais diagnostic, anamnèse, triage ou CAT individualisée.
 *   2. Réglages de génération (réflexion + niveau de détail) pilotés par l'utilisateur via des
 *      curseurs ; la rapidité est dérivée automatiquement (moins de réflexion = plus rapide).
 *   3. Recherche web restreinte aux sources officielles fiables (corpus RAG encore réduit), avec
 *      obligation de citer, puis bloc d'auto-réflexion en fin de réponse.
 *
 * Module pur (server-safe). Les marqueurs d'auto-réflexion sont partagés avec l'UI
 * (src/ai/ui/reflection.ts) pour éviter toute dérive entre prompt et rendu.
 */
import type { Persona } from '@/ai/prompts/_schema';
import type { ReasoningEffort, Verbosity } from '@/ai/providers/featureModel';
import type { PersonalInfo, Sex } from '@/profile/personalInfo';
import {
  DEFAULT_GENERATION,
  type DetailLevel,
  type GenerationSettings,
  type ReasoningLevel,
} from '@/ai/chat/generationSettings';
import { REFLECTION_OPEN, REFLECTION_CLOSE } from '@/ai/ui/reflection';

export type { GenerationSettings } from '@/ai/chat/generationSettings';

// ── Réglages utilisateur ──────────────────────────────────────────────────────

const REASONING_LEVELS: ReasoningLevel[] = ['rapide', 'standard', 'approfondi', 'maximal'];
const DETAIL_LEVELS: DetailLevel[] = ['simple', 'standard', 'complet'];

const REASONING_TO_EFFORT: Record<ReasoningLevel, ReasoningEffort> = {
  rapide: 'minimal',
  standard: 'low',
  approfondi: 'medium',
  maximal: 'high',
};

const DETAIL_TO_VERBOSITY: Record<DetailLevel, Verbosity> = {
  simple: 'low',
  standard: 'medium',
  complet: 'high',
};

/** Budget de sortie indicatif (tokens) par niveau de détail. */
const DETAIL_MAX_TOKENS: Record<DetailLevel, number> = {
  simple: 900,
  standard: 1800,
  complet: 3600,
};

export function coerceGeneration(raw: unknown): GenerationSettings {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const reasoning = REASONING_LEVELS.includes(obj.reasoning as ReasoningLevel)
    ? (obj.reasoning as ReasoningLevel)
    : DEFAULT_GENERATION.reasoning;
  const detail = DETAIL_LEVELS.includes(obj.detail as DetailLevel)
    ? (obj.detail as DetailLevel)
    : DEFAULT_GENERATION.detail;
  return { reasoning, detail };
}

export function reasoningEffortFor(g: GenerationSettings): ReasoningEffort {
  return REASONING_TO_EFFORT[g.reasoning];
}

export function verbosityFor(g: GenerationSettings): Verbosity {
  return DETAIL_TO_VERBOSITY[g.detail];
}

export function maxTokensFor(g: GenerationSettings): number {
  return DETAIL_MAX_TOKENS[g.detail];
}

// ── Contexte utilisateur (infos perso) ────────────────────────────────────────

const SEX_LABEL: Record<Sex, string> = {
  feminin: 'féminin',
  masculin: 'masculin',
  autre: 'autre',
  non_precise: 'non précisé',
};

/** Tronque/borne les valeurs reçues du client (anti-injection, anti-abus). */
function sanitizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\r\n⟦⟧]/g, ' ').trim().slice(0, 60);
  return cleaned.length > 0 ? cleaned : null;
}

export function coercePersonalInfo(raw: unknown): PersonalInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const firstName = sanitizeName(obj.firstName);
  const lastName = sanitizeName(obj.lastName);
  const ageNum = typeof obj.age === 'number' ? obj.age : Number(obj.age);
  const age = Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 130 ? Math.floor(ageNum) : null;
  const sex = (['feminin', 'masculin', 'autre', 'non_precise'] as Sex[]).includes(obj.sex as Sex)
    ? (obj.sex as Sex)
    : null;
  if (!firstName && !lastName && age == null && !sex) return null;
  return { firstName, lastName, age, sex };
}

// ── Construction de la section de directives ──────────────────────────────────

const WEB_SOURCE_WHITELIST =
  'HAS, ANSM, Santé Publique France, ameli.fr, service-public.fr, INCa, CRAT, BDPM/base-donnees-publique.medicaments.gouv.fr, ' +
  'Vidal RCP officiels, OMS/WHO, sociétés savantes françaises et européennes (ESC, EULAR, KDIGO…), revues à comité de lecture (PubMed/Cochrane)';

function userContextSection(info: PersonalInfo): string {
  const lines: string[] = [];
  const fullName = [info.firstName, info.lastName].filter(Boolean).join(' ');
  if (fullName) lines.push(`- Prénom/Nom : ${fullName}`);
  if (info.age != null) lines.push(`- Âge : ${info.age} ans`);
  if (info.sex) lines.push(`- Sexe : ${SEX_LABEL[info.sex]}`);
  if (lines.length === 0) return '';

  return (
    `\n\n# CONTEXTE UTILISATEUR (personnalisation de l'information générale)\n` +
    `${lines.join('\n')}\n` +
    `Utilise ce contexte UNIQUEMENT pour adapter le registre et cibler l'information générale ` +
    `pertinente (ex. dépistages recommandés selon l'âge/le sexe, tutoiement avec le prénom). ` +
    `Cela ne change RIEN au safe-box : tu ne poses pas d'anamnèse, tu ne diagnostiques pas, tu ` +
    `n'évalues pas l'urgence et tu ne donnes pas de conduite à tenir individuelle. Si la demande ` +
    `bascule vers un cas personnel, tu refuses comme d'habitude.`
  );
}

function generationSection(g: GenerationSettings): string {
  const depth: Record<ReasoningLevel, string> = {
    rapide: 'Réponds vite et droit au but, sans dérouler tout le raisonnement.',
    standard: 'Équilibre clarté et concision ; explique l\'essentiel.',
    approfondi: 'Prends le temps de raisonner : nuances, mécanismes, cas particuliers.',
    maximal: 'Raisonnement maximal : couvre les nuances, exceptions et limites des données.',
  };
  const length: Record<DetailLevel, string> = {
    simple: 'Réponse SIMPLE et courte : va à l\'essentiel, vocabulaire accessible, pas de digression.',
    standard: 'Réponse de longueur moyenne, structurée et claire.',
    complet: 'Réponse COMPLÈTE et détaillée : sections, exemples, points de vigilance, données chiffrées sourcées.',
  };
  return (
    `\n\n# RÉGLAGES DE RÉPONSE (choisis par l'utilisateur)\n` +
    `- Réflexion : ${g.reasoning} — ${depth[g.reasoning]}\n` +
    `- Détail : ${g.detail} — ${length[g.detail]}`
  );
}

const WEB_SEARCH_SECTION =
  `\n\n# SOURCES — RECHERCHE WEB FIABLE D'ABORD\n` +
  `Le corpus RAG interne est encore réduit. Pour répondre, tu t'appuies EN PRIORITÉ sur une ` +
  `recherche web RESTREINTE aux sources officielles et fiables suivantes : ${WEB_SOURCE_WHITELIST}. ` +
  `Le contexte RAG officiel (s'il est fourni plus bas) reste une source de confiance à utiliser en appui.\n` +
  `Règles : n'utilise JAMAIS de source non fiable (forums, blogs, sites commerciaux, contenus non ` +
  `vérifiables). Cite chaque affirmation factuelle avec sa source et son URL/organisme. Si aucune ` +
  `source fiable ne couvre la question, dis-le explicitement plutôt que d'inventer. Tu n'es pas un ` +
  `dispositif médical : la recherche web ne sert qu'à informer en général, jamais à diagnostiquer.`;

function reflectionSection(): string {
  return (
    `\n\n# AUTO-RÉFLEXION (obligatoire en fin de réponse)\n` +
    `Termine CHAQUE réponse substantielle par un bloc d'auto-réflexion, encadré EXACTEMENT ainsi :\n` +
    `${REFLECTION_OPEN}\n` +
    `(2 à 4 phrases : niveau de confiance dans les sources, limites de la réponse, ce qu'il faudrait ` +
    `vérifier auprès d'un professionnel, et rappel que ce n'est pas un avis médical individuel.)\n` +
    `${REFLECTION_CLOSE}\n` +
    `Place ce bloc tout à la fin, APRÈS les sources. N'utilise ces marqueurs nulle part ailleurs.`
  );
}

export interface ResponseDirectivesInput {
  personalInfo?: PersonalInfo | null;
  generation: GenerationSettings;
}

/**
 * Construit la section de directives à concaténer au template du prompt actif.
 * Ordre : politique de sources web → contexte utilisateur → réglages → format d'auto-réflexion.
 */
export function buildResponseDirectives(
  _persona: Persona,
  { personalInfo, generation }: ResponseDirectivesInput,
): string {
  return (
    WEB_SEARCH_SECTION +
    (personalInfo ? userContextSection(personalInfo) : '') +
    generationSection(generation) +
    reflectionSection()
  );
}
