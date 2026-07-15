/**
 * POST /api/qcm — Génération d'un mini-examen de QCM/QCS type EDN à la demande.
 *
 * Feature « Section QCM » du chatbot étudiant (2026-07) : l'étudiant clique sous une
 * réponse du chat pour s'entraîner ; on génère des questions à choix (QCM à plusieurs
 * bonnes réponses / QCS à réponse unique, nombre de propositions variable) sur le sujet
 * de la conversation. La NOTATION est déterministe côté client (src/qcm/qcm.ts, barème
 * EDN « discordances ») — l'IA ne fournit que la grille (propositions correct/incorrect
 * + justifications), jamais un score.
 *
 * Sécurité : outil réservé aux comptes vérifiés ÉTUDIANT (et pro/admin, comme les autres
 * outils pédagogiques). Autorisation dérivée du PROFIL VÉRIFIÉ côté serveur
 * (resolveChatPersona), jamais du body. Rien n'est archivé. Aucun conseil médical
 * individuel : ce sont des questions d'entraînement sur des connaissances générales.
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "qcm_generate") est configurable
 * depuis le panel admin (app/(admin)/index.tsx). Si tu ajoutes une étape IA ici,
 * déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { generateObject } from 'ai';
import { z } from 'zod';

import { isAdminUserId } from '@/admin/index';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { resolveChatPersona } from '@/ai/routing/serverPersona';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { validateQcm, QCM_LIMITS } from '@/qcm/qcm';

const propositionSchema = z.object({
  text: z.string().min(1).max(600),
  correct: z.boolean(),
  explanation: z.string().max(1200),
});

const questionSchema = z.object({
  kind: z.enum(['QCM', 'QCS']),
  stem: z.string().min(1).max(2000),
  propositions: z
    .array(propositionSchema)
    .min(QCM_LIMITS.minPropositions)
    .max(QCM_LIMITS.maxPropositions),
});

const qcmSchema = z.object({
  title: z.string().max(200),
  topic: z.string().max(200),
  questions: z.array(questionSchema).min(QCM_LIMITS.minQuestions).max(QCM_LIMITS.maxQuestions),
});

const MAX_CONTEXT_CHARS = 6000;

type Body = {
  /** Sujet libre saisi (optionnel). */
  topic?: unknown;
  /** Contexte de conversation (dernier échange) pour cibler le QCM. */
  context?: unknown;
  /** Nombre de questions souhaité (indicatif, borné). */
  count?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  // Quota technique (réutilise le compteur étudiant) — aucun contenu stocké.
  const rateLimit = await checkChatRateLimit(request, 'student');
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Limite de générations atteinte pour aujourd\'hui.' },
      { status: 429 },
    );
  }

  // Persona EFFECTIVE dérivée du profil vérifié (jamais du body) — étudiant/pro/admin.
  const resolution = await resolveChatPersona(request, null);
  const isAdmin = resolution.userId ? isAdminUserId(resolution.userId) : false;
  if (!isAdmin && resolution.persona !== 'student' && resolution.persona !== 'professional') {
    return Response.json(
      { error: 'Section QCM réservée aux comptes vérifiés étudiant.' },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 400) : '';
  const context = typeof body.context === 'string' ? body.context.trim().slice(0, MAX_CONTEXT_CHARS) : '';
  if (!topic && !context) {
    return Response.json(
      { error: 'Aucun sujet : pose d\'abord une question dans le chat ou précise un thème.' },
      { status: 400 },
    );
  }

  const countRaw = Math.floor(Number(body.count));
  const count = Number.isFinite(countRaw)
    ? Math.min(QCM_LIMITS.maxQuestions, Math.max(QCM_LIMITS.minQuestions, countRaw))
    : 5;

  const [system, runtime] = await Promise.all([
    getPromptTemplate('qcm_generate'),
    getRuntimeForFeature('qcm_generate'),
  ]);
  // generateObject n'accepte pas d'outils (web_search) : on retire `tools` des options.
  const { tools: _tools, ...callOptions } = runtime.options;

  const prompt =
    (topic ? `SUJET DEMANDÉ : ${topic}\n\n` : '') +
    (context
      ? `EXTRAIT DE LA CONVERSATION (sers-t'en pour cibler le sujet et le niveau, ne le recopie pas) :\n"""${context}"""\n\n`
      : '') +
    `Génère ${count} question(s) d'entraînement type EDN sur ce sujet, en mélangeant QCS et QCM, ` +
    'avec un nombre de propositions variable (3 à 6). Chaque proposition doit avoir une justification.';

  try {
    const { object } = await generateObject({
      model: runtime.model,
      system,
      schema: qcmSchema,
      prompt,
      ...callOptions,
    });
    // Défense en profondeur : on revalide/normalise (déduction du type, bornes, grille non vide).
    const qcm = validateQcm(object);
    if (!qcm) {
      return Response.json(
        { error: 'QCM inexploitable. Réessaie ou précise le sujet.' },
        { status: 502 },
      );
    }
    return Response.json({ qcm });
  } catch (e) {
    console.error('QCM generate error:', e);
    return Response.json({ error: 'Échec de la génération du QCM. Réessaie dans un instant.' }, { status: 502 });
  }
}
