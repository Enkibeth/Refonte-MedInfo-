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
  // Professionnels vérifiés : illimité (court-circuit dans checkChatRateLimit, ADR-0029).
  // Valeur technique jamais utilisée pour décompter.
  professional: 0,
};

const IP_FALLBACK = 'unknown-ip';
const memoryCounters = new Map<string, number>();

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
  const url = process.env.SUPABASE_URL;
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
 * Abonnement actif → quota de messages illimité (06_BILLING §1). Le paywall ne lève QUE le
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

function unlimitedResult(identityType: 'user' | 'ip', windowDate: string): ChatRateLimitResult {
  return {
    allowed: true,
    status: 'ok',
    dailyCount: 0,
    dailyLimit: Number.MAX_SAFE_INTEGER,
    remaining: Number.MAX_SAFE_INTEGER,
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
  const key = `${params.windowDate}:${params.persona}:${params.counterKey}`;
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

export async function checkChatRateLimit(request: Request, persona: Persona): Promise<ChatRateLimitResult> {
  const dailyLimit = DAILY_LIMITS[persona];
  const windowDate = todayUtc();

  // Professionnels vérifiés : illimité, AVANT tout accès DB (ADR-0029 — l'ancien 0
  // aurait bloqué tout message pro au premier envoi si la route chat était rebranchée).
  if (persona === 'professional') {
    return unlimitedResult('user', windowDate);
  }

  const supabase = getServiceClient();
  const userId = supabase ? await resolveVerifiedUserId(request, supabase) : null;
  const identityType: 'user' | 'ip' = userId ? 'user' : 'ip';
  const ipHash = userId ? null : hashIdentifier(clientIp(request));
  const counterKey = userId ? `user:${userId}` : `ip:${ipHash}`;

  if (!supabase) {
    return incrementInMemory({ counterKey, persona, dailyLimit, windowDate, identityType });
  }

  // Abonné payant actif → pas de décompte de quota (messages illimités, 06_BILLING §1).
  if (userId && (await hasUnlimitedMessages(supabase, userId))) {
    return unlimitedResult(identityType, windowDate);
  }

  const { data, error } = await supabase.rpc('increment_usage_counter', {
    p_counter_key: counterKey,
    p_identity_type: identityType,
    p_user_id: userId,
    p_ip_hash: ipHash,
    p_persona: persona,
    p_window_date: windowDate,
    p_daily_limit: dailyLimit,
  });

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
}
