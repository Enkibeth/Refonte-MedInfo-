/**
 * POST /api/cv — Relecture IA d'un CV (module CV Builder, ADR-0028).
 *
 * Un relecteur expert en CV médical/professionnel. Il ne RÉÉCRIT PAS le CV : il renvoie
 * un rapport STRUCTURÉ de suggestions (orthographe, grammaire, style, cohérence, impact,
 * format) que l'utilisateur accepte ou refuse une par une côté client. Il n'archive RIEN
 * (la sauvegarde du CV passe par /api/cv-docs, own-row RLS).
 *
 * Sécurité (ADR-0018) : outil réservé aux comptes vérifiés ÉTUDIANT / PROFESSIONNEL (et
 * admins). L'autorisation est dérivée du PROFIL VÉRIFIÉ côté serveur (resolveChatPersona),
 * jamais du body. Minimisation RGPD : le client envoie déjà un CV nettoyé (sanitizeCvForAi),
 * mais on ne renvoie de toute façon que des suggestions textuelles.
 *
 * Règles strictes (prompt) : l'IA n'invente jamais une expérience, un diplôme, une
 * compétence ni une date ; elle ne propose que des améliorations à valider.
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "cv_review") est configurable depuis le
 * panel admin (app/(admin)/index.tsx). Si tu ajoutes une étape IA ici, déclare-la dans
 * src/admin/index.ts AI_FEATURES.
 */
import { generateObject } from 'ai';
import { z } from 'zod';

import { isAdminUserId } from '@/admin/index';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { resolveChatPersona } from '@/ai/routing/serverPersona';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { sanitizeCvForAi } from '@/cv/cvDocument';

const reviewSchema = z.object({
  globalScore: z.number().min(0).max(100),
  summary: z.string().max(600),
  blockingIssues: z
    .array(
      z.object({
        id: z.string().max(60),
        severity: z.enum(['high', 'medium', 'low']),
        section: z.string().max(60),
        message: z.string().max(400),
        suggestedAction: z.string().max(400),
      }),
    )
    .max(20),
  suggestions: z
    .array(
      z.object({
        id: z.string().max(60),
        type: z.enum(['spelling', 'grammar', 'style', 'coherence', 'impact', 'format']),
        severity: z.enum(['high', 'medium', 'low']),
        section: z.string().max(60),
        /** Chemin du champ visé côté client (ex. experiences.2.bullets.0). */
        fieldPath: z.string().max(120),
        originalText: z.string().max(2000),
        suggestedText: z.string().max(2000),
        explanation: z.string().max(400),
      }),
    )
    .max(60),
});

export async function POST(request: Request): Promise<Response> {
  // Quota technique (réutilise le compteur étudiant) — aucune donnée de CV stockée ici.
  const rateLimit = await checkChatRateLimit(request, 'student');
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Limite de relectures atteinte pour aujourd\'hui.' }, { status: 429 });
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

  let body: { document?: unknown; includeReferenceContactDetails?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  // Minimisation RGPD : on re-nettoie côté serveur (le client l'a déjà fait — défense en
  // profondeur). Jamais la photo ; coordonnées des référents seulement sur demande explicite.
  const cv = sanitizeCvForAi(body.document, {
    includeReferenceContactDetails: body.includeReferenceContactDetails === true,
  });

  const sections = Object.entries(cv).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === 'object') return Object.keys(v).length > 0;
    return Boolean(v);
  });
  if (sections.length === 0) {
    return Response.json({ error: 'Ajoute du contenu au CV avant de demander une relecture.' }, { status: 400 });
  }

  const [system, runtime] = await Promise.all([
    getPromptTemplate('cv_review'),
    getRuntimeForFeature('cv_review'),
  ]);
  // generateObject ne prend pas d'outils (web_search) : on retire `tools` des options.
  const { tools: _tools, ...callOptions } = runtime.options;

  try {
    const { object } = await generateObject({
      model: runtime.model,
      system,
      schema: reviewSchema,
      prompt:
        'Voici le CV à relire (JSON, contenu textuel uniquement). Analyse-le et renvoie ' +
        'le rapport structuré demandé. N\'invente jamais de fait absent du CV.\n\n' +
        `"""${JSON.stringify(cv)}"""`,
      ...callOptions,
    });
    return Response.json(object);
  } catch (e) {
    console.error('CV review error:', e);
    return Response.json({ error: 'Échec de la relecture. Réessaie dans un instant.' }, { status: 502 });
  }
}
