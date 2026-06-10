/**
 * Contexte utilisateur injecté dans le system prompt des 3 chatbots (refonte 2026-06).
 *
 * Les prompts produit (public.v3 / student.v3 / professional.v2) sont la source de vérité
 * du comportement : ce module n'ajoute QUE le minimum de contexte (prénom, âge, sexe)
 * pour que l'IA personnalise ses réponses sans redemander ces informations.
 *
 * Module pur (server-safe), sans dépendance réseau.
 */
import type { PersonalInfo, Sex } from '@/profile/personalInfo';

export type ChatbotId = 'public' | 'student' | 'professional';

export const CHATBOT_IDS: ChatbotId[] = ['public', 'student', 'professional'];

export function coerceChatbot(value: unknown): ChatbotId {
  return CHATBOT_IDS.includes(value as ChatbotId) ? (value as ChatbotId) : 'public';
}

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

/**
 * Section « contexte utilisateur » concaténée au prompt système.
 * Donne à l'IA le minimum vital (prénom/âge/sexe) pour personnaliser et éviter de
 * redemander ce qui est déjà connu (le recueil du prompt grand public en tient compte).
 */
export function buildUserContextSection(info: PersonalInfo | null): string {
  if (!info) return '';
  const lines: string[] = [];
  const fullName = [info.firstName, info.lastName].filter(Boolean).join(' ');
  if (fullName) lines.push(`- Prénom/Nom : ${fullName}`);
  if (info.age != null) lines.push(`- Âge : ${info.age} ans`);
  if (info.sex) lines.push(`- Sexe : ${SEX_LABEL[info.sex]}`);
  if (lines.length === 0) return '';

  return (
    `\n\nCONTEXTE UTILISATEUR (fourni par le profil du compte)\n` +
    `${lines.join('\n')}\n` +
    `Ces informations sont déjà connues : ne les redemande jamais, utilise-les pour ` +
    `personnaliser la réponse (registre, dépistages selon l'âge/le sexe, exemples adaptés). ` +
    `Si la personne parle d'un proche, ce contexte ne s'applique pas à ce proche.`
  );
}
