/**
 * Rate limiting chat (03_SECURITY §3).
 * Compteurs journaliers techniques uniquement : aucune donnée santé, aucun contenu message.
 * Le check doit être appelé dans app/api/chat+api.ts AVANT la couche 1 classifieur.
 */
import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Persona } from '@/ai/prompts/_schema';
import { resolveVerifiedUserId } from '@/auth/serverIdentity';
import { resolveEntitlement } from '@/billing/entitlements';

const DAILY_LIMITS: Record<Persona, number> = {
  public: 10,
  student: 20,
  professional: 30,
};
const PAID_DAILY_LIMITS: Record<Persona, number> = { public: 200, student: 300, professional: 500 };

const IP_FALLBACK = 'unknown-ip';
const memoryCounters = new Map<string, number>();
let memoryWindowDate = '';

export interface ChatRateLimitResult {
  allowed: boolean;
  status: 'ok' | 'limited';
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
  resetAt: string;
  identityType: 'user' | 'ip';
}

interface IncrementUsageCounterRow {
  allowed: boolean;
  daily_count: number;
  daily_limit: number;
  remaining: number;
  reset_at: string;
}

function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetAtUtc(windowDate: string): string {
  return new Date(`${windowDate}T00:00:00.000Z`).getTime()
    ? new Date(Date.UTC(
        Number(windowDate.slice(0, 4)),
        Number(windowDate.slice(5, 7)) - 1,
        Number(windowDate.slice(8, 10)) + 1,
      )).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function hashIdentifier(value: string): string {
  const pepper = process.env.RATE_LIMIT_HASH_PEPPER ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-rate-limit-pepper';
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    forwarded ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    IP_FALLBACK
  );
}

/**
 * Abonnement actif → volume étendu, plafonné contre les abus (ADR-0045). Le paywall ne lève QUE le
 * volume : il ne touche jamais l'accès aux sources (06_BILLING §5). Lecture service_role.
 * Tolérante aux erreurs (table absente / env partiel) → repli sur le quota gratuit.
 */
async function hasUnlimitedMessages(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();
    return resolveEntitlement(data ?? null).unlimitedMessages;
  } catch {
    return false;
  }
}

function unavailableResult(identityType: 'user' | 'ip', windowDate: string, dailyLimit: number): ChatRateLimitResult {
  return {
    allowed: false,
    status: 'limited',
    dailyCount: dailyLimit + 1,
    dailyLimit,
    remaining: 0,
    resetAt: resetAtUtc(windowDate),
    identityType,
  };
}

function incrementInMemory(params: {
  counterKey: string;
  persona: Persona;
  dailyLimit: number;
  windowDate: string;
  identityType: 'user' | 'ip';
}): ChatRateLimitResult {
  if (process.env.NODE_ENV === 'production') {
    return unavailableResult(params.identityType, params.windowDate, params.dailyLimit);
  }
  if (memoryWindowDate !== params.windowDate) {
    memoryCounters.clear();
    memoryWindowDate = params.windowDate;
  }
  const key = `${params.windowDate}:${params.persona}:${params.counterKey}`;
  if (!memoryCounters.has(key) && memoryCounters.size >= 10_000) {
    return unavailableResult(params.identityType, params.windowDate, params.dailyLimit);
  }
  const dailyCount = (memoryCounters.get(key) ?? 0) + 1;
  memoryCounters.set(key, dailyCount);

  return {
    allowed: dailyCount <= params.dailyLimit,
    status: dailyCount <= params.dailyLimit ? 'ok' : 'limited',
    dailyCount,
    dailyLimit: params.dailyLimit,
    remaining: Math.max(params.dailyLimit - dailyCount, 0),
    resetAt: resetAtUtc(params.windowDate),
    identityType: params.identityType,
  };
}

