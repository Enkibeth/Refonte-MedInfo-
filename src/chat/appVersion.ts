/**
 * Onglet resté sur une ancienne version de l'app (2026-10, ADR-0044).
 *
 * Le serveur annonce sur ses réponses d'API l'empreinte du bundle qu'il sert
 * (`X-MedInfo-Build`, server/lib/build-id.mjs) ; l'onglet connaît celle du bundle qu'il
 * exécute (nom haché du script d'entrée). Différentes : un déploiement a eu lieu depuis le
 * chargement de la page, le code affiché peut ne plus correspondre au serveur ; on propose
 * de recharger. Inconnue d'un côté ou de l'autre (développement, autre hébergeur) : rien.
 *
 * ⚠️ Fonctions pures + une lecture DOM gardée : tests/unit/app-version.test.ts.
 */

/** En-tête lu sur les réponses d'API (Fetch normalise en minuscules). */
export const BUILD_HEADER = 'x-medinfo-build';

const ENTRY_SRC_RE = /\/_expo\/static\/js\/web\/entry-([0-9a-f]{8,64})\.js(?:[?#]|$)/;

/** Empreinte d'un `src` de script d'entrée, ou null. */
export function bundleHashFromSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  return ENTRY_SRC_RE.exec(src)?.[1] ?? null;
}

/** Empreinte du bundle exécuté par cet onglet (web seulement), ou null. */
export function runningBuildId(): string | null {
  if (typeof document === 'undefined') return null;
  const script = document.querySelector<HTMLScriptElement>('script[src*="/_expo/static/js/web/entry-"]');
  return bundleHashFromSrc(script?.getAttribute('src'));
}

/** Le serveur sert-il une autre version que celle de l'onglet ? (inconnue → non) */
export function isStaleBuild(served: string | null | undefined, running: string | null | undefined): boolean {
  return !!served && !!running && served.trim() !== running;
}
