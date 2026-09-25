/**
 * Route de santé Expo — GET /api/health.
 *
 * Ne renvoie jamais de secret. Sert de smoke-test après configuration des
 * variables d'hébergement/Supabase dédiées à MedInfo.
 *
 * `deployTarget` vaut `hostinger` depuis la migration Node (2026-08) : pendant une bascule
 * DNS, c'est le moyen le plus simple de savoir si c'est bien le nouveau serveur qui a
 * répondu (l'ancien déploiement Vercel ne renvoyait pas ce champ).
 */
import { getActiveModelId, getActiveProvider } from '@/ai/providers/index';
import { getServerSupabaseStatus } from '@/db/serverSupabase';
import { DEPLOY_TARGET } from '@/deploy/hosting';

export function GET(): Response {
  return Response.json({
    ok: true,
    service: 'medinfo-ai',
    deployTarget: DEPLOY_TARGET,
    ai: {
      provider: getActiveProvider(),
      model: getActiveModelId(),
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    },
    supabase: getServerSupabaseStatus(),
  });
}
