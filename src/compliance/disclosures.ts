export const INTENDED_PURPOSE =
  "MedInfo AI est une plateforme conversationnelle d'information et de référence éducative fournissant des informations médicales et pharmacologiques générales tirées de la littérature médicale française et européenne publiquement disponible (HAS, ANSM, VIDAL, Thériaque, PubMed). Elle ne fournit aucune recommandation diagnostique, pronostique ou thérapeutique individuelle. Elle n'est pas destinée à remplacer, compléter ou influencer les décisions cliniques concernant un patient identifiable. Le produit n'est pas destiné à être un dispositif médical au sens de l'article 2(1) du règlement (UE) 2017/745 et n'est pas qualifié de logiciel-dispositif médical (MDSW).";

/**
 * Disclosure AI Act (art. 50(1)) — source unique.
 *
 * Le projet peut servir DEUX providers (Anthropic et OpenAI, cf 01_REGULATION §6 et
 * src/ai/providers). La disclosure doit refléter le système réellement servi : on ne fige
 * donc pas un fournisseur. `getAiDisclosure(system)` injecte le libellé du modèle actif
 * quand il est connu (contexte serveur) ; sans argument, elle nomme les deux providers
 * possibles (contexte UI statique : onboarding, sign-in).
 */
export const DEFAULT_AI_SYSTEM_LABEL = "Claude (Anthropic) ou GPT (OpenAI) selon le modèle servi";

export function getAiDisclosure(system: string = DEFAULT_AI_SYSTEM_LABEL): string {
  return `Vous interagissez avec un système d'intelligence artificielle (${system}). Les réponses sont générées automatiquement et peuvent contenir des erreurs.`;
}

export const CANONICAL_REFUSAL =
  "MedInfo AI fournit de l'information médicale générale et ne peut pas analyser une situation personnelle ni orienter un diagnostic individuel. Si vous ressentez des symptômes ou une inquiétude qui vous concerne, vous ou un proche, consultez un professionnel de santé. En cas d'urgence, composez le 15 (SAMU) ou le 112. En cas de détresse psychologique ou d'idées suicidaires, composez le 3114. Pour un besoin de soins non programmés, le 116 117 peut orienter selon votre territoire ; pour une pharmacie de garde, le 3237 peut être utile selon disponibilité locale.";
