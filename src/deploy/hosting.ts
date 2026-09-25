/**
 * Hébergeur de l'application — source unique de vérité.
 *
 * Depuis la migration 2026-08, MedInfo AI est servi par un **serveur Node autonome**
 * (`server/index.mjs`) déployé chez Hostinger. Il n'y a plus qu'une cible : Vercel a été
 * retiré du dépôt (plus de `vercel.json`, plus de fonction, plus d'analytics Vercel).
 *
 * Ce module existe parce que deux surfaces doivent nommer l'hébergeur exactement :
 *   1. les **mentions légales** (LCEN art. 6-III) et la liste des sous-traitants RGPD —
 *      afficher le mauvais hébergeur serait une mention légale fausse ;
 *   2. `/api/health`, qui expose `deployTarget` : pendant la propagation DNS, c'est le
 *      moyen le plus simple de savoir si c'est bien le nouveau serveur qui a répondu
 *      (l'ancien déploiement Vercel, lui, ne renvoyait pas ce champ).
 */

/** Cible de déploiement unique du projet. */
export const DEPLOY_TARGET = 'hostinger' as const;

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
 * ⚠️ Le pays d'hébergement réel dépend de la région choisie chez Hostinger (l'entreprise
 * opère des centres de données dans plusieurs pays). Il n'est pas inventé ici : à
 * renseigner une fois la région visible dans hPanel, comme les autres champs
 * « [À COMPLÉTER … ] » de `src/compliance/legal.ts`.
 */
const REGION_PLACEHOLDER = '[À COMPLÉTER : région du serveur affichée dans hPanel]';

const HOSTINGER: HostingProvider = {
  name: 'Hostinger International Ltd.',
  address: '61 Lordou Vironos Street, 6023 Larnaca, Chypre',
  sentence: `L'application web est hébergée par Hostinger International Ltd. (61 Lordou Vironos Street, 6023 Larnaca, Chypre) — serveur situé en ${REGION_PLACEHOLDER}.`,
  processorLine: "Hostinger — hébergement applicatif et diffusion de l'interface.",
};

/** Hébergeur de l'application. */
export function getHostingProvider(): HostingProvider {
  return HOSTINGER;
}
