/**
 * GET /api/cron/weekly-blog — déclenche l'agent éditorial hebdomadaire du blog
 * (pipeline sujet → rédaction → relecture → publication, src/blog/weeklyAgent.ts).
 *
 * Déclenchement :
 *   - Cron Vercel (vercel.json "crons", lundi 06:00 UTC) — Vercel envoie
 *     automatiquement `Authorization: Bearer ${CRON_SECRET}` si la variable
 *     d'environnement CRON_SECRET est définie sur le projet. Sans CRON_SECRET,
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

function isVercelCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  let force = false;

  if (!isVercelCron(request)) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    force = new URL(request.url).searchParams.get('force') === '1';
  }

  try {
    const result = await runWeeklyBlogAgent(force);
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inattendue du pipeline.';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
