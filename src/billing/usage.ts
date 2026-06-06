/**
 * Quotas d'usage PAR FEATURE (06_BILLING §1, ADR-0012).
 *
 * Le rate-limit du chat (src/ai/rateLimit/chatRateLimit.ts + migration 0004) reste un garde-fou
 * anti-flood JOURNALIER GLOBAL par persona. Ce module ajoute des quotas MENSUELS PAR FEATURE
 * (analyses, ECOS, minutes audio…) modulés par le plan d'abonnement (freemium tiered).
 *
 * RÈGLE RÉGLEMENTAIRE (06_BILLING §5, critique) : ces quotas ne portent QUE sur le VOLUME.
 * Ils ne gating JAMAIS l'accès aux sources (HAS/ANSM restent gratuites pour tous).
 *
 * Le statut payant provient EXCLUSIVEMENT de la table `subscriptions` (webhook Stripe signé,
 * service_role) — le client ne peut pas l'influencer.
 *
 * Persistance : table `feature_usage_counters` (migration 0014) + RPC `consume_feature_quota`
 * (check-and-consume atomique). Repli en mémoire si Supabase n'est pas configuré (dev/tests),
 * de la même façon que chatRateLimit, pour ne jamais bloquer le dev local.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { BillingPlanId } from '@/billing/plans';
import { resolveEntitlement } from '@/billing/entitlements';

/** Features soumises à quota mensuel. Distinctes des feature-keys modèle (analyze, ecos_simulate…). */
export type QuotaFeature = 'chat' | 'analyze' | 'ecos' | 'audio';

/** Clé de plan pour le barème : 'free' (aucun abonnement actif) ou un plan payant. */
export type QuotaPlanKey = 'free' | BillingPlanId;

/**
 * Barème de quotas MENSUELS par (plan, feature). Unité : nombre d'opérations, SAUF `audio`
 * exprimé en MINUTES. `Infinity` = illimité (les plans payants lèvent les plafonds de volume,
 * cohérent avec resolveEntitlement().unlimitedMessages — 06_BILLING §1).
 *
 * Quotas GRATUITS par défaut (documentés, raisonnables — ne cassent pas l'usage gratuit actuel) :
 *   - chat    : 300 messages/mois   (plafond mensuel large ; le cap anti-flood reste journalier, 0004)
 *   - analyze : 10 analyses/mois
 *   - ecos    : 10 sessions ECOS/mois
 *   - audio   : 30 minutes/mois
 *
 * NB : `public_mid` n'a pas l'ECOS (feature étudiante, cf. plans.ts) → quota 0.
 */
export const FEATURE_QUOTAS: Record<QuotaPlanKey, Record<QuotaFeature, number>> = {
  free: { chat: 300, analyze: 10, ecos: 10, audio: 30 },
  public_mid: { chat: Infinity, analyze: Infinity, ecos: 0, audio: Infinity },
  student_mid: { chat: Infinity, analyze: Infinity, ecos: Infinity, audio: Infinity },
  student_premium: { chat: Infinity, analyze: Infinity, ecos: Infinity, audio: Infinity },
};

export function getFeatureQuota(plan: QuotaPlanKey, feature: QuotaFeature): number {
  return FEATURE_QUOTAS[plan][feature];
}

export interface QuotaResult {
  allowed: boolean;
  feature: QuotaFeature;
  plan: QuotaPlanKey;
  consumed: number;
  /** Quota mensuel (Number.MAX_SAFE_INTEGER si illimité). */
  quota: number;
  remaining: number;
  /** Premier jour du mois suivant (UTC) — moment du reset. */
  resetAt: string;
  /** true quand aucune persistance/identité → l'appel n'a pas été comptabilisé (anonyme). */
  skipped: boolean;
}

interface ConsumeFeatureQuotaRow {
  allowed: boolean;
  consumed: number;
  quota: number;
  remaining: number;
  reset_at: string;
}

const UNLIMITED = Number.MAX_SAFE_INTEGER;
const memoryCounters = new Map<string, number>();

function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Premier jour du mois courant (UTC), format YYYY-MM-DD. */
function currentPeriodUtc(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** Premier jour du mois SUIVANT (UTC) à partir d'une période YYYY-MM-DD. */
function resetAtUtc(period: string): string {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7)); // 1-12 → mois suivant en index 0-based = m
  return new Date(Date.UTC(y, m, 1)).toISOString();
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function resolveUserId(request: Request, supabase: SupabaseClient | null): Promise<string | null> {
  const token = bearerToken(request);
  if (!token || !supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}

/** Statuts Stripe « payant actif » (miroir de entitlements.ts). */
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

/**
 * Plan applicable au barème de quotas. Lecture service_role de `subscriptions`. Tolérante aux
 * erreurs (table absente / env partiel) → repli sur 'free' (jamais de faux déblocage).
 */
async function resolvePlanKey(supabase: SupabaseClient, userId: string): Promise<QuotaPlanKey> {
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (data && ACTIVE_STATUSES.has(data.status) && resolveEntitlement(data).tier === 'paid') {
      return data.plan as BillingPlanId;
    }
  } catch {
    /* repli free */
  }
  return 'free';
}

