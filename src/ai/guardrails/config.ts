/**
 * Interrupteur global de la safe-box du chat (couches 1 & 3).
 *
 * Décision produit TEMPORAIRE (Hugo, 2026-06-08 — ADR-0023) : pendant la mise au point
 * du chat, les garde-fous sur-bloquaient des questions pédagogiques légitimes
 * (ex. « Cours sur l'HTA » → refus canonique d'urgence, voir capture). Pour rétablir un
 * chat fonctionnel, on NEUTRALISE par défaut les barrières ACTIVES (classifieur pré-LLM
 * couche 1 + validation de sortie couche 3). La sécurité sera « remise par-dessus » plus
 * tard en réactivant ce flag, une fois le chat stabilisé.
 *
 * Important :
 *  - Le code des couches 1 & 3 est CONSERVÉ (jamais supprimé) et reste couvert par les
 *    tests, qui forcent `MEDINFO_GUARDRAILS=on`.
 *  - On garde la disclosure passive (bandeau « Information générale — ne remplace pas un
 *    avis médical individuel ») : ce n'est pas une barrière bloquante.
 *  - Le rate-limit anti-abus n'est pas concerné par ce flag.
 *
 * Réactivation de la safe-box : définir l'env `MEDINFO_GUARDRAILS=on`.
 */
export function guardrailsEnabled(): boolean {
  return process.env.MEDINFO_GUARDRAILS === 'on';
}
