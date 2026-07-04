/**
 * Modèle de données + validation + logique pure du module « Rédaction d'article
 * médical » (ADR-0031).
 *
 * Module PUR et testable (tests/unit/article-document.test.ts) :
 *  - `sanitizeArticlePayload` borne et valide le payload venu de l'iframe AVANT
 *    écriture en base (table `article_documents`, own-row RLS, migration 0033) ;
 *  - compteurs de caractères/mots (référence du comptage, miroir JS dans
 *    public/article.html) ;
 *  - citations : ordre d'apparition des appels `[@id]` et rendu `[n]` (Vancouver) ;
 *  - formatage des références (Vancouver / APA) ;
 *  - `buildAiSectionContext` : contexte MINIMISÉ envoyé à l'IA (jamais le document
 *    complet quand seule une section est concernée) ;
 *  - `parseOriginalityReport` : parseur tolérant du rapport JSON du contrôle
 *    d'originalité (generateText + web_search → texte, jamais garanti JSON pur).
 *
 * ⚠️  Un manuscrit peut contenir des données de recherche : il ne doit JAMAIS
 * contenir de données identifiantes de patients (rappel affiché dans l'UI).
 * L'IA n'invente ni fait, ni chiffre, ni référence (prompts + [à vérifier]).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Garde-fous de taille (texte seul : pas d'image dans un manuscrit). */
export const MAX_TITLE_CHARS = 300;
export const MAX_ARTICLE_JSON_CHARS = 800_000;
/** Texte maximal accepté par les aides IA (une section, pas la thèse entière). */
export const MAX_AI_TEXT_CHARS = 30_000;
/** Texte maximal du contrôle d'originalité (recherche web ciblée). */
export const MAX_ORIGINALITY_CHARS = 15_000;

/** Types de document supportés (gabarits de sections côté client). */
export const ARTICLE_DOC_TYPES = [
  'original',    // article original IMRaD
  'abstract',    // abstract / résumé de congrès
  'case_report', // cas clinique
  'review',      // revue de littérature
  'thesis',      // thèse / mémoire
] as const;
export type ArticleDocType = (typeof ARTICLE_DOC_TYPES)[number];

export interface ArticleSection {
  id: string;
  title?: string;
  content?: string;
  /** Limite éditable de la section (jauge côté client). */
  limit?: { kind: 'chars' | 'chars_no_spaces' | 'words'; max: number };
}

export interface ArticleReference {
  id: string;
  /** Auteurs au format « Nom Initiales » (ex. "Dupont J"). */
  authors?: string[];
  title?: string;
  journal?: string;
  year?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  pmid?: string;
  url?: string;
}

export interface ArticlePayload {
  title: string;
  docType: ArticleDocType;
  document: Record<string, unknown>;
}

export type SanitizeArticleResult =
  | { ok: true; value: ArticlePayload }
  | { ok: false; error: string };

/** Id d'article transmis par le client (uuid, sinon null). */
export function coerceArticleId(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

export function coerceDocType(value: unknown): ArticleDocType {
  return ARTICLE_DOC_TYPES.includes(value as ArticleDocType)
    ? (value as ArticleDocType)
    : 'original';
}

export function coerceArticleTitle(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_CHARS);
}

function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Valide et borne le corps d'une sauvegarde d'article. Échoue si le document est
 * absent/illisible ou trop volumineux, sinon renvoie un objet propre prêt à écrire.
 */
export function sanitizeArticlePayload(body: unknown): SanitizeArticleResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  if (!b.document || typeof b.document !== 'object' || Array.isArray(b.document)) {
    return { ok: false, error: 'document requis (objet).' };
  }
  if (jsonSize(b.document) > MAX_ARTICLE_JSON_CHARS) {
    return { ok: false, error: 'Article trop volumineux.' };
  }

  const document = b.document as Record<string, unknown>;
  const meta = (document.meta as Record<string, unknown> | undefined) ?? {};
  const title =
    coerceArticleTitle(b.title) ||
    coerceArticleTitle(meta.title) ||
    'Article sans titre';

  return { ok: true, value: { title, docType: coerceDocType(b.docType ?? meta.docType), document } };
}

// ── Compteurs (référence du comptage ; miroir JS dans public/article.html) ───

/** Normalise les fins de ligne pour un comptage stable multi-plateforme. */
function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export interface CharCounts {
  withSpaces: number;
  withoutSpaces: number;
  words: number;
}

/** Compte caractères (espaces comprises / hors espaces) et mots d'un texte. */
export function countText(text: unknown): CharCounts {
  if (typeof text !== 'string' || !text) return { withSpaces: 0, withoutSpaces: 0, words: 0 };
  const t = normalizeText(text);
  const trimmed = t.trim();
  return {
    withSpaces: t.length,
    withoutSpaces: t.replace(/\s/g, '').length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
  };
}

