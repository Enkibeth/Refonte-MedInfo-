/**
 * Génération d'articles de blog côté serveur — logique partagée entre la route
 * admin (/api/admin/blog, génération manuelle) et l'agent hebdomadaire
 * (/api/cron/weekly-blog, pipeline sujet → rédaction → relecture → publication).
 *
 * ⚠️  CONVENTION : le modèle du rédacteur (feature key: "blog_generate") est
 * configurable depuis le panel admin (app/(admin)/index.tsx).
 */
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { parseArticleJson, type GeneratedArticle } from '@/blog/articleJson';

export function blogServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Appelle le rédacteur IA (feature blog_generate) et retourne l'article parsé,
 * ou null si la réponse n'est pas exploitable.
 */
export async function writeArticle(topic: string): Promise<GeneratedArticle | null> {
  const [template, runtime] = await Promise.all([
    getPromptTemplate('blog_generate'),
    getRuntimeForFeature('blog_generate'),
  ]);
  const { tools: webTools, ...callOptions } = runtime.options;

  const { text } = await generateText({
    // La rédaction est l'étape la plus longue ; borne large mais dure pour ne
    // jamais consommer à elle seule le maxDuration de la fonction Vercel.
    abortSignal: AbortSignal.timeout(150_000),
    model: runtime.model,
    system: template,
    prompt: topic
      ? `Sujet demandé pour l'article : ${topic}`
      : "Aucun sujet imposé : choisis un sujet santé innovant et d'actualité.",
    ...(webTools ? { tools: webTools } : {}),
    ...callOptions,
  });

  return parseArticleJson(text);
}

/**
 * Génère une illustration (best-effort), l'upload dans le bucket public
 * `blog-covers` sous `path` et retourne son URL publique, sinon null.
 */
export async function generateArticleImage(
  path: string,
  imagePrompt: string,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !imagePrompt) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      signal: AbortSignal.timeout(90_000),
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
    const db = blogServiceClient();
    const { error } = await db.storage
      .from('blog-covers')
      .upload(path, bytes, { contentType: 'image/png', upsert: true });
    if (error) return null;
    return db.storage.from('blog-covers').getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

/** Génère la couverture (best-effort) et retourne son URL publique, sinon null. */
export async function generateCoverImage(
  slug: string,
  imagePrompt: string,
): Promise<string | null> {
  return generateArticleImage(`${slug}.png`, imagePrompt);
}
