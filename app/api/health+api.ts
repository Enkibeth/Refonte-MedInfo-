/**
 * Route de santé Expo — GET /api/health.
 *
 * Ne renvoie jamais de secret. Sert de smoke-test après configuration des
 * variables d'hébergement/Supabase dédiées à MedInfo.
 *
 * `deployTarget` reflète `EXPO_PUBLIC_DEPLOY_TARGET` : pendant une bascule d'hébergeur,
 * c'est le moyen le plus simple de savoir LEQUEL des deux déploiements a répondu sur le
 * domaine (la propagation DNS ne se lit pas depuis le navigateur).
 *
 * ⚠️ Contrairement au bundle client où la valeur est inlinée au build, une route API lit
 * `process.env` à l'EXÉCUTION : la variable doit donc être présente aussi sur le serveur,
 * sinon cette route annonce `vercel` par défaut (docs/09_DEPLOYMENT_HOSTINGER.md §2).
 */
import { getActiveModelId, getActiveProvider } from '@/ai/providers/index';
import { getServerSupabaseStatus } from '@/db/serverSupabase';
import { resolveDeployTarget } from '@/deploy/target';

export function GET(): Response {
  return Response.json({
    ok: true,
    service: 'medinfo-ai',
    deployTarget: resolveDeployTarget(),
    ai: {
      provider: getActiveProvider(),
      model: getActiveModelId(),
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    },
    supabase: getServerSupabaseStatus(),
  });
}
