/**
 * Renfort PHARMACOLOGIE des chats étudiant / professionnel (2026-07).
 *
 * Choix produit (Hugo) : plutôt qu'un 4e chatbot, on GREFFE une spécialisation
 * pharmacologie sur le prompt du chatbot. Cette section impose, pour les questions
 * médicamenteuses, la PRIORISATION des sources officielles (agence du médicament + RCP
 * du pays de l'utilisateur, EMA, interactions, littérature), une PROFONDEUR adaptée à la
 * complexité, et un cadrage SÛR des équivalences de doses — sans jamais devenir une
 * prescription individualisée.
 *
 * Retour à la base (2026-08, ADR-0037) : les outils serveur (Europe PMC,
 * verify_source_links) ont été retirés ; la priorisation s'appuie sur la recherche web du
 * provider. Les consignes ci-dessous ne référencent donc plus aucun outil.
 *
 * ⚠️ Module PUR : aucun nouvel appel LLM, aucun nouvel outil, aucune migration.
 * Réservé aux chats étudiant / professionnel (vide pour le grand public).
 */
import type { ChatbotId } from '@/ai/chat/chatContext';

export function buildPharmacologySection(chatbot: ChatbotId): string {
  if (chatbot === 'public') return '';

  return (
    `\n\nVOLET PHARMACOLOGIE (chat étudiant / professionnel)\n` +
    `Pour toute question médicamenteuse — posologie, adaptation (insuffisance rénale/hépatique, ` +
    `sujet âgé, poids), ÉQUIVALENCES DE DOSES (opioïdes, corticoïdes, benzodiazépines, IPP, ` +
    `IEC/ARA2…), interactions, contre-indications, effets indésirables, grossesse/allaitement, ` +
    `surdosage — appuie-toi sur une recherche web en PRIORISANT ces sources :\n` +
    `- Médicament / AMM / RCP : les sources officielles du pays de l'utilisateur (cf. CONTEXTE PAYS ` +
    `s'il est fourni ; par défaut ANSM + base-donnees-publique.medicaments.gouv.fr pour le RCP en ` +
    `France, EMA à l'échelle européenne).\n` +
    `- Interactions : un référentiel d'interactions officiel (ex. thésaurus des interactions de ` +
    `l'ANSM) ; à défaut, le RCP et la littérature.\n` +
    `- Grossesse / allaitement : une référence dédiée (ex. Le CRAT en France).\n` +
    `- Efficacité / équivalence / niveau de preuve : PubMed / Europe PMC + recommandations (HAS, ` +
    `sociétés savantes).\n` +
    `- Ne cite qu'une source que tu as RÉELLEMENT consultée dans tes résultats de recherche, avec ` +
    `son URL exacte : jamais une URL reconstruite de mémoire, jamais une référence non retrouvée.\n` +
    `PROFONDEUR ADAPTÉE À LA QUESTION : une question simple (ex. « dose usuelle de X chez l'adulte ? ») ` +
    `appelle une réponse COURTE et directe ; une question complexe (équivalence, insuffisance rénale, ` +
    `polymédication, terrain particulier) appelle une réponse STRUCTURÉE et détaillée (mécanisme, ` +
    `chiffres sourcés, précautions, alternatives).\n` +
    `ÉQUIVALENCES DE DOSES — cadrage SÛR obligatoire : donne des FOURCHETTES sourcées en précisant la ` +
    `BASE de conversion (facteur d'équi-analgésie / équivalence et sa référence) ; rappelle les limites ` +
    `(variabilité interindividuelle, tolérance croisée incomplète — réduire la dose calculée lors d'une ` +
    `rotation, marge thérapeutique étroite) ; n'invente JAMAIS un chiffre (si non retrouvé, dis-le) ; et ` +
    `termine par un rappel explicite : la conversion est indicative et doit être VALIDÉE par le ` +
    `prescripteur selon le RCP et le contexte du patient. Ne donne jamais une prescription individualisée ferme.\n` +
    `Signale toujours les points de sécurité pertinents : marge thérapeutique étroite, adaptation ` +
    `rénale/hépatique, interactions majeures, contre-indications, terrain (grossesse, sujet âgé).`
  );
}
