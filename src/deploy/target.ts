/**
 * Cible de déploiement de l'application web — source unique de vérité.
 *
 * Le projet peut tourner sur deux hébergements :
 *   - `vercel` : historique (Vercel Function + CDN, `vercel.json` + `api/index.js`) ;
 *   - `hostinger` : serveur Node autonome (`server/index.mjs`, docs/09_DEPLOYMENT_HOSTINGER.md).
 *
 * Deux choses dépendent RÉELLEMENT de cette information et ne peuvent pas être devinées à
 * l'exécution :
 *   1. les scripts Vercel Web Analytics / Speed Insights, qui n'existent que sur Vercel
 *      (sur un autre hébergeur ils échouent en 404 à chaque page — inutile et bruyant) ;
 *   2. l'identité de l'HÉBERGEUR dans les mentions légales, obligation LCEN art. 6-III :
 *      afficher « Vercel » alors que le site est servi par Hostinger serait une mention
 *      légale FAUSSE.
 *
 * La valeur est figée dans le bundle à la compilation (`EXPO_PUBLIC_*`) : elle doit être
 * posée AU MOMENT DU BUILD, pas au démarrage du serveur. Défaut = `vercel`, l'hébergement
 * en place : tant que rien n'est configuré, rien ne change.
 */

export type DeployTarget = 'vercel' | 'hostinger';

/** Lu littéralement pour que le babel plugin Expo puisse l'inliner dans le bundle. */
const RAW_TARGET = process.env.EXPO_PUBLIC_DEPLOY_TARGET;

/**
 * Normalise la cible de déploiement. Toute valeur inconnue retombe sur `vercel`
 * (l'hébergement historique) plutôt que d'inventer un hébergeur.
 */
export function resolveDeployTarget(raw: string | undefined = RAW_TARGET): DeployTarget {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'hostinger' || value === 'node' || value === 'self-hosted') return 'hostinger';
  return 'vercel';
}

/**
 * Les scripts Vercel Analytics / Speed Insights doivent-ils être montés ?
 * Ils ne fonctionnent que servis par Vercel.
 */
export function isVercelAnalyticsEnabled(raw: string | undefined = RAW_TARGET): boolean {
  return resolveDeployTarget(raw) === 'vercel';
}

/** Identité de l'hébergeur affichée dans les mentions légales (LCEN art. 6-III). */
export type HostingProvider = {
  /** Raison sociale de l'hébergeur. */
  name: string;
  /** Adresse du siège, telle que publiée par l'hébergeur. */
  address: string;
  /** Phrase prête à afficher dans les mentions légales. */
  sentence: string;
  /** Libellé court utilisé dans la liste des sous-traitants (RGPD art. 28). */
  processorLine: string;
};

/**
 * ⚠️ Le pays d'hébergement réel dépend du plan et de la région choisis chez Hostinger
 * (l'entreprise opère des centres de données dans plusieurs pays). Il n'est pas inventé
 * ici : Hugo doit le renseigner après avoir vu la région du serveur dans hPanel, comme les
 * autres champs « [À COMPLÉTER … ] » de `legal.ts`.
 */
const HOSTINGER_REGION_PLACEHOLDER = '[À COMPLÉTER : région du serveur affichée dans hPanel]';

const PROVIDERS: Record<DeployTarget, HostingProvider> = {
  vercel: {
    name: 'Vercel Inc.',
    address: '340 S Lemon Ave #4133, Walnut, CA 91789, USA',
    sentence: "L'application web est hébergée par Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA).",
    processorLine: "Vercel — hébergement applicatif et diffusion de l'interface.",
  },
  hostinger: {
    name: 'Hostinger International Ltd.',
    address: '61 Lordou Vironos Street, 6023 Larnaca, Chypre',
    sentence: `L'application web est hébergée par Hostinger International Ltd. (61 Lordou Vironos Street, 6023 Larnaca, Chypre) — serveur situé en ${HOSTINGER_REGION_PLACEHOLDER}.`,
    processorLine: "Hostinger — hébergement applicatif et diffusion de l'interface.",
  },
};

/** Hébergeur correspondant à la cible de déploiement active. */
export function getHostingProvider(raw: string | undefined = RAW_TARGET): HostingProvider {
  return PROVIDERS[resolveDeployTarget(raw)];
}
