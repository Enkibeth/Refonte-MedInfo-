/**
 * Catalogue des plans payants (06_BILLING §1 — freemium tiered, ADR-0012).
 *
 * MVP : tiers **public** et **étudiant** uniquement. Les tiers **professionnels** sont
 * volontairement ABSENTS (gelés par ADR-0006) → toute tentative d'achat d'un plan pro échoue
 * (id de plan inconnu). Aucune donnée de santé.
 *
 * INVARIANT 06_BILLING §5 : un plan payant ne gate JAMAIS l'accès aux sources (HAS/ANSM…).
 * Il ne lève QUE le quota de messages et débloque des features avancées.
 */
import type { Persona } from '@/ai/prompts/_schema';

export type BillingPlanId = 'public_mid' | 'student_mid' | 'student_premium';

export type BillablePersona = Extract<Persona, 'public' | 'student'>;

export interface BillingPlan {
  id: BillingPlanId;
  /** Persona à laquelle l'offre est réservée (audience gating, 06_BILLING §1). */
  persona: BillablePersona;
  label: string;
  /** Prix affiché côté WEB uniquement (zéro prix sur natif, 06_BILLING §3). */
  priceLabel: string;
  /** Nom de la variable d'env portant le `price_id` Stripe (jamais committé). */
  priceEnvVar: string;
  /** Résumé non gating des avantages (jamais « sources »). */
  perks: string[];
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  public_mid: {
    id: 'public_mid',
    persona: 'public',
    label: 'Public — Mid',
    priceLabel: '4,99 €/mois',
    priceEnvVar: 'STRIPE_PRICE_PUBLIC_MID',
    perks: ['Messages illimités', 'Suggestions de suivi'],
  },
  student_mid: {
    id: 'student_mid',
    persona: 'student',
    label: 'Étudiant — Mid',
    priceLabel: '7,99 €/mois',
    priceEnvVar: 'STRIPE_PRICE_STUDENT_MID',
    perks: ['Messages illimités', 'Mode EDN/ECOS', 'Export de fiches'],
  },
  student_premium: {
    id: 'student_premium',
    persona: 'student',
    label: 'Étudiant — Premium',
    priceLabel: '14,99 €/mois',
    priceEnvVar: 'STRIPE_PRICE_STUDENT_PREMIUM',
    perks: ['Tout Mid', 'Stations ECOS simulées', 'Classement gamifié'],
  },
};

export function isBillingPlanId(value: unknown): value is BillingPlanId {
  return value === 'public_mid' || value === 'student_mid' || value === 'student_premium';
}

/** Offres disponibles pour une persona (les personas non facturées renvoient []). */
export function plansForPersona(persona: Persona): BillingPlan[] {
  return Object.values(BILLING_PLANS).filter((plan) => plan.persona === persona);
}