// ── Citations `[@id]` → appels numérotés `[n]` (Vancouver) ───────────────────

export const CITATION_TOKEN_RE = /\[@([A-Za-z0-9_-]{1,40})\]/g;

export interface CitationOrder {
  /** Ids de références dans l'ordre de PREMIÈRE apparition dans le texte. */
  ordered: string[];
  /** Tokens rencontrés qui ne correspondent à aucune référence connue. */
  unknown: string[];
  /** Références connues jamais citées dans le texte. */
  uncited: string[];
}

/**
 * Ordre d'apparition des citations dans les sections (ordre de lecture) :
 * la bibliographie Vancouver est numérotée dans cet ordre.
 */
export function citationOrder(
  sectionContents: ReadonlyArray<string | undefined>,
  knownRefIds: ReadonlyArray<string>,
): CitationOrder {
  const known = new Set(knownRefIds);
  const ordered: string[] = [];
  const unknown: string[] = [];
  for (const content of sectionContents) {
    if (!content) continue;
    for (const match of content.matchAll(CITATION_TOKEN_RE)) {
      const id = match[1];
      if (known.has(id)) {
        if (!ordered.includes(id)) ordered.push(id);
      } else if (!unknown.includes(id)) {
        unknown.push(id);
      }
    }
  }
  const uncited = knownRefIds.filter((id) => !ordered.includes(id));
  return { ordered, unknown, uncited };
}

/**
 * Remplace les tokens `[@id]` par leur appel numéroté `[n]` (ordre d'apparition).
 * Token inconnu → `[?]` (signalé par ailleurs, jamais silencieux).
 */
export function renderCitations(text: string, ordered: ReadonlyArray<string>): string {
  return text.replace(CITATION_TOKEN_RE, (_m, id: string) => {
    const idx = ordered.indexOf(id);
    return idx >= 0 ? `[${idx + 1}]` : '[?]';
  });
}

// ── Formatage des références (Vancouver / APA) ───────────────────────────────

