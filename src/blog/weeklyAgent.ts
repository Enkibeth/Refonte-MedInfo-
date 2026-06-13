/**
 * Agent éditorial hebdomadaire du blog (ADR-0025) : pipeline en 3 étapes IA
 * exécuté par /api/cron/weekly-blog (cron Vercel, 1 fois par semaine).
 *
 *   1. Choix du sujet  (feature "blog_topic")   — évite les doublons avec les
 *      articles existants, privilégie l'actualité santé.
 *   2. Rédaction       (feature "blog_generate") — writeArticle() partagé avec
 *      la génération manuelle admin.
 *   3. Relecture       (feature "blog_review")  — verdict publish / revise /
 *      reject. publish → publication immédiate ; revise → publication de la
 *      version corrigée ; reject (ou relecture inexploitable) → l'article reste
 *      en BROUILLON pour arbitrage humain dans le panel admin.
 *
 * Garde anti-doublon : au plus un article `source = 'weekly_agent'` créé tous
 * les 6 jours (re-déclenchements du cron ou tests manuels sans effet).
 *
 * ⚠️  CONVENTION : les modèles utilisés (feature keys: "blog_topic",
 * "blog_generate", "blog_review") sont configurables depuis le panel admin
 * (app/(admin)/index.tsx). Si tu ajoutes une étape IA ici, déclare-la dans
 * src/admin/index.ts AI_FEATURES.
 */
import { generateText } from 'ai';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import {
  parseReviewJson,
  parseTopicJson,
  slugify,
  type GeneratedArticle,
} from '@/blog/articleJson';
import { blogServiceClient, generateCoverImage, writeArticle } from '@/blog/serverGeneration';

const GUARD_WINDOW_DAYS = 6;

export interface WeeklyAgentResult {
  ok: boolean;
  skipped?: string;
  error?: string;
  topic?: string;
  reviewVerdict?: string;
  reviewNotes?: string;
  postId?: string;
  slug?: string;
  published?: boolean;
  coverGenerated?: boolean;
}

/** Étape 1 — choisit le sujet de la semaine en évitant les articles existants. */
async function pickTopic(
  recentPosts: { title: string; category: string | null }[],
): Promise<{ topic: string; category: string } | null> {
  const [template, runtime] = await Promise.all([
    getPromptTemplate('blog_topic'),
    getRuntimeForFeature('blog_topic'),
  ]);
  const { tools: webTools, ...callOptions } = runtime.options;

  const existing =
    recentPosts.length > 0
      ? recentPosts.map((p) => `- ${p.title}${p.category ? ` (${p.category})` : ''}`).join('\n')
      : '(aucun article pour le moment)';

  const { text } = await generateText({
    model: runtime.model,
    system: template,
    prompt: `Articles déjà présents sur le blog (à ne PAS dupliquer) :\n${existing}\n\nNous sommes le ${new Date().toISOString().slice(0, 10)}. Propose le sujet de l'article de cette semaine.`,
    ...(webTools ? { tools: webTools } : {}),
    ...callOptions,
  });

  const proposal = parseTopicJson(text);
  if (!proposal) return null;
  const angle = proposal.angle ? ` — angle : ${proposal.angle}` : '';
  return { topic: `${proposal.topic}${angle}`, category: proposal.category };
}

/** Étape 3 — relit l'article ; retourne l'article final et le verdict. */
async function reviewArticle(
  article: GeneratedArticle,
): Promise<{ verdict: 'publish' | 'revise' | 'reject'; notes: string; final: GeneratedArticle }> {
  const [template, runtime] = await Promise.all([
    getPromptTemplate('blog_review'),
    getRuntimeForFeature('blog_review'),
  ]);
  const { tools: webTools, ...callOptions } = runtime.options;

  const { text } = await generateText({
    model: runtime.model,
    system: template,
    prompt: [
      `TITRE : ${article.title}`,
      `CHAPEAU : ${article.summary}`,
      `CATÉGORIE : ${article.category}`,
      '',
      'ARTICLE (markdown) :',
      article.content_md,
    ].join('\n'),
    ...(webTools ? { tools: webTools } : {}),
    ...callOptions,
  });

  const review = parseReviewJson(text);
  // Relecture inexploitable, ou « revise » sans article corrigé → on ne publie
  // pas automatiquement : l'article reste en brouillon pour relecture humaine.
  if (!review) return { verdict: 'reject', notes: 'Relecture inexploitable.', final: article };
  if (review.verdict === 'revise' && !review.content_md) {
    return {
      verdict: 'reject',
      notes: review.notes || 'Corrections demandées sans article corrigé fourni.',
      final: article,
    };
  }

  const final: GeneratedArticle =
    review.verdict === 'revise'
      ? {
          ...article,
          title: review.title ?? article.title,
          summary: review.summary ?? article.summary,
          category: review.category ?? article.category,
          content_md: review.content_md ?? article.content_md,
        }
      : article;
  return { verdict: review.verdict, notes: review.notes, final };
}

/** Exécute le pipeline complet. `force` saute la garde anti-doublon (tests admin). */
export async function runWeeklyBlogAgent(force = false): Promise<WeeklyAgentResult> {
  const db = blogServiceClient();

  // Garde anti-doublon : un seul article de l'agent par fenêtre de 6 jours.
  if (!force) {
    const since = new Date(Date.now() - GUARD_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
    const { data: recent, error: guardError } = await db
      .from('blog_posts')
      .select('id')
      .eq('source', 'weekly_agent')
      .gte('created_at', since)
      .limit(1);
    if (guardError) return { ok: false, error: guardError.message };
    if (recent && recent.length > 0) {
      return { ok: true, skipped: 'Un article de l’agent a déjà été créé cette semaine.' };
    }
  }

  // Contexte anti-doublon pour le choix du sujet : les 40 derniers articles.
  const { data: posts } = await db
    .from('blog_posts')
    .select('title, category')
    .order('created_at', { ascending: false })
    .limit(40);

  // 1. Sujet (en cas d'échec de parsing, le rédacteur choisira librement).
  let topic = '';
  try {
    const picked = await pickTopic(posts ?? []);
    if (picked) topic = picked.topic;
  } catch {
    topic = '';
  }

  // 2. Rédaction.
  const article = await writeArticle(topic.slice(0, 300));
  if (!article) {
    return { ok: false, topic, error: "Le rédacteur n'a pas renvoyé un article exploitable." };
  }

  // 3. Relecture.
  const { verdict, notes, final } = await reviewArticle(article);
  const publish = verdict === 'publish' || verdict === 'revise';

  // 4. Insertion (+ couverture best-effort) puis publication si approuvé.
  const slug = `${slugify(final.title)}-${Math.random().toString(36).slice(2, 6)}`;
  const coverUrl = await generateCoverImage(slug, final.image_prompt);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('blog_posts')
    .insert({
      slug,
      title: final.title,
      summary: final.summary,
      category: final.category,
      content_md: final.content_md,
      cover_image_url: coverUrl,
      status: publish ? 'published' : 'draft',
      published_at: publish ? now : null,
      source: 'weekly_agent',
    })
    .select('id, slug')
    .single();
  if (error) return { ok: false, topic, reviewVerdict: verdict, error: error.message };

  return {
    ok: true,
    topic,
    reviewVerdict: verdict,
    reviewNotes: notes,
    postId: data.id,
    slug: data.slug,
    published: publish,
    coverGenerated: Boolean(coverUrl),
  };
}
