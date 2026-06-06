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

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const db = serviceClient();

  const [modelsRes, promptsRes] = await Promise.all([
    db.from('ai_model_config').select('key, model_id, provider, label, updated_at'),
    db.from('ai_prompts').select('key, label, template, scope, version, updated_at'),
  ]);

  // Modèles : merge DB + defaults
  const dbModels: Record<string, { model_id: string; provider: string; updated_at: string }> = {};
  for (const row of modelsRes.data ?? []) {
    dbModels[row.key] = { model_id: row.model_id, provider: row.provider, updated_at: row.updated_at };
  }

  // Prompts : merge DB (override) + defaults
  const dbPrompts: Record<string, { template: string; label: string; scope: string; updated_at: string }> = {};
  for (const row of promptsRes.data ?? []) {
    dbPrompts[row.key] = { template: row.template, label: row.label, scope: row.scope, updated_at: row.updated_at };
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
    const { model_id, provider } = body;
    if (!model_id || !provider) {
      return Response.json({ error: 'model_id et provider requis.' }, { status: 400 });
    }
    const { error } = await db
      .from('ai_model_config')
      .update({ model_id, provider, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    invalidateConfigCache();
    return Response.json({ ok: true });
  }

  if (type === 'prompt') {
    const { template } = body;
    if (!template) return Response.json({ error: 'template requis.' }, { status: 400 });

    const def = PROMPT_DEFAULTS[key];
    const { error } = await db.from('ai_prompts').upsert({
      key,
      label: def?.label ?? key,
      scope: def?.scope ?? 'system',
      template,
      version: '1.0.0',
      updated_at: new Date().toISOString(),
    });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    invalidatePromptCache();
    return Response.json({ ok: true });
  }

  if (type === 'reset_prompt') {
    const { error } = await db.from('ai_prompts').delete().eq('key', key);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    invalidatePromptCache();
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'type inconnu.' }, { status: 400 });
}
