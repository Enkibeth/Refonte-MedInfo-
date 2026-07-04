/**
 * Parseurs purs des réponses JSON des agents du blog (rédacteur, choix de sujet,
 * relecteur) + slugification des titres. Aucune dépendance serveur : module
 * testable en isolation (tests/unit/blog-agent.test.ts).
 */

export interface GeneratedArticle {
  title: string;
  summary: string;
  category: string;
  content_md: string;
  image_prompt: string;
  /** Illustration optionnelle insérée dans le corps de l'article (best-effort). */
  body_image_prompt?: string;
}

/** Rapport du sous-agent de vérification des faits/sources (blog_fact_check). */
export interface FactCheckReport {
  status: 'ok' | 'issues';
  issues: string[];
  notes: string;
}

export interface TopicProposal {
  topic: string;
  angle: string;
  category: string;
  rationale: string;
}

export type ReviewVerdict = 'publish' | 'revise' | 'reject';

export interface ArticleReview {
  verdict: ReviewVerdict;
  title?: string;
  summary?: string;
  category?: string;
  content_md?: string;
  notes: string;
}

export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Isole le premier objet JSON d'une réponse LLM (tolère les balises de code). */
function extractJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Extrait l'article généré par le rédacteur (clés title/content_md obligatoires). */
export function parseArticleJson(raw: string): GeneratedArticle | null {
  const obj = extractJsonObject(raw);
  if (!obj) return null;
  if (typeof obj.title !== 'string' || typeof obj.content_md !== 'string') return null;
  return {
    title: obj.title,
    summary: typeof obj.summary === 'string' ? obj.summary : '',
    category: typeof obj.category === 'string' ? obj.category : 'Santé',
    content_md: obj.content_md,
    image_prompt: typeof obj.image_prompt === 'string' ? obj.image_prompt : '',
    body_image_prompt:
      typeof obj.body_image_prompt === 'string' && obj.body_image_prompt.trim()
        ? obj.body_image_prompt.trim()
        : undefined,
  };
}

/** Extrait le rapport du vérificateur de faits (status obligatoire et valide). */
export function parseFactCheckJson(raw: string): FactCheckReport | null {
  const obj = extractJsonObject(raw);
  if (!obj) return null;
  const status = obj.status;
  if (status !== 'ok' && status !== 'issues') return null;
  const issues = Array.isArray(obj.issues)
    ? obj.issues.filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
    : [];
  return {
    status,
    issues: issues.map((i) => i.trim()),
    notes: typeof obj.notes === 'string' ? obj.notes.trim() : '',
  };
}

/**
 * Insère une illustration markdown avant le DEUXIÈME titre « ## » de l'article
 * (fin de la première section). Sans deuxième section, l'article est rendu
 * inchangé — jamais d'image orpheline en fin d'article.
 */
export function insertBodyImage(contentMd: string, url: string, alt: string): string {
  if (!url) return contentMd;
  const lines = contentMd.split('\n');
  let headings = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      headings++;
      if (headings === 2) {
        lines.splice(i, 0, `![${alt}](${url})`, '');
        return lines.join('\n');
      }
    }
  }
  return contentMd;
}

/** Extrait la proposition de l'agent de choix de sujet (topic obligatoire). */
export function parseTopicJson(raw: string): TopicProposal | null {
  const obj = extractJsonObject(raw);
  if (!obj || typeof obj.topic !== 'string' || !obj.topic.trim()) return null;
  return {
    topic: obj.topic.trim(),
    angle: typeof obj.angle === 'string' ? obj.angle.trim() : '',
    category: typeof obj.category === 'string' ? obj.category.trim() : '',
    rationale: typeof obj.rationale === 'string' ? obj.rationale.trim() : '',
  };
}

/** Extrait le verdict du relecteur (verdict obligatoire et valide). */
export function parseReviewJson(raw: string): ArticleReview | null {
  const obj = extractJsonObject(raw);
  if (!obj) return null;
  const verdict = obj.verdict;
  if (verdict !== 'publish' && verdict !== 'revise' && verdict !== 'reject') return null;
  return {
    verdict,
    title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : undefined,
    summary: typeof obj.summary === 'string' && obj.summary.trim() ? obj.summary.trim() : undefined,
    category:
      typeof obj.category === 'string' && obj.category.trim() ? obj.category.trim() : undefined,
    content_md:
      typeof obj.content_md === 'string' && obj.content_md.trim() ? obj.content_md : undefined,
    notes: typeof obj.notes === 'string' ? obj.notes.trim() : '',
  };
}
