/**
 * GET /llms.txt — index du site pour les assistants IA (src/seo/llms.ts).
 * Aucune donnée utilisateur : uniquement les pages publiques et leurs descriptions SEO.
 */
import { buildLlmsTxt } from '@/seo/llms';

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
