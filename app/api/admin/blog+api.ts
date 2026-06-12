/**
 * GET    /api/admin/blog — liste TOUS les articles (brouillons compris) ;
 *                          `?id=<uuid>` renvoie un article complet (content_md inclus),
 *                          brouillon ou publié — c'est l'aperçu/édition admin, la page
 *                          publique ne voyant que les articles publiés (RLS).
 * POST   /api/admin/blog — { action: 'generate', topic? } génère un article IA (brouillon) ;
 *                          { action: 'publish', id, publish } publie / dépublie ;
 *                          { action: 'update', id, title?, summary?, category?, content_md?,
 *                            cover_image_url? } modifie un article (avant ou après publication) ;
 *                          { action: 'upload_image', id, dataBase64, contentType, target }
 *                          téléverse une image (target 'cover' remplace la couverture,
 *                          'inline' renvoie l'URL publique à insérer dans le markdown).
 * DELETE /api/admin/blog — { id } supprime un article.
 *
 * Accès restreint aux comptes admin (requireAdmin). Écritures en service role :
 * la table blog_posts n'a AUCUNE policy d'écriture client (migration 0022).
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "blog_generate") est configurable
 * depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 *
 * Image de couverture : best-effort via l'API OpenAI Images (gpt-image-1) si
 * OPENAI_API_KEY est présent, stockée dans le bucket Storage public `blog-covers`
 * (créé hors harness — voir supabase/setup/blog_covers_bucket.sql). Sans clé ou en
 * cas d'échec, l'article est créé sans image (la page blog affiche un motif de repli).
 */
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';

import { requireAdmin } from '@/admin/index';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { persistSession: false } });
}

function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Extrait l'objet JSON de la réponse du modèle (tolère les balises de code). */
function parseArticleJson(raw: string): {
  title: string;
  summary: string;
  category: string;
  content_md: string;
  image_prompt: string;
} | null {
  const cleaned = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof obj.title !== 'string' || typeof obj.content_md !== 'string') return null;
    return {
      title: obj.title,
      summary: typeof obj.summary === 'string' ? obj.summary : '',
      category: typeof obj.category === 'string' ? obj.category : 'Santé',
      content_md: obj.content_md,
      image_prompt: typeof obj.image_prompt === 'string' ? obj.image_prompt : '',
    };
  } catch {
    return null;
  }
}

