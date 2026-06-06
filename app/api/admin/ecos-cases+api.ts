/**
 * GET    /api/admin/ecos-cases — liste TOUS les cas ECOS (publiés + brouillons).
 * POST   /api/admin/ecos-cases — crée/met à jour un cas, ou bascule la publication.
 * DELETE /api/admin/ecos-cases — supprime un cas (par id).
 *
 * CRUD du corpus ECOS (table ecos_cases, migration 0013). Accès restreint aux comptes
 * admin (src/admin/index.ts ADMIN_USER_IDS) — même doctrine que /api/admin/config.
 * Écriture via service_role : le client (anon) ne lit que les cas PUBLIÉS via la RLS.
 *
 * Ceci n'est PAS une fonctionnalité IA (aucun appel LLM) : pas d'entrée AI_FEATURES.
 */
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/admin/index';

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { persistSession: false } });
}

const COLUMNS =
  'id, slug, title, specialty, level, duration_minutes, brief, patient_profile, grading_grid, is_published, created_at';

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await serviceClient()
    .from('ecos_cases')
    .select(COLUMNS)
    .order('created_at', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ cases: data ?? [] });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: {
    action?: string;
    id?: string;
    is_published?: boolean;
    case?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const db = serviceClient();

  // Bascule rapide de publication (publish / unpublish).
  if (body.action === 'publish') {
    if (!body.id) return Response.json({ error: 'id requis.' }, { status: 400 });
    const { error } = await db
      .from('ecos_cases')
      .update({ is_published: Boolean(body.is_published) })
      .eq('id', body.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  // Création / mise à jour (upsert).
  const c = body.case;
  if (!c || typeof c !== 'object') {
    return Response.json({ error: 'case requis.' }, { status: 400 });
  }

  const title = typeof c.title === 'string' ? c.title.trim() : '';
  const specialty = typeof c.specialty === 'string' ? c.specialty.trim() : '';
  const brief = typeof c.brief === 'string' ? c.brief.trim() : '';
  if (!title || !specialty || !brief) {
    return Response.json({ error: 'title, specialty et brief sont requis.' }, { status: 400 });
  }

  const slug =
    typeof c.slug === 'string' && c.slug.trim() ? slugify(c.slug) : slugify(title);
  if (!slug) return Response.json({ error: 'slug invalide.' }, { status: 400 });

  const roleBrief =
    c.patient_profile && typeof c.patient_profile === 'object'
      ? (c.patient_profile as { role_brief?: unknown }).role_brief
      : c.patient_profile;
  const gradingMarkdown =
    c.grading_grid && typeof c.grading_grid === 'object'
      ? (c.grading_grid as { markdown?: unknown }).markdown
      : c.grading_grid;

  const row: Record<string, unknown> = {
    slug,
    title,
    specialty,
    level: typeof c.level === 'string' && c.level.trim() ? c.level.trim() : 'DFASM',
    duration_minutes:
      Number.isFinite(Number(c.duration_minutes)) && Number(c.duration_minutes) > 0
        ? Math.min(60, Math.round(Number(c.duration_minutes)))
        : 10,
    brief,
    patient_profile: { role_brief: typeof roleBrief === 'string' ? roleBrief : '' },
    grading_grid: { markdown: typeof gradingMarkdown === 'string' ? gradingMarkdown : '' },
    is_published: Boolean(c.is_published),
  };
  if (typeof c.id === 'string' && c.id) row.id = c.id;

  // Upsert par id si fourni (édition), sinon par slug (création / ré-import).
  const { data, error } = await db
    .from('ecos_cases')
    .upsert(row, { onConflict: row.id ? 'id' : 'slug' })
    .select(COLUMNS)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, case: data });
}

// ── DELETE ──────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }
  if (!body.id) return Response.json({ error: 'id requis.' }, { status: 400 });

  const { error } = await serviceClient().from('ecos_cases').delete().eq('id', body.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
