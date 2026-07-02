/**
 * Garde de sécurité des URLs vérifiées côté serveur par les outils du chat.
 *
 * Le vérificateur de liens (`verify_source_links`) fait des requêtes sortantes depuis
 * le serveur : on n'autorise QUE des URLs http(s) publiques nommées — jamais d'IP
 * littérale, d'hôte interne ou de credentials dans l'URL (anti-SSRF).
 *
 * Module pur (server-safe), sans dépendance réseau.
 */

const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.lan', '.home', '.corp', '.intranet'];

export function isSafePublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  // Hôtes mono-label (localhost, intranet…) : jamais.
  if (!host.includes('.')) return false;
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return false;
  // IP littérales (v4 ou v6) : aucune source médicale légitime n'est citée par IP.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  // IPv6 : `new URL('https://[::1]/')` expose hostname `::1` (sans crochets).
  if (host.includes(':')) return false;
  return true;
}
