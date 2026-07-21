/**
 * POST /api/article — Aides IA du module « Rédaction d'article médical » (ADR-0031).
 *
 * Trois modes, trois features IA distinctes (configurables au panel admin) :
 *   - mode "assist"      (feature `article_assist`)      : améliorer / corriger / clarifier /
 *     transition / traduction scientifique / titres / avis de structure, sur UNE section ;
 *   - mode "reduce"      (feature `article_reduce`)      : réduire la section à une limite
 *     de caractères ou de mots, vérification DÉTERMINISTE du compte côté serveur ;
 *   - mode "originality" (feature `article_originality`) : contrôle d'originalité par
 *     recherche web (formulations trop proches de sources publiées), INDICATIF — ne
 *     remplace pas un logiciel anti-plagiat institutionnel.
 *
 * Le texte proposé est TOUJOURS appliqué par l'utilisateur (bouton côté client) — jamais
 * de réécriture silencieuse. L'IA n'invente ni fait, ni chiffre, ni référence (prompts).
 * Rien n'est archivé ici (la sauvegarde passe par /api/article-docs, own-row RLS).
 *
 * Sécurité (ADR-0018) : outil réservé aux comptes vérifiés ÉTUDIANT / PROFESSIONNEL (et
 * admins). Autorisation dérivée du PROFIL VÉRIFIÉ côté serveur (resolveChatPersona),
 * jamais du body. Minimisation : contexte construit par buildAiSectionContext (une
 * section + plan, jamais les auteurs ni le manuscrit entier).
 *
 * ⚠️  CONVENTION : les modèles utilisés (feature keys: "article_assist", "article_reduce",
 * "article_originality") sont configurables depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import { isAdminUserId } from '@/admin/index';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { logFeatureUsage } from '@/ai/logging/logFeatureUsage';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { resolveChatPersona } from '@/ai/routing/serverPersona';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import {
  MAX_AI_TEXT_CHARS,
  MAX_ORIGINALITY_CHARS,
  buildAiSectionContext,
  countText,
  parseOriginalityReport,
} from '@/article/articleDocument';

/** Instructions d'aide à la rédaction acceptées (whitelist serveur). */
const ASSIST_INSTRUCTIONS = [
  'improve',      // améliorer le style scientifique
  'correct',      // orthographe / grammaire / ponctuation
  'clarify',      // clarifier sans raccourcir
  'transition',   // proposer une transition avec la suite du plan
  'translate_en', // traduire en anglais scientifique
  'titles',       // suggérer des titres
  'structure',    // avis de structure (conseils, pas de texte de remplacement)
  'custom',       // consigne libre de l'utilisateur
] as const;
type AssistInstruction = (typeof ASSIST_INSTRUCTIONS)[number];

const ASSIST_LABELS: Record<AssistInstruction, string> = {
  improve: 'Améliore le style scientifique de la section (sobriété, précision, temps d’usage).',
  correct: 'Corrige uniquement orthographe, grammaire, ponctuation et typographie — aucune reformulation de fond.',
  clarify: 'Clarifie les phrases ambiguës ou trop longues sans changer le contenu scientifique.',
  transition: 'Améliore les enchaînements internes et propose une transition naturelle vers la section suivante du plan.',
  translate_en: 'Traduis la section en anglais scientifique de niveau publication (medical academic English).',
  titles: 'Propose 5 à 8 titres adaptés au type de document et au contenu (renvoie-les dans titleIdeas, revisedText vide).',
  structure: 'Donne un avis de structure sur cette section au regard du plan (dans advice, revisedText vide).',
  custom: 'Applique la consigne de l’utilisateur ci-dessous, dans le respect strict de tes règles.',
};

const assistSchema = z.object({
  /** Texte révisé complet, prêt à remplacer la section ('' si titles/structure). */
  revisedText: z.string().max(60_000),
  /** Avis de structure (instruction "structure") ; '' sinon. */
  advice: z.string().max(4_000),
  changes: z
    .array(
      z.object({
        kind: z.enum(['style', 'grammar', 'clarity', 'concision', 'structure', 'translation', 'other']),
        description: z.string().max(300),
      }),
    )
    .max(30),
  cautions: z.array(z.string().max(400)).max(15),
  titleIdeas: z.array(z.string().max(300)).max(10),
});

const reduceSchema = z.object({
  revisedText: z.string().max(60_000),
  /** Types de coupes effectuées (transparence). */
  removed: z.array(z.string().max(300)).max(20),
  cautions: z.array(z.string().max(400)).max(15),
});

