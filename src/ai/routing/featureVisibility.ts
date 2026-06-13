/**
 * Visibilité des fonctionnalités par rôle (persona) — source unique côté client.
 *
 * Objectif produit : chaque rôle ne voit QUE les outils qui le concernent
 * (le grand public ne voit pas les outils étudiant/pro, et inversement).
 *  - Grand public : Chat + Analyse de document (résumé patient).
 *  - Étudiant     : Chat + ECOS + Analyseur de partiel + Générateur de présentations.
 *  - Professionnel: Chat + Audio (compte rendu de consultation) + Générateur de présentations.
 *  - Admin        : tout (gestion / test).
 *
 * ⚠️ Module PUR et testable : aucune dépendance réseau, aucune donnée de santé.
 * C'est une couche d'ERGONOMIE (ce qu'on AFFICHE). L'autorisation réelle reste
 * dérivée du profil vérifié côté serveur (serverPersona.ts / routes API) — le
 * masquage d'onglet n'est jamais l'unique barrière de sécurité.
 */
import type { Persona } from '@/ai/prompts/_schema';

export type AppFeatureId = 'chat' | 'document' | 'ecos' | 'partiel' | 'audio' | 'presentation';

/** Nom d'icône (src/ui/icons.tsx) — l'UI n'utilise plus d'emojis (refonte 2026-06). */
export type AppFeatureIcon =
  | 'messageCircle'
  | 'fileText'
  | 'stethoscope'
  | 'barChart'
  | 'micVoice'
  | 'presentation';

export interface AppFeatureMeta {
  id: AppFeatureId;
  /** Segment de route Expo Router (groupe (chat)). */
  route: string;
  /** Libellé court (onglet / menu). */
  label: string;
  emoji: string;
  /** Icône ligne du design system (remplace l'emoji dans l'UI). */
  icon: AppFeatureIcon;
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
    icon: 'messageCircle',
    description: 'Information santé claire et sourcée (HAS, ANSM…).',
    personas: ['public', 'student', 'professional'],
  },
  {
    id: 'document',
    route: '/(chat)/document',
    label: 'Document',
    emoji: '📄',
    icon: 'fileText',
    description: 'Résumé patient d’un compte rendu ou d’une ordonnance.',
    personas: ['public'],
  },
  {
    id: 'ecos',
    route: '/(chat)/ecos',
    label: 'ECOS',
    emoji: '🩺',
    icon: 'stethoscope',
    description: 'Simulation patient ECOS + évaluation pédagogique.',
    personas: ['student'],
  },
  {
    id: 'partiel',
    route: '/(chat)/partiel',
    label: 'Classement',
    emoji: '📊',
    icon: 'barChart',
    description: 'Classement de promo : importe les notes et situe-toi (rang, comparaison).',
    personas: ['student'],
  },
  {
    id: 'audio',
    route: '/(chat)/audio',
    label: 'Audio',
    emoji: '🎤',
    icon: 'micVoice',
    description: 'Compte rendu structuré d’une consultation dictée.',
    personas: ['professional'],
  },
  {
    id: 'presentation',
    route: '/(chat)/presentation',
    label: 'Présentations',
    emoji: '🖥️',
    icon: 'presentation',
    description: 'Slides médicales prêtes pour Keynote (manuel ou IA) — export PPTX.',
    personas: ['student', 'professional'],
  },
];

export interface VisibilityContext {
  /** Un admin voit toutes les fonctionnalités (gestion / test). */
  isAdmin?: boolean;
  /**
   * Visiteur non connecté (essai sans inscription, 2026-06) : il ne voit QUE le chat.
   * Aucun autre outil ne doit lui être visible.
   */
  isGuest?: boolean;
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
  // Visiteur non connecté : seul le chat est accessible (essai 1 message gratuit).
  if (ctx.isGuest) return id === 'chat';
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