export async function checkChatRateLimit(
  request: Request,
  persona: Persona,
  options: { scope?: 'chat' | 'chat-meta' | 'audio' } = {},
): Promise<ChatRateLimitResult> {
  let dailyLimit = DAILY_LIMITS[persona];
  const windowDate = todayUtc();
  const supabase = getServiceClient();
  const userId = supabase ? await resolveVerifiedUserId(request, supabase) : null;
  const identityType: 'user' | 'ip' = userId ? 'user' : 'ip';
  const ipHash = userId ? null : hashIdentifier(clientIp(request));
  const identityKey = userId ? `user:${userId}` : `ip:${ipHash}`;
  const counterKey = options.scope ? `${options.scope}:${identityKey}` : identityKey;

  if (!supabase) {
    return incrementInMemory({ counterKey, persona, dailyLimit, windowDate, identityType });
  }

  // Paid accounts retain the anti-abuse ceiling documented in 03_SECURITY §3.
  if (userId && (await hasUnlimitedMessages(supabase, userId))) {
    dailyLimit = PAID_DAILY_LIMITS[persona];
  }

  return incrementPersisted(supabase, {
    counterKey,
    identityType,
    userId,
    ipHash,
    persona,
    dailyLimit,
    windowDate,
  });
}

/**
 * Plafond journalier par IP de l'essai sans inscription du chat. Le verrou « 1 message par
 * conversation » de `/api/chat` n'empêche pas d'ouvrir des conversations anonymes à l'infini
 * (appels LLM à nos frais) : ce compteur borne le total par IP et par jour. Compteur distinct
 * de celui de `/api/analyze` (préfixe `guest-chat:`), mêmes garanties : IP hachée, fail-closed.
 */
export const GUEST_CHAT_DAILY_LIMIT = 5;

export async function checkGuestChatQuota(request: Request): Promise<ChatRateLimitResult> {
  const windowDate = todayUtc();
  const ipHash = hashIdentifier(clientIp(request));
  const counterKey = `guest-chat:ip:${ipHash}`;
  const params = {
    counterKey,
    identityType: 'ip' as const,
    persona: 'public' as const,
    dailyLimit: GUEST_CHAT_DAILY_LIMIT,
    windowDate,
  };
  const supabase = getServiceClient();
  if (!supabase) return incrementInMemory(params);
  return incrementPersisted(supabase, { ...params, userId: null, ipHash });
}

async function incrementPersisted(
  supabase: SupabaseClient,
  params: {
    counterKey: string;
    identityType: 'user' | 'ip';
    userId: string | null;
    ipHash: string | null;
    persona: Persona;
    dailyLimit: number;
    windowDate: string;
  },
): Promise<ChatRateLimitResult> {
  const { counterKey, identityType, userId, ipHash, persona, dailyLimit, windowDate } = params;
  let result;
  try {
    result = await supabase.rpc('increment_usage_counter', {
      p_counter_key: counterKey,
      p_identity_type: identityType,
      p_user_id: userId,
      p_ip_hash: ipHash,
      p_persona: persona,
      p_window_date: windowDate,
      p_daily_limit: dailyLimit,
    });
  } catch {
    return unavailableResult(identityType, windowDate, dailyLimit);
  }
  const { data, error } = result;

  if (error) {
    console.error('[checkChatRateLimit] Supabase RPC failed:', error.message);
    // Fail closed in production when persistence is configured: unlimited chat is not acceptable.
    return {
      allowed: false,
      status: 'limited',
      dailyCount: dailyLimit + 1,
      dailyLimit,
      remaining: 0,
      resetAt: resetAtUtc(windowDate),
      identityType,
    };
  }

  const row = Array.isArray(data) ? (data[0] as IncrementUsageCounterRow | undefined) : undefined;
  if (!row) {
    return {
      allowed: false,
      status: 'limited',
      dailyCount: dailyLimit + 1,
      dailyLimit,
      remaining: 0,
      resetAt: resetAtUtc(windowDate),
      identityType,
    };
  }

  return {
    allowed: row.allowed,
    status: row.allowed ? 'ok' : 'limited',
    dailyCount: row.daily_count,
    dailyLimit: row.daily_limit,
    remaining: row.remaining,
    resetAt: row.reset_at,
    identityType,
  };
}

export function __resetChatRateLimitForTests(): void {
  memoryCounters.clear();
  memoryWindowDate = '';
}
