/**
 * En-têtes de sécurité HTTP du serveur Node autonome — logique PURE (aucune I/O), testée dans
 * `tests/unit/server-security.test.ts`.
 *
 * Deux familles :
 *   - en-têtes posés sur TOUTES les réponses (`BASE_SECURITY_HEADERS`) : anti-reniflage MIME,
 *     politique de référent, anti-clickjacking, permissions navigateur, isolation de fenêtre ;
 *   - la politique de sécurité du contenu (CSP), posée sur les DOCUMENTS HTML seulement
 *     (coquilles Expo + pages autonomes `public/*.html`).
 *
 * CSP par EMPREINTES : chaque script inline exécutable d'un document est haché (SHA-256) au
 * premier service du fichier, et seule cette liste est autorisée (+ les scripts de la même
 * origine). Un script injecté (XSS) n'a pas d'empreinte connue → bloqué. Pas de
 * `'unsafe-inline'` pour les scripts, pas de `'unsafe-eval'` : aucune des pages ne l'exige
 * (vérifié sur les outils autonomes et leurs librairies, cf. docs/03_SECURITY.md §7).
 * Les styles gardent `'unsafe-inline'` : react-native-web injecte ses feuilles et des
 * attributs `style` à l'exécution.
 *
 * Interrupteur d'exploitation `CSP` (variable d'environnement, effet au redémarrage) :
 *   - absent / `enforce` → appliquée ;
 *   - `report-only`      → `Content-Security-Policy-Report-Only` (violations visibles dans la
 *                          console du navigateur, rien n'est bloqué) ;
 *   - `off`              → aucune CSP (retour arrière sans redéploiement de code).
 */
import crypto from 'node:crypto';

/**
 * En-têtes posés sur chaque réponse (statiques, HTML, API).
 *
 * - `X-Frame-Options` + `frame-ancestors` (CSP) : le site ne peut être encadré que par
 *   lui-même (les outils `/partiel.html`, `/cv-builder.html`… sont des iframes de la même
 *   origine) — protection contre le détournement de clic.
 * - `Permissions-Policy` : micro autorisé pour la dictée (même origine), plein écran pour le
 *   chat ; caméra, géolocalisation, paiement, USB et ciblage publicitaire coupés.
 * - `Cross-Origin-Opener-Policy: same-origin-allow-popups` : une page tierce qui ouvre le
 *   site ne garde aucune référence à sa fenêtre ; nos propres fenêtres (sources ouvertes
 *   dans un nouvel onglet) restent permises.
 */
export const BASE_SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy':
    'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), fullscreen=(self), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
});

/** Services tiers appelés DEPUIS LE NAVIGATEUR (tout le reste passe par nos routes API). */
const THIRD_PARTY_CONNECT = Object.freeze([
  // Supabase : authentification, base (RLS), temps réel.
  'https://*.supabase.co',
  'wss://*.supabase.co',
  // Rédaction d'article : métadonnées bibliographiques par DOI / PMID (public/article.html).
  'https://api.crossref.org',
  'https://www.ebi.ac.uk',
]);

/**
 * Mode CSP lu dans l'environnement.
 * @param {Record<string, string | undefined>} env
 * @returns {'enforce' | 'report-only' | 'off'}
 */
export function cspModeFrom(env) {
  const raw = String(env.CSP ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === '0' || raw === 'false') return 'off';
  if (raw === 'report-only' || raw === 'report') return 'report-only';
  return 'enforce';
}

/**
 * Nom de l'en-tête CSP pour un mode donné (`null` si la CSP est coupée).
 * @param {'enforce' | 'report-only' | 'off'} mode
 */
export function cspHeaderName(mode) {
  if (mode === 'off') return null;
  return mode === 'report-only' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
}

/**
 * Origine Supabase personnalisée (domaine propre) à autoriser en plus de `*.supabase.co`.
 * @param {string | undefined} url
 * @returns {string[]}
 */
export function extraConnectOrigins(url) {
  if (!url) return [];
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname.endsWith('.supabase.co')) return [];
    return [parsed.origin, `wss://${parsed.host}`];
  } catch {
    return [];
  }
}

/** Types de `<script>` que le navigateur EXÉCUTE (les autres — JSON-LD… — sont des données). */
const EXECUTABLE_SCRIPT_TYPES = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
  'text/ecmascript',
]);

/**
 * Empreintes CSP (`'sha256-…'`) des scripts inline exécutables d'un document HTML.
 *
 * Le navigateur hache le texte EXACT entre `<script …>` et `</script>` : on le prend tel
 * quel, sans décodage d'entités (le contenu d'un `<script>` n'en contient pas au sens HTML).
 * Scripts à attribut `src` ignorés (couverts par `'self'`), de même que les blocs de données.
 *
 * @param {string} html
 * @returns {string[]} empreintes uniques, dans l'ordre d'apparition
 */
export function inlineScriptHashes(html) {
  const hashes = [];
  const seen = new Set();
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(pattern)) {
    const attributes = match[1] ?? '';
    const body = match[2] ?? '';
    if (/\bsrc\s*=/i.test(attributes)) continue;
    const typeMatch = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes);
    const type = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? '').trim().toLowerCase();
    if (!EXECUTABLE_SCRIPT_TYPES.has(type)) continue;
    if (body.length === 0) continue;
    const hash = `'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`;
    if (!seen.has(hash)) {
      seen.add(hash);
      hashes.push(hash);
    }
  }
  return hashes;
}

/**
 * Politique CSP d'un document.
 *
 * @param {{ scriptHashes?: string[]; connectExtra?: string[] }} [options]
 * @returns {string}
 */
export function buildCsp({ scriptHashes = [], connectExtra = [] } = {}) {
  const directives = [
    ["default-src", ["'self'"]],
    ['script-src', ["'self'", ...scriptHashes]],
    // react-native-web injecte ses feuilles de style et des attributs `style` à l'exécution.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    // Couvertures d'articles (Storage Supabase) et images insérées par l'admin (URL https).
    ['img-src', ["'self'", 'data:', 'blob:', 'https:']],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', ["'self'", ...THIRD_PARTY_CONNECT, ...connectExtra, 'data:', 'blob:']],
    ['media-src', ["'self'", 'data:', 'blob:']],
    // pdf.js (worker servi depuis /vendor) ; `blob:` pour son repli.
    ['worker-src', ["'self'", 'blob:']],
    // Outils autonomes embarqués (même origine) et aperçus de fichiers locaux.
    ['frame-src', ["'self'", 'blob:']],
    ['frame-ancestors', ["'self'"]],
    ['form-action', ["'self'"]],
    ['base-uri', ["'self'"]],
    ['object-src', ["'none'"]],
    ['manifest-src', ["'self'"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}
