/**
 * GET /api/cron/weekly-blog — déclenche l'agent éditorial hebdomadaire du blog
 * (pipeline sujet → rédaction → relecture → publication, src/blog/weeklyAgent.ts).
 *
 * Déclenchement :
 *   - Cron système (hPanel « Cron Jobs » ou crontab, lundi 06:00 UTC) via
 *     `scripts/hostinger/weekly-blog-cron.sh`, qui envoie
 *     `Authorization: Bearer ${CRON_SECRET}`. Sans CRON_SECRET côté serveur,
 *     le déclenchement cron est refusé (fail-closed).
 *   - Manuel par un admin (token Supabase admin) — `?force=1` permet de passer
 *     la garde anti-doublon pour tester le pipeline.
 *
 * ⚠️  CONVENTION : les modèles utilisés (feature keys: "blog_topic",
 * "blog_generate", "blog_fact_check", "blog_copyedit", "blog_review") sont
 * configurables depuis le panel admin (app/(admin)/index.tsx). Si tu ajoutes
 * une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { requireAdmin } from '@/admin/index';
import { runWeeklyBlogAgent } from '@/blog/weeklyAgent';

function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  let force = false;

  if (!isCronRequest(request)) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    force = new URL(request.url).searchParams.get('force') === '1';
  }

  try {
    const result = await runWeeklyBlogAgent(force);
    console.log('[weekly-blog] résultat :', JSON.stringify(result));
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inattendue du pipeline.';
    console.error('[weekly-blog] erreur inattendue du pipeline :', e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
