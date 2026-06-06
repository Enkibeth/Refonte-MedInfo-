/**
 * GET  /api/admin/config — Retourne models + prompts actuels (DB + defaults).
 * POST /api/admin/config — Met à jour un model ou un prompt.
 *
 * Accès restreint aux comptes admin (src/admin/index.ts ADMIN_USER_IDS).
 */
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/admin/index';
import { AVAILABLE_MODELS } from '@/ai/providers/featureModel';
import { PROMPT_DEFAULTS } from '@/ai/prompts/promptStore';
import { invalidateConfigCache } from '@/ai/providers/featureModel';
import { invalidatePromptCache } from '@/ai/prompts/promptStore';
import {
  savePromptWithHistory,
  restorePromptVersion,
  type PromptHistoryStore,
  type PromptRecord,
  type HistoryRecord,
} from '@/ai/prompts/promptHistory';
import type { SupabaseClient } from '@supabase/supabase-js';

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Adaptateur Supabase de l'interface PromptHistoryStore (logique pure dans promptHistory.ts). */
function supabaseHistoryStore(db: SupabaseClient): PromptHistoryStore {
  return {
    async getPrompt(key) {
      const { data, error } = await db
        .from('ai_prompts')
        .select('key, label, scope, template, version')
        .eq('key', key)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as PromptRecord | null) ?? null;
    },
    async upsertPrompt(record) {
      const { error } = await db.from('ai_prompts').upsert({
        ...record,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    async insertHistory(record) {
      const { error } = await db.from('ai_prompts_history').insert(record);
      if (error) throw new Error(error.message);
    },
    async listHistory(key) {
      const { data, error } = await db
        .from('ai_prompts_history')
        .select('key, template, version, author, created_at')
        .eq('key', key)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as HistoryRecord[] | null) ?? [];
    },
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const db = serviceClient();

  // ?history=<key> → liste des versions archivées d'un prompt (récent → ancien).
  const historyKey = new URL(request.url).searchParams.get('history');
  if (historyKey) {
    const { data, error } = await db
      .from('ai_prompts_history')
      .select('key, template, version, author, created_at')
      .eq('key', historyKey)
      .order('created_at', { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ history: data ?? [] });
  }

  const [modelsRes, promptsRes] = await Promise.all([
    db
      .from('ai_model_config')
      .select('key, model_id, provider, label, temperature, reasoning_effort, verbosity, web_search, updated_at'),
    db.from('ai_prompts').select('key, label, template, scope, version, updated_at'),
  ]);

  // Prompts : merge DB (override) + defaults
  const dbPrompts: Record<
    string,
    { template: string; label: string; scope: string; version: string; updated_at: string }
  > = {};
  for (const row of promptsRes.data ?? []) {
    dbPrompts[row.key] = {
      template: row.template,
      label: row.label,
      scope: row.scope,
      version: row.version,
      updated_at: row.updated_at,
    };
  }

  return Response.json({
    models: modelsRes.data ?? [],
    availableModels: AVAILABLE_MODELS,
    prompts: Object.entries(PROMPT_DEFAULTS).map(([key, def]) => ({
      key,
      label: dbPrompts[key]?.label ?? def.label,
      scope: dbPrompts[key]?.scope ?? def.scope,
      template: dbPrompts[key]?.template ?? def.template,
      isOverridden: Boolean(dbPrompts[key]),
      version: dbPrompts[key]?.version ?? null,
      updated_at: dbPrompts[key]?.updated_at ?? null,
    })),
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: {
    type?: string;
    key?: string;
    model_id?: string;
    provider?: string;
    template?: string;
    version?: string;
    temperature?: number | null;
    reasoning_effort?: string | null;
    verbosity?: string | null;
    web_search?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const { type, key } = body;
  if (!key) return Response.json({ error: 'key requis.' }, { status: 400 });

  const db = serviceClient();

  if (type === 'model') {
    const { model_id, provider, temperature, reasoning_effort, verbosity, web_search } = body;
    if (!model_id || !provider) {
      return Response.json({ error: 'model_id et provider requis.' }, { status: 400 });
    }

    // Validation des réglages de génération (cf contraintes CHECK migration 0015).
    if (
      temperature != null &&
      (typeof temperature !== 'number' || temperature < 0 || temperature > 2)
    ) {
      return Response.json({ error: 'temperature doit être entre 0 et 2.' }, { status: 400 });
    }
    if (reasoning_effort != null && !['minimal', 'low', 'medium', 'high'].includes(reasoning_effort)) {
      return Response.json({ error: 'reasoning_effort invalide.' }, { status: 400 });
    }
    if (verbosity != null && !['low', 'medium', 'high'].includes(verbosity)) {
      return Response.json({ error: 'verbosity invalide.' }, { status: 400 });
    }

    const { error } = await db
      .from('ai_model_config')
      .update({
        model_id,
        provider,
        temperature: temperature ?? null,
        reasoning_effort: reasoning_effort ?? null,
        verbosity: verbosity ?? null,
        web_search: Boolean(web_search),
        updated_at: new Date().toISOString(),
      })
      .eq('key', key);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    invalidateConfigCache();
    return Response.json({ ok: true });
  }

  if (type === 'prompt') {
    const { template } = body;
    if (!template) return Response.json({ error: 'template requis.' }, { status: 400 });

    const def = PROMPT_DEFAULTS[key];
    try {
      const result = await savePromptWithHistory(supabaseHistoryStore(db), {
        key,
        template,
        label: def?.label ?? key,
        scope: def?.scope ?? 'system',
        author: auth.userId,
      });
      invalidatePromptCache();
      return Response.json({ ok: true, version: result.version });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : 'Erreur.' }, { status: 500 });
    }
  }

  if (type === 'restore_prompt') {
    const { version } = body;
    if (!version) return Response.json({ error: 'version requise.' }, { status: 400 });

    const def = PROMPT_DEFAULTS[key];
    try {
      const result = await restorePromptVersion(supabaseHistoryStore(db), {
        key,
        version,
        label: def?.label ?? key,
        scope: def?.scope ?? 'system',
        author: auth.userId,
      });
      invalidatePromptCache();
      return Response.json({ ok: true, version: result.version });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : 'Erreur.' }, { status: 400 });
    }
  }

  if (type === 'reset_prompt') {
    const { error } = await db.from('ai_prompts').delete().eq('key', key);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    invalidatePromptCache();
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'type inconnu.' }, { status: 400 });
}