function s(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function refAuthors(ref: ArticleReference, style: 'vancouver' | 'apa'): string {
  const authors = (ref.authors ?? []).map((a) => s(a)).filter(Boolean);
  if (!authors.length) return '';
  if (style === 'vancouver') {
    // Vancouver : 6 premiers auteurs puis « et al. »
    const shown = authors.slice(0, 6).join(', ');
    return authors.length > 6 ? `${shown}, et al.` : shown;
  }
  // APA simplifié : liste séparée par virgules, « & » avant le dernier.
  if (authors.length === 1) return authors[0];
  return `${authors.slice(0, -1).join(', ')} & ${authors[authors.length - 1]}`;
}

/** Référence au format Vancouver (l'index d'appel `[n]` est géré par l'appelant). */
export function formatReferenceVancouver(ref: ArticleReference): string {
  const parts: string[] = [];
  const authors = refAuthors(ref, 'vancouver');
  if (authors) parts.push(`${authors}.`);
  if (s(ref.title)) parts.push(`${s(ref.title).replace(/\.$/, '')}.`);
  if (s(ref.journal)) {
    let cite = s(ref.journal).replace(/\.$/, '');
    if (s(ref.year)) {
      cite += `. ${s(ref.year)}`;
      if (s(ref.volume)) {
        cite += `;${s(ref.volume)}`;
        if (s(ref.issue)) cite += `(${s(ref.issue)})`;
        if (s(ref.pages)) cite += `:${s(ref.pages)}`;
      } else if (s(ref.pages)) {
        cite += `:${s(ref.pages)}`;
      }
    }
    parts.push(`${cite}.`);
  } else if (s(ref.year)) {
    parts.push(`${s(ref.year)}.`);
  }
  if (s(ref.doi)) parts.push(`doi:${s(ref.doi).replace(/^doi:\s*/i, '')}`);
  else if (s(ref.url)) parts.push(s(ref.url));
  return parts.join(' ').trim();
}

/** Référence au format APA simplifié (aperçu / export ; Vancouver reste le défaut). */
export function formatReferenceApa(ref: ArticleReference): string {
  const parts: string[] = [];
  const authors = refAuthors(ref, 'apa');
  if (authors) parts.push(authors);
  if (s(ref.year)) parts.push(`(${s(ref.year)}).`);
  if (s(ref.title)) parts.push(`${s(ref.title).replace(/\.$/, '')}.`);
  if (s(ref.journal)) {
    let cite = s(ref.journal).replace(/\.$/, '');
    if (s(ref.volume)) {
      cite += `, ${s(ref.volume)}`;
      if (s(ref.issue)) cite += `(${s(ref.issue)})`;
    }
    if (s(ref.pages)) cite += `, ${s(ref.pages)}`;
    parts.push(`${cite}.`);
  }
  if (s(ref.doi)) parts.push(`https://doi.org/${s(ref.doi).replace(/^doi:\s*/i, '')}`);
  else if (s(ref.url)) parts.push(s(ref.url));
  return parts.join(' ').trim();
}

// ── Contexte minimisé pour l'IA ──────────────────────────────────────────────

export interface AiSectionContext {
  /** Métadonnées utiles au ton (jamais les auteurs : inutile à la correction). */
  meta: { title?: string; docType: ArticleDocType; targetJournal?: string; language?: string };
  /** Plan de l'article (titres de sections seulement) pour situer la section. */
  outline: string[];
  /** Titre de la section travaillée. */
  sectionTitle: string;
  /** Texte de la section, appels de citation rendus en `[n]`. */
  text: string;
  counts: CharCounts;
}

/**
 * Construit le contexte MINIMISÉ envoyé à l'IA pour travailler UNE section :
 * métadonnées de cadrage + plan (titres) + texte de la section (citations
 * rendues `[n]`). Jamais les auteurs, jamais les autres sections in extenso.
 */
export function buildAiSectionContext(
  document: unknown,
  sectionId: unknown,
): AiSectionContext | null {
  const doc = (document && typeof document === 'object' ? document : {}) as Record<string, unknown>;
  const meta = (doc.meta as Record<string, unknown> | undefined) ?? {};
  const sections = Array.isArray(doc.sections)
    ? (doc.sections.filter((x) => x && typeof x === 'object') as Record<string, unknown>[])
    : [];
  const references = Array.isArray(doc.references)
    ? (doc.references.filter((x) => x && typeof x === 'object') as Record<string, unknown>[])
    : [];

  const section = sections.find((sec) => sec.id === sectionId);
  if (!section) return null;

  const refIds = references.map((r) => s(r.id)).filter(Boolean);
  const order = citationOrder(sections.map((sec) => s(sec.content)), refIds);
  const raw = s(section.content).slice(0, MAX_AI_TEXT_CHARS);
  const text = renderCitations(raw, order.ordered);

  return {
    meta: {
      title: s(meta.title) || undefined,
      docType: coerceDocType(meta.docType),
      targetJournal: s(meta.targetJournal) || undefined,
      language: s(meta.language) || undefined,
    },
    outline: sections.map((sec) => s(sec.title)).filter(Boolean),
    sectionTitle: s(section.title) || 'Section',
    text,
    counts: countText(text),
  };
}

// ── Rapport du contrôle d'originalité (parseur tolérant) ────────────────────

export interface OriginalityFinding {
  /** Extrait du texte de l'utilisateur jugé trop proche d'une source existante. */
  passage: string;
  /** Pourquoi c'est un risque (formulation identique, structure copiée…). */
  concern: string;
  /** Source la plus proche identifiée (si trouvée par la recherche web). */
  sourceTitle?: string;
  sourceUrl?: string;
  /** Piste de reformulation proposée (à retravailler par l'auteur). */
  suggestion?: string;
}

export interface OriginalityReport {
  verdict: 'ok' | 'attention' | 'risque';
  /** 0 (aucun signal) → 100 (recouvrement massif) — indicatif, jamais une preuve. */
  riskScore: number;
  summary: string;
  findings: OriginalityFinding[];
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

/**
 * Parse le rapport d'originalité renvoyé par generateText (+ web_search).
 * Tolérant sur la forme, STRICT sur le fond : verdict inconnu → null (le client
 * affiche alors une erreur, jamais un faux « tout va bien »).
 */
export function parseOriginalityReport(raw: string): OriginalityReport | null {
  const obj = extractJsonObject(raw);
  if (!obj) return null;
  const verdict = obj.verdict;
  if (verdict !== 'ok' && verdict !== 'attention' && verdict !== 'risque') return null;

  const findings: OriginalityFinding[] = [];
  if (Array.isArray(obj.findings)) {
    for (const f of obj.findings.slice(0, 30)) {
      if (!f || typeof f !== 'object') continue;
      const o = f as Record<string, unknown>;
      const passage = s(o.passage);
      const concern = s(o.concern);
      if (!passage && !concern) continue;
      findings.push({
        passage: passage.slice(0, 600),
        concern: concern.slice(0, 600),
        sourceTitle: s(o.sourceTitle).slice(0, 300) || undefined,
        sourceUrl: /^https?:\/\//i.test(s(o.sourceUrl)) ? s(o.sourceUrl).slice(0, 500) : undefined,
        suggestion: s(o.suggestion).slice(0, 800) || undefined,
      });
    }
  }

  const rawScore = typeof obj.riskScore === 'number' ? obj.riskScore : Number(obj.riskScore);
  const riskScore = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;

  return { verdict, riskScore, summary: s(obj.summary).slice(0, 1200), findings };
}
