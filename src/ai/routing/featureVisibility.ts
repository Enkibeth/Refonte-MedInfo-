/**
 * Visibilité des fonctionnalités par rôle (persona) — source unique côté client.
 *
 * Objectif produit : chaque rôle ne voit QUE les outils qui le concernent
 * (le grand public ne voit pas les outils étudiant/pro, et inversement).
 *  - Grand public : Chat + Analyse de document (résumé patient).
 *  - Étudiant     : Chat + ECOS + Analyseur de partiel.
 *  - Professionnel: Chat + Audio (compte rendu de consultation).
 *  - Admin        : tout (gestion / test).
 *
 * ⚠️ Module PUR et testable : aucune dépendance réseau, aucune donnée de santé.
 * C'est une couche d'ERGONOMIE (ce qu'on AFFICHE). L'autorisation réelle reste
 * dérivée du profil vérifié côté serveur (serverPersona.ts / routes API) — le
 * masquage d'onglet n'est jamais l'unique barrière de sécurité.
 */
import type { Persona } from '@/ai/prompts/_schema';

export type AppFeatureId = 'chat' | 'document' | 'ecos' | 'partiel' | 'audio';

export interface AppFeatureMeta {
  id: AppFeatureId;
  /** Segment de route Expo Router (groupe (chat)). */
  route: string;
  /** Libellé court (onglet / menu). */
  label: string;
  emoji: string;
  /** Description orientée audience. */
  description: string;
  /** Personas qui voient la feature (hors admin, qui voit tout). */
  personas: Persona[];
}

/** Registre des fonctionnalités exposées dans l'app + leur audience. */
export const APP_FEATURES: AppFeatureMeta[] = [
  {
    id: 'chat',
    route: '/(chat)/chat',
    label: 'Chat',
    emoji: '💬',
    description: 'Information santé claire et sourcée (HAS, ANSM…).',
    personas: ['public', 'student', 'professional'],
  },
  {
    id: 'document',
    route: '/(chat)/document',
    label: 'Document',
    emoji: '📄',
    description: 'Résumé patient d’un compte rendu ou d’une ordonnance.',
    personas: ['public'],
  },
  {
    id: 'ecos',
    route: '/(chat)/ecos',
    label: 'ECOS',
    emoji: '🩺',
    description: 'Simulation patient ECOS + évaluation pédagogique.',
    personas: ['student'],
  },
  {
    id: 'partiel',
    route: '/(chat)/partiel',
    label: 'Classement',
    emoji: '📊',
    description: 'Classement de promo : importe les notes et situe-toi (rang, comparaison).',
    personas: ['student'],
  },
  {
    id: 'audio',
    route: '/(chat)/audio',
    label: 'Audio',
    emoji: '🎤',
    description: 'Compte rendu structuré d’une consultation dictée.',
    personas: ['professional'],
  },
];

export interface VisibilityContext {
  /** Un admin voit toutes les fonctionnalités (gestion / test). */
  isAdmin?: boolean;
}

/** Persona effective par défaut quand le profil n'est pas (encore) chargé. */
const FALLBACK_PERSONA: Persona = 'public';

export function getFeatureMeta(id: AppFeatureId): AppFeatureMeta | undefined {
  return APP_FEATURES.find((f) => f.id === id);
}

/** La fonctionnalité `id` est-elle visible pour cette persona ? (admin → toujours). */
export function isFeatureVisible(
  id: AppFeatureId,
  persona: Persona | null | undefined,
  ctx: VisibilityContext = {},
): boolean {
  if (ctx.isAdmin) return true;
  const meta = getFeatureMeta(id);
  if (!meta) return false;
  return meta.personas.includes(persona ?? FALLBACK_PERSONA);
}

/** Liste ordonnée des fonctionnalités visibles pour une persona. */
export function visibleFeatures(
  persona: Persona | null | undefined,
  ctx: VisibilityContext = {},
): AppFeatureMeta[] {
  return APP_FEATURES.filter((f) => isFeatureVisible(f.id, persona, ctx));
}
