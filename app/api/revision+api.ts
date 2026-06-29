/**
 * POST /api/revision — Coup de pouce IA du dashboard de révision (ADR-0027, phase 2).
 *
 * Un coach d'ORGANISATION pédagogique : à partir du plan de l'étudiant (blocs, dates,
 * rythme) et des métriques RECALCULÉES côté serveur par le moteur déterministe, il propose
 * des ajustements de planning (reprioriser, alléger, rappels espacés). Il n'archive RIEN
 * (information d'organisation, pas de donnée de santé) et ne modifie pas le plan lui-même.
 *
 * Sécurité (ADR-0018) : outil réservé aux comptes vérifiés ÉTUDIANT (et admins).
 * L'autorisation est dérivée du PROFIL VÉRIFIÉ côté serveur (resolveChatPersona), jamais
 * du body. L'IA n'invente aucun volume/item/rang (prompt + contexte chiffré vérifié).
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "revision_plan_assist") est configurable
 * depuis le panel admin (app/(admin)/index.tsx). Si tu ajoutes une étape IA ici, déclare-la
 * dans src/admin/index.ts AI_FEATURES.
 */
import { generateText } from 'ai';

import { isAdminUserId } from '@/admin/index';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { resolveChatPersona } from '@/ai/routing/serverPersona';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { buildRevisionContext, coerceBoostRequest, intentInstruction } from '@/revision/ai/revisionPrompt';

export async function POST(request: Request): Promise<Response> {
  // Quota technique (réutilise le compteur étudiant) — aucune donnée de plan stockée.
  const rateLimit = await checkChatRateLimit(request, 'student');
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Limite de suggestions atteinte pour aujourd\'hui.' }, { status: 429 });
  }

  // Persona EFFECTIVE dérivée du profil vérifié (jamais du body) — réservé étudiant/admin.
  const resolution = await resolveChatPersona(request, null);
  const isAdmin = resolution.userId ? isAdminUserId(resolution.userId) : false;
  if (!isAdmin && resolution.persona !== 'student') {
    return Response.json(
      { error: 'Outil réservé aux comptes vérifiés étudiant.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const { intent, stored } = coerceBoostRequest(body);
  if (stored.resources.length === 0) {
    return Response.json({ error: 'Ajoute au moins un bloc de travail avant de demander un coup de pouce.' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const [template, runtime] = await Promise.all([
    getPromptTemplate('revision_plan_assist'),
    getRuntimeForFeature('revision_plan_assist'),
  ]);

  const system = `${template}${buildRevisionContext(stored, today)}`;

  try {
    const { text } = await generateText({
      model: runtime.model,
      system,
      messages: [{ role: 'user', content: intentInstruction(intent) }],
      ...runtime.options,
    });
    return Response.json({ text });
  } catch (e) {
    console.error('Revision boost error:', e);
    return Response.json({ error: 'Échec de la génération du coup de pouce.' }, { status: 502 });
  }
}
