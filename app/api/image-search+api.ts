/**
 * Route API recherche d'image d'illustration — GET /api/image-search?q=…
 *
 * Proxy serveur vers Google Custom Search (Programmable Search Engine,
 * searchType=image) : la clé `GOOGLE_SEARCH_API_KEY` et le `GOOGLE_SEARCH_ENGINE_ID`
 * ne quittent jamais le serveur. Utilisée par le client pour résoudre les marqueurs
 * `<!--IMG: requête | légende -->` émis par les 3 chatbots (src/ai/chat/imageSearch.ts).
 *
 * Pas d'appel LLM ici (aucune feature key admin) ; cache mémoire 24h par requête
 * pour économiser le quota Google (100 requêtes/jour gratuites).
 */
import {
  isImageSearchConfigured,
  normalizeImageQuery,
  pickImageResult,
} from '@/ai/chat/imageSearch';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; body: string }>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(request: Request): Promise<Response> {
  if (!isImageSearchConfigured()) {
    return json({ error: 'not_configured' }, 503);
  }

  const query = normalizeImageQuery(new URL(request.url).searchParams.get('q'));
  if (!query) {
    return json({ error: 'invalid_query' }, 400);
  }

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return new Response(cached.body, {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' },
    });
  }

  const params = new URLSearchParams({
    key: process.env.GOOGLE_SEARCH_API_KEY as string,
    cx: process.env.GOOGLE_SEARCH_ENGINE_ID as string,
    q: query,
    searchType: 'image',
    num: '5',
    safe: 'active',
    hl: 'fr',
  });

  let payload: unknown;
  try {
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
    if (!res.ok) return json({ error: 'search_failed' }, 502);
    payload = await res.json();
  } catch {
    return json({ error: 'search_failed' }, 502);
  }

  const body = JSON.stringify({ image: pickImageResult(payload) });

  // Cache borné (les résultats vides sont aussi mis en cache : ils consomment du quota).
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, { at: Date.now(), body });

  return new Response(body, {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' },
  });
}