/** Génère la couverture (best-effort) et retourne son URL publique, sinon null. */
async function generateCoverImage(slug: string, imagePrompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !imagePrompt) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: imagePrompt,
        size: '1536x1024',
        quality: 'medium',
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const db = serviceClient();
    const path = `${slug}.png`;
    const { error } = await db.storage
      .from('blog-covers')
      .upload(path, bytes, { contentType: 'image/png', upsert: true });
    if (error) return null;
    return db.storage.from('blog-covers').getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    const { data, error } = await serviceClient()
      .from('blog_posts')
      .select('id, slug, title, summary, category, cover_image_url, content_md, status, created_at, published_at')
      .eq('id', id)
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data) return Response.json({ error: 'Article introuvable.' }, { status: 404 });
    return Response.json({ post: data });
  }

  const { data, error } = await serviceClient()
    .from('blog_posts')
    .select('id, slug, title, summary, category, cover_image_url, status, created_at, published_at')
    .order('created_at', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ posts: data ?? [] });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: {
    action?: string;
    topic?: string;
    id?: string;
    publish?: boolean;
    title?: string;
    summary?: string;
    category?: string;
    content_md?: string;
    cover_image_url?: string | null;
    dataBase64?: string;
    contentType?: string;
    target?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const db = serviceClient();

  if (body.action === 'update') {
    if (!body.id) return Response.json({ error: 'id requis.' }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 300);
    if (typeof body.summary === 'string') patch.summary = body.summary.trim().slice(0, 1000) || null;
    if (typeof body.category === 'string') patch.category = body.category.trim().slice(0, 80) || null;
    if (typeof body.content_md === 'string' && body.content_md.trim()) patch.content_md = body.content_md;
    if (body.cover_image_url === null) patch.cover_image_url = null;
    else if (typeof body.cover_image_url === 'string') {
      const url = body.cover_image_url.trim();
      if (url && !/^https:\/\//.test(url)) {
        return Response.json({ error: "L'URL de l'image doit être en https://" }, { status: 400 });
      }
      patch.cover_image_url = url || null;
    }
    const { error } = await db.from('blog_posts').update(patch).eq('id', body.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (body.action === 'upload_image') {
    if (!body.id) return Response.json({ error: 'id requis.' }, { status: 400 });
    const target = body.target === 'inline' ? 'inline' : 'cover';
    const extByType: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    };
    const ext = extByType[body.contentType ?? ''];
    if (!ext) {
      return Response.json({ error: 'Format accepté : PNG, JPEG ou WebP.' }, { status: 400 });
    }
    if (typeof body.dataBase64 !== 'string' || !body.dataBase64) {
      return Response.json({ error: 'Image manquante.' }, { status: 400 });
    }
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(body.dataBase64), (c) => c.charCodeAt(0));
    } catch {
      return Response.json({ error: 'Image illisible (base64 invalide).' }, { status: 400 });
    }
    if (bytes.length > 4 * 1024 * 1024) {
      return Response.json({ error: 'Image trop lourde (4 Mo max).' }, { status: 413 });
    }

    const { data: post, error: postError } = await db
      .from('blog_posts')
      .select('slug')
      .eq('id', body.id)
      .maybeSingle();
    if (postError || !post) return Response.json({ error: 'Article introuvable.' }, { status: 404 });

    const rand = Math.random().toString(36).slice(2, 8);
    const path =
      target === 'cover' ? `${post.slug}-cover-${rand}.${ext}` : `inline/${post.slug}-${rand}.${ext}`;
    const { error: uploadError } = await db.storage
      .from('blog-covers')
      .upload(path, bytes, { contentType: body.contentType, upsert: true });
    if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });
    const url = db.storage.from('blog-covers').getPublicUrl(path).data.publicUrl;

    if (target === 'cover') {
      const { error } = await db
        .from('blog_posts')
        .update({ cover_image_url: url, updated_at: new Date().toISOString() })
        .eq('id', body.id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, url });
  }

  if (body.action === 'publish') {
    if (!body.id) return Response.json({ error: 'id requis.' }, { status: 400 });
    const publish = Boolean(body.publish);
    const { error } = await db
      .from('blog_posts')
      .update({
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (body.action === 'generate') {
    const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 300) : '';

    const [template, runtime] = await Promise.all([
      getPromptTemplate('blog_generate'),
      getRuntimeForFeature('blog_generate'),
    ]);
    const { tools: webTools, ...callOptions } = runtime.options;

    const { text } = await generateText({
      model: runtime.model,
      system: template,
      prompt: topic
        ? `Sujet demandé pour l'article : ${topic}`
        : "Aucun sujet imposé : choisis un sujet santé innovant et d'actualité.",
      ...(webTools ? { tools: webTools } : {}),
      ...callOptions,
    });

    const article = parseArticleJson(text);
    if (!article) {
      return Response.json(
        { error: "Le modèle n'a pas renvoyé un article exploitable. Réessayez." },
        { status: 502 },
      );
    }

    const slug = `${slugify(article.title)}-${Math.random().toString(36).slice(2, 6)}`;
    const coverUrl = await generateCoverImage(slug, article.image_prompt);

    const { data, error } = await db
      .from('blog_posts')
      .insert({
        slug,
        title: article.title,
        summary: article.summary,
        category: article.category,
        content_md: article.content_md,
        cover_image_url: coverUrl,
        status: 'draft',
      })
      .select('id, slug')
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, post: data, coverGenerated: Boolean(coverUrl) });
  }

  return Response.json({ error: 'action inconnue.' }, { status: 400 });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
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

  const { error } = await serviceClient().from('blog_posts').delete().eq('id', body.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