function unlimited(feature: QuotaFeature, plan: QuotaPlanKey, period: string): QuotaResult {
  return {
    allowed: true,
    feature,
    plan,
    consumed: 0,
    quota: UNLIMITED,
    remaining: UNLIMITED,
    resetAt: resetAtUtc(period),
    skipped: false,
  };
}

function consumeInMemory(
  userId: string,
  feature: QuotaFeature,
  plan: QuotaPlanKey,
  amount: number,
  quota: number,
  period: string,
): QuotaResult {
  const key = `${period}:${userId}:${feature}`;
  const current = memoryCounters.get(key) ?? 0;
  const next = current + amount;

  // Check-and-consume : on ne comptabilise que si l'opération reste sous le plafond.
  if (next > quota) {
    return {
      allowed: false,
      feature,
      plan,
      consumed: current,
      quota,
      remaining: Math.max(quota - current, 0),
      resetAt: resetAtUtc(period),
      skipped: false,
    };
  }

  memoryCounters.set(key, next);
  return {
    allowed: true,
    feature,
    plan,
    consumed: next,
    quota,
    remaining: Math.max(quota - next, 0),
    resetAt: resetAtUtc(period),
    skipped: false,
  };
}

/**
 * Fonction CENTRALE : vérifie le quota du plan pour `feature` et CONSOMME atomiquement
 * `amount` unité(s) (1 par défaut ; pour `audio`, des minutes). Renvoie un refus propre
 * (`allowed=false`) sans rien consommer en cas de dépassement.
 *
 * `amount` doit être un entier ≥ 1.
 */
export async function checkAndConsume(
  userId: string,
  feature: QuotaFeature,
  amount = 1,
): Promise<QuotaResult> {
  const safeAmount = Math.max(1, Math.floor(amount));
  const period = currentPeriodUtc();
  const supabase = getServiceClient();

  // Sans Supabase (dev/tests) : barème 'free' + compteur mémoire (jamais de blocage du dev local).
  if (!supabase) {
    const quota = getFeatureQuota('free', feature);
    if (quota === Infinity) return unlimited(feature, 'free', period);
    return consumeInMemory(userId, feature, 'free', safeAmount, quota, period);
  }

  const plan = await resolvePlanKey(supabase, userId);
  const quota = getFeatureQuota(plan, feature);

  // Plan illimité pour cette feature → on ne décompte rien (économie d'écritures).
  if (quota === Infinity) return unlimited(feature, plan, period);

  const { data, error } = await supabase.rpc('consume_feature_quota', {
    p_user_id: userId,
    p_feature_key: feature,
    p_period: period,
    p_amount: safeAmount,
    p_limit: quota,
  });

  if (error) {
    console.error('[checkAndConsume] Supabase RPC failed:', error.message);
    // Fail closed : si la persistance est configurée mais échoue, on refuse plutôt que
    // d'offrir un quota illimité par accident.
    return {
      allowed: false,
      feature,
      plan,
      consumed: quota,
      quota,
      remaining: 0,
      resetAt: resetAtUtc(period),
      skipped: false,
    };
  }

  const row = Array.isArray(data) ? (data[0] as ConsumeFeatureQuotaRow | undefined) : undefined;
  if (!row) {
    return {
      allowed: false,
      feature,
      plan,
      consumed: quota,
      quota,
      remaining: 0,
      resetAt: resetAtUtc(period),
      skipped: false,
    };
  }

  return {
    allowed: row.allowed,
    feature,
    plan,
    consumed: row.consumed,
    quota: row.quota,
    remaining: row.remaining,
    resetAt: row.reset_at,
    skipped: false,
  };
}

/**
 * Helper de route : résout l'utilisateur depuis le Bearer token puis applique checkAndConsume.
 *
 * Les utilisateurs ANONYMES (pas de token / pas de persistance) ne sont PAS soumis aux quotas
 * mensuels par feature — ils restent gouvernés par le rate-limit journalier IP existant (0004).
 * On renvoie alors `skipped=true, allowed=true` pour ne pas casser le comportement gratuit actuel.
 */
export async function enforceFeatureQuota(
  request: Request,
  feature: QuotaFeature,
  amount = 1,
): Promise<QuotaResult> {
  const supabase = getServiceClient();
  const userId = await resolveUserId(request, supabase);

  if (!userId) {
    const period = currentPeriodUtc();
    return {
      allowed: true,
      feature,
      plan: 'free',
      consumed: 0,
      quota: UNLIMITED,
      remaining: UNLIMITED,
      resetAt: resetAtUtc(period),
      skipped: true,
    };
  }

  return checkAndConsume(userId, feature, amount);
}

/**
 * Réponse 429 canonique (message FR) en cas de quota dépassé. Aucune donnée santé.
 */
export function quotaExceededResponse(result: QuotaResult): Response {
  const retryAfter = Math.max(1, Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error: 'Quota mensuel atteint pour cette fonctionnalité. Réessayez après la réinitialisation ou passez à une offre supérieure.',
      feature: result.feature,
      quota: result.quota,
      remaining: result.remaining,
      reset_at: result.resetAt,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    },
  );
}

/** Réinitialise les compteurs mémoire (tests uniquement). */
export function __resetFeatureUsageForTests(): void {
  memoryCounters.clear();
}
