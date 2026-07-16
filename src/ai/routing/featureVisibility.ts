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

export type AppFeatureId = 'chat' | 'document' | 'ecos' | 'partiel' | 'revision' | 'audio' | 'presentation' | 'cv-builder' | 'article' | 'scores';

/** Nom d'icône (src/ui/icons.tsx) — l'UI n'utilise plus d'emojis (refonte 2026-06). */
export type AppFeatureIcon =
  | 'messageCircle'
  | 'fileText'
  | 'stethoscope'
  | 'barChart'
  | 'calendarCheck'
  | 'micVoice'
  | 'presentation'
  | 'idCard'
  | 'penLine'
  | 'calculator';

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
  /**
   * Candidate aux onglets de la barre du bas quand le rôle a trop d'outils
   * (au-delà de TAB_BAR_MAX, les non-prioritaires basculent dans le panneau « Outils »).
   */
  primary?: boolean;
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
    primary: true,
  },
  {
    id: 'document',
    route: '/(chat)/document',
    label: 'Document',
    emoji: '📄',
    icon: 'fileText',
    description: 'Résumé patient d’un compte rendu ou d’une ordonnance.',
    personas: ['public'],
    primary: true,
  },
  {
    id: 'ecos',
    route: '/(chat)/ecos',
    label: 'ECOS',
    emoji: '🩺',
    icon: 'stethoscope',
    description: 'Simulation patient ECOS + évaluation pédagogique.',
    personas: ['student'],
    primary: true,
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
    id: 'revision',
    route: '/(chat)/revision',
    label: 'Révisions',
    emoji: '🗓️',
    icon: 'calendarCheck',
    description: 'Planifie tes révisions : charge quotidienne réaliste, suivi et jauge de risque.',
    personas: ['student'],
    primary: true,
  },
  {
    id: 'audio',
    route: '/(chat)/audio',
    label: 'Audio',
    emoji: '🎤',
    icon: 'micVoice',
    description: 'Compte rendu structuré d’une consultation dictée.',
    personas: ['professional'],
    primary: true,
  },
  {
    id: 'presentation',
    route: '/(chat)/presentation',
    label: 'Présentations',
    emoji: '🖥️',
    icon: 'presentation',
    description: 'Slides médicales prêtes pour Keynote (manuel ou IA) — export PPTX.',
    personas: ['student', 'professional'],
    primary: true,
  },
  {
    id: 'cv-builder',
    route: '/(chat)/cv-builder',
    label: 'CV',
    emoji: '📋',
    icon: 'idCard',
    description: 'Crée et améliore ton CV médical : éditeur, aperçu A4, relecture IA, export PDF.',
    personas: ['student', 'professional'],
  },
  {
    id: 'article',
    route: '/(chat)/article',
    label: 'Article',
    emoji: '✒️',
    icon: 'penLine',
    description:
      'Rédige ton article ou ta thèse : plan IMRaD, compteurs de caractères, bibliographie Vancouver, aides IA et contrôle d’originalité.',
    personas: ['student', 'professional'],
  },
  {
    id: 'scores',
    route: '/(chat)/scores',
    label: 'Scores',
    emoji: '🧮',
    icon: 'calculator',
    description:
      'Scores et calculateurs cliniques interactifs (CHA₂DS₂-VASc, Glasgow, CKD-EPI…) avec interprétation, recherche par nom ou par fonction.',
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

/**
 * Nombre maximal d'onglets dans la barre du bas (lisibilité mobile).
 * Au-delà, la barre affiche les outils prioritaires + un bouton « Outils »
 * qui ouvre le panneau complet (cf. src/ui/AppTabBar.tsx).
 */
export const TAB_BAR_MAX = 4;

export interface TabBarSplit {
  /** Onglets affichés dans la barre du bas (≤ TAB_BAR_MAX, slots réservés déduits). */
  bar: AppFeatureMeta[];
  /** Outils restants, accessibles via le panneau « Outils » (vide → pas de bouton). */
  overflow: AppFeatureMeta[];
}

export interface TabBarOptions {
  /**
   * Emplacements pris par des entrées hors registre d'outils (ex. l'onglet
   * « Accueil » vers la Vue d'ensemble, refonte shell 2026-07) — déduits de la
   * capacité de la barre AVANT répartition.
   */
  reservedSlots?: number;
}

/**
 * Répartition des outils visibles entre la barre du bas et le panneau « Outils ».
 * Si tout tient (≤ TAB_BAR_MAX − réservés), pas de panneau. Sinon : outils
 * prioritaires (`primary`, complétés dans l'ordre si besoin) + bouton « Outils ».
 */
export function tabBarFeatures(
  persona: Persona | null | undefined,
  ctx: VisibilityContext = {},
  options: TabBarOptions = {},
): TabBarSplit {
  const reserved = Math.max(0, options.reservedSlots ?? 0);
  const capacity = Math.max(1, TAB_BAR_MAX - reserved);
  const visible = visibleFeatures(persona, ctx);
  if (visible.length <= capacity) return { bar: visible, overflow: [] };

  const slots = Math.max(1, capacity - 1); // une place réservée au bouton « Outils »
  const bar = visible.filter((f) => f.primary).slice(0, slots);
  // Complète avec les premiers outils visibles si trop peu de prioritaires.
  for (const f of visible) {
    if (bar.length >= slots) break;
    if (!bar.includes(f)) bar.push(f);
  }
  const overflow = visible.filter((f) => !bar.includes(f));
  return { bar, overflow };
}
