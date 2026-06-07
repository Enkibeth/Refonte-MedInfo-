/**
 * POST /api/partiel — Analyseur de partiel (analyse de résultats QCM/partiels étudiants).
 *
 * Réservé aux ÉTUDIANTS vérifiés (persona dérivée du profil côté serveur, ADR-0011) —
 * un admin y accède aussi pour test. L'outil est strictement ÉDUCATIF / non-MDSW :
 * il analyse des résultats d'annales/QCM pédagogiques, jamais un cas patient réel
 * (le prompt refuse les données identifiantes ; aucune donnée de santé persistée).
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "partiel_analyze") est configurable
 * depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { streamText } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { resolveVerifiedUserId } from '@/auth/serverIdentity';
import { createServerSupabaseClient } from '@/db/serverSupabase';
import { isAdminUserId } from '@/admin/index';

const MIN_RESULTS_LENGTH = 20;
const MAX_RESULTS_LENGTH = 8000;

/** Lit la persona vérifiée du profil. Fail-safe `public` en cas de profil illisible. */
async function fetchPersona(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('persona')
      .eq('id', userId)
      .maybeSingle();
    const persona = (data as { persona?: unknown } | null)?.persona;
    return typeof persona === 'string' ? persona : 'public';
  } catch {
    return 'public';
  }
}

export async function POST(request: Request): Promise<Response> {
  // Compteur technique (quota étudiant), aucune donnée santé.
  const rateLimit = await checkChatRateLimit(request, 'student');
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Limite de requêtes atteinte.' }, { status: 429 });
  }

  // ── Garde d'audience (réservé étudiant vérifié / admin) ──────────────────────
  // L'autorisation est dérivée du PROFIL vérifié côté serveur, jamais du body client.
  // En l'absence de backend configuré (dev local sans Supabase), on n'oppose pas la
  // garde — l'app fonctionne alors en mode démo (cf featureModel/promptStore fallbacks).
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const userId = await resolveVerifiedUserId(request, supabase);
    const isStudentOrAdmin =
      !!userId && ((await fetchPersona(supabase, userId)) === 'student' || isAdminUserId(userId));
    if (!isStudentOrAdmin) {
      return Response.json(
        { error: 'Réservé aux étudiants en santé vérifiés.' },
        { status: 403 },
      );
    }
  }

  let body: { results?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const results = body.results?.trim() ?? '';
  if (results.length < MIN_RESULTS_LENGTH) {
    return Response.json(
      { error: `Résultats trop courts (minimum ${MIN_RESULTS_LENGTH} caractères).` },
      { status: 400 },
    );
  }

  const truncated = results.slice(0, MAX_RESULTS_LENGTH);

  try {
    const [runtime, systemPrompt] = await Promise.all([
      getRuntimeForFeature('partiel_analyze'),
      getPromptTemplate('partiel_analyze'),
    ]);
    const { tools: _webTools, ...callOptions } = runtime.options;

    const result = streamText({
      model: runtime.model,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Voici mes résultats de partiel / QCM à analyser :\n\n${truncated}`,
        },
      ],
      ...callOptions,
    });

    return result.toTextStreamResponse();
  } catch (e) {
    console.error('Partiel analyze error:', e);
    return Response.json({ error: 'Analyse impossible pour le moment.' }, { status: 502 });
  }
}
