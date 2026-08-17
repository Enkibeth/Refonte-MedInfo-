/**
 * Route de santé Vercel/Expo — GET /api/health.
 *
 * Ne renvoie jamais de secret. Sert de smoke-test après configuration des
 * variables Vercel/Supabase dédiées à MedInfo.
 */
import { getActiveModelId, getActiveProvider } from '@/ai/providers/index';
import { getServerSupabaseStatus } from '@/db/serverSupabase';

export function GET(): Response {
  return Response.json({
    ok: true,
    service: 'medinfo-ai',
    ai: {
      provider: getActiveProvider(),
      model: getActiveModelId(),
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    },
    supabase: getServerSupabaseStatus(),
  });
}