type Body = {
  mode?: unknown;
  document?: unknown;
  sectionId?: unknown;
  instruction?: unknown;
  customInstruction?: unknown;
  target?: unknown;
  text?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  // Quota technique (réutilise le compteur étudiant) — aucun contenu stocké ici.
  const rateLimit = await checkChatRateLimit(request, 'student');
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Limite d\'aides IA atteinte pour aujourd\'hui.' }, { status: 429 });
  }

  // Persona EFFECTIVE dérivée du profil vérifié (jamais du body) — étudiant/pro/admin.
  const resolution = await resolveChatPersona(request, null);
  const isAdmin = resolution.userId ? isAdminUserId(resolution.userId) : false;
  if (!isAdmin && resolution.persona !== 'student' && resolution.persona !== 'professional') {
    return Response.json(
      { error: 'Outil réservé aux comptes vérifiés étudiant ou professionnel.' },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  if (body.mode === 'assist') return assist(body);
  if (body.mode === 'reduce') return reduce(body);
  if (body.mode === 'originality') return originality(body);
  return Response.json({ error: 'mode invalide (assist | reduce | originality).' }, { status: 400 });
}

// ── mode "assist" — aide à la rédaction d'une section ────────────────────────

async function assist(body: Body): Promise<Response> {
  const instruction = ASSIST_INSTRUCTIONS.includes(body.instruction as AssistInstruction)
    ? (body.instruction as AssistInstruction)
    : 'improve';

  const ctx = buildAiSectionContext(body.document, body.sectionId);
  if (!ctx) return Response.json({ error: 'Section introuvable dans le document.' }, { status: 400 });
  if (!ctx.text.trim() && instruction !== 'titles' && instruction !== 'structure') {
    return Response.json({ error: 'Écris d\'abord du texte dans cette section.' }, { status: 400 });
  }

  const custom =
    instruction === 'custom' && typeof body.customInstruction === 'string'
      ? body.customInstruction.trim().slice(0, 1_000)
      : '';
  if (instruction === 'custom' && !custom) {
    return Response.json({ error: 'Consigne personnalisée vide.' }, { status: 400 });
  }

  const [system, runtime] = await Promise.all([
    getPromptTemplate('article_assist'),
    getRuntimeForFeature('article_assist'),
  ]);
  // generateObject ne prend pas d'outils (web_search) : on retire `tools` des options.
  const { tools: _tools, ...callOptions } = runtime.options;

  const prompt =
    `TYPE DE DOCUMENT : ${ctx.meta.docType}` +
    (ctx.meta.title ? `\nTITRE DU MANUSCRIT : ${ctx.meta.title}` : '') +
    (ctx.meta.targetJournal ? `\nREVUE / CONGRÈS CIBLE : ${ctx.meta.targetJournal}` : '') +
    `\nPLAN : ${ctx.outline.join(' → ') || '(vide)'}` +
    `\nSECTION TRAVAILLÉE : ${ctx.sectionTitle}` +
    `\n\nINSTRUCTION : ${ASSIST_LABELS[instruction]}` +
    (custom ? `\nCONSIGNE UTILISATEUR : """${custom}"""` : '') +
    `\n\nTEXTE DE LA SECTION (les appels de citation [1], [2]… doivent être conservés) :\n"""${ctx.text}"""`;

  try {
    const { object, usage } = await generateObject({
      model: runtime.model,
      system,
      schema: assistSchema,
      prompt,
      ...callOptions,
    });
    logFeatureUsage({ feature: 'article_assist', modelId: runtime.modelId, usage });
    return Response.json({
      ...object,
      counts: object.revisedText ? countText(object.revisedText) : null,
    });
  } catch (e) {
    console.error('Article assist error:', e);
    return Response.json({ error: 'Échec de l\'aide à la rédaction. Réessaie dans un instant.' }, { status: 502 });
  }
}

// ── mode "reduce" — réduction à la limite imposée ────────────────────────────

const TARGET_KINDS = ['chars', 'chars_no_spaces', 'words'] as const;
type TargetKind = (typeof TARGET_KINDS)[number];
const TARGET_LABELS: Record<TargetKind, string> = {
  chars: 'caractères ESPACES COMPRISES',
  chars_no_spaces: 'caractères HORS espaces',
  words: 'mots',
};

async function reduce(body: Body): Promise<Response> {
  const ctx = buildAiSectionContext(body.document, body.sectionId);
  if (!ctx) return Response.json({ error: 'Section introuvable dans le document.' }, { status: 400 });
  if (!ctx.text.trim()) {
    return Response.json({ error: 'Écris d\'abord du texte dans cette section.' }, { status: 400 });
  }

  const t = (body.target ?? {}) as { kind?: unknown; max?: unknown };
  const kind: TargetKind = TARGET_KINDS.includes(t.kind as TargetKind) ? (t.kind as TargetKind) : 'chars';
  const max = Math.floor(Number(t.max));
  if (!Number.isFinite(max) || max < 10 || max > MAX_AI_TEXT_CHARS) {
    return Response.json({ error: 'Limite cible invalide.' }, { status: 400 });
  }

  const current =
    kind === 'chars' ? ctx.counts.withSpaces : kind === 'chars_no_spaces' ? ctx.counts.withoutSpaces : ctx.counts.words;
  if (current <= max) {
    return Response.json({ error: 'Le texte respecte déjà cette limite.' }, { status: 400 });
  }

  const [system, runtime] = await Promise.all([
    getPromptTemplate('article_reduce'),
    getRuntimeForFeature('article_reduce'),
  ]);
  const { tools: _tools, ...callOptions } = runtime.options;

  const prompt =
    `TYPE DE DOCUMENT : ${ctx.meta.docType}` +
    (ctx.meta.targetJournal ? `\nREVUE / CONGRÈS CIBLE : ${ctx.meta.targetJournal}` : '') +
    `\nSECTION : ${ctx.sectionTitle}` +
    `\nLONGUEUR ACTUELLE : ${current} ${TARGET_LABELS[kind]}` +
    `\nLIMITE À RESPECTER : ${max} ${TARGET_LABELS[kind]} (vise légèrement en dessous)` +
    `\n\nTEXTE À RÉDUIRE (conserve tous les faits, chiffres et appels [1], [2]…) :\n"""${ctx.text}"""`;

  try {
    const { object, usage } = await generateObject({
      model: runtime.model,
      system,
      schema: reduceSchema,
      prompt,
      ...callOptions,
    });
    logFeatureUsage({ feature: 'article_reduce', modelId: runtime.modelId, usage });
    // Vérification DÉTERMINISTE : on recompte nous-mêmes, jamais sur parole de l'IA.
    const counts = countText(object.revisedText);
    const achieved = kind === 'chars' ? counts.withSpaces : kind === 'chars_no_spaces' ? counts.withoutSpaces : counts.words;
    return Response.json({
      ...object,
      counts,
      target: { kind, max },
      withinLimit: achieved <= max,
    });
  } catch (e) {
    console.error('Article reduce error:', e);
    return Response.json({ error: 'Échec de la réduction. Réessaie dans un instant.' }, { status: 502 });
  }
}

// ── mode "originality" — contrôle d'originalité (recherche web) ──────────────

async function originality(body: Body): Promise<Response> {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 200) {
    return Response.json(
      { error: 'Fournis au moins quelques paragraphes (200 caractères) pour un contrôle utile.' },
      { status: 400 },
    );
  }

  const [system, runtime] = await Promise.all([
    getPromptTemplate('article_originality'),
    getRuntimeForFeature('article_originality'),
  ]);
  // Ici la recherche web est le cœur de la feature : on GARDE les tools du runtime.
  const { tools: webTools, ...callOptions } = runtime.options;

  try {
    const { text: raw, usage } = await generateText({
      model: runtime.model,
      system,
      prompt:
        'Contrôle l\'originalité du texte suivant (manuscrit de l\'auteur). Recherche sur le web ' +
        'les formulations trop proches de sources publiées, puis renvoie le rapport JSON demandé.\n\n' +
        `"""${text.slice(0, MAX_ORIGINALITY_CHARS)}"""`,
      ...callOptions,
      ...(webTools ? { tools: webTools } : {}),
    });
    logFeatureUsage({ feature: 'article_originality', modelId: runtime.modelId, usage });
    const report = parseOriginalityReport(raw);
    if (!report) {
      // Fail-closed : rapport inexploitable → erreur claire, jamais un faux « ok ».
      return Response.json({ error: 'Rapport d\'originalité inexploitable. Réessaie.' }, { status: 502 });
    }
    return Response.json(report);
  } catch (e) {
    console.error('Article originality error:', e);
    return Response.json({ error: 'Échec du contrôle d\'originalité. Réessaie dans un instant.' }, { status: 502 });
  }
}
