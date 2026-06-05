/**
 * Droits d'usage dérivés de l'abonnement (06_BILLING §1, §5 — ADR-0012).
 *
 * RÈGLE RÉGLEMENTAIRE (06_BILLING §5, critique) : l'entitlement ne porte QUE sur le volume de
 * messages. Il n'expose AUCUN champ gouvernant l'accès aux sources : les références HAS/ANSM
 * restent gratuites et visibles pour tous, abonnés ou non. Un test verrouille cet invariant.
 *
 * Le statut payant provient EXCLUSIVEMENT de la table `subscriptions`, elle-même alimentée par
 * le seul webhook Stripe signé (service_role). Le client ne peut pas l'influencer.
 */
import type { BillingPlanId } from '@/billing/plans';

export interface SubscriptionRecord {
  plan: BillingPlanId;
  status: string;
  current_period_end?: string | null;
}

export interface Entitlement {
  tier: 'free' | 'paid';
  /** true = quota de messages illimité (le rate-limit est court-circuité côté serveur). */
  unlimitedMessages: boolean;
}

/** Statuts Stripe considérés comme « payant actif ». */
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export function resolveEntitlement(subscription: SubscriptionRecord | null | undefined): Entitlement {
  if (subscription && ACTIVE_STATUSES.has(subscription.status)) {
    return { tier: 'paid', unlimitedMessages: true };
  }
  return { tier: 'free', unlimitedMessages: false };
}
