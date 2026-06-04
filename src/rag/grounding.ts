/**
 * Périmètre du cite-or-refuse (08_RAG, ADR-0012).
 *
 * L'étape 5 appliquait le cite-or-refuse à TOUS les messages : faute de source dans le
 * petit corpus, même un « bonjour » ou une question méta recevait « Les sources disponibles
 * ne permettent pas de répondre avec certitude. ». Le chat paraissait cassé.
 *
 * On restreint donc l'ancrage RAG aux messages qui portent une demande d'information
 * factuelle (santé/médicale). Les messages PUREMENT conversationnels (salutation, politesse,
 * méta sur l'assistant) passent au LLM sans RAG ; le prompt persona (public.v2/student.v2)
 * et la couche 3 (validation de sortie) continuent d'interdire diagnostic/conseil individualisé.
 *
 * Fail-safe : par défaut on EXIGE l'ancrage. Seul un message dont l'INTÉGRALITÉ correspond à
 * une formule conversationnelle connue est exempté ; la moindre adjonction (« bonjour, et pour
 * le diabète ? ») retombe en ancrage requis.
 */

const PURE_CONVERSATIONAL: RegExp[] = [
  // Salutations seules.
  /^(bonjour|bonsoir|salut|coucou|hello|hi|hey|yo|wesh|bonjour à (tous|toi))[\s!.,…]*$/i,
  // Politesse / clôture seules.
  /^(merci( beaucoup| bien)?|super|g[ée]nial|parfait|ok|okay|d'?accord|tr[èe]s bien|nickel|au revoir|à bient[ôo]t|bonne journ[ée]e|bonne soir[ée]e|à plus)[\s!.,…]*$/i,
  // Méta : identité de l'assistant.
  /^(qui es[\s-]?tu|tu es qui|c'?est quoi medinfo( ai)?|qu'?est[\s-]?ce que medinfo( ai)?|tu es quoi)[\s?!.,…]*$/i,
  // Méta : capacités / mode d'emploi.
  /^(que (peux[\s-]?tu|sais[\s-]?tu) faire|à quoi sers[\s-]?tu|tu sers à quoi|comment (ça|tu) march(e|es)|comment t'?utiliser|tu fais quoi|que proposes[\s-]?tu)[\s?!.,…]*$/i,
  // Demande d'aide générique seule.
  /^(peux[\s-]?tu m'?aider|tu peux m'?aider|j'?ai besoin d'?aide|aide[\s-]?moi)[\s?!.,…]*$/i,
];

/**
 * `true` si le message exige un ancrage RAG (cite-or-refuse). `false` uniquement pour les
 * messages purement conversationnels listés ci-dessus.
 */
export function requiresMedicalGrounding(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length === 0) return true; // vide → fail-safe (refusé en couche 1 de toute façon).
  return !PURE_CONVERSATIONAL.some((pattern) => pattern.test(normalized));
}
