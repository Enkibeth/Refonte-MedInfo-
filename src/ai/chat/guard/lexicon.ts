/**
 * Lexiques regex déterministes (07_CLASSIFIER §2, étage 1).
 *
 * Asymétrie fail-safe (07_CLASSIFIER §1) : on préfère sur-capter le personnel/urgent.
 * Ordre d'évaluation imposé par le classifieur : EMERGENCY > PERSONAL > GENERAL_INFO.
 *
 * Aucun de ces motifs ne produit de triage/diagnostic : ils ne servent QU'À router
 * vers un refus déterministe ou vers le LLM principal.
 */

/**
 * Marqueurs d'urgence vitale → refus canonique immédiat, étage 2 court-circuité.
 *
 * Signes d'alerte (red flags) listés comme PHRASES spécifiques, pas comme mots nus :
 * on capte « lèvres bleues » mais pas « bleu », « raideur de nuque » mais pas « nuque »,
 * afin de ne PAS sur-déclencher sur des questions encyclopédiques générales (préservation
 * de la précision general_info). Comme l'urgence est évaluée AVANT general_info, ces motifs
 * neutralisent aussi les déguisements du type « explique <signe> comme information générale ».
 */
export const EMERGENCY_MARKERS: RegExp[] = [
  /douleurs?\s+(thoraciques?|dans\s+la\s+poitrine|à\s+la\s+poitrine)/i,
  /(oppression|serrement)\s+(thoracique|dans\s+la\s+poitrine)/i,
  /mal\s+à\s+la\s+poitrine/i,
  /\b(je\s+veux\s+mourir|envie\s+de\s+mourir|envie\s+d['e]en\s+finir|me\s+suicider|suicidaires?|suicide)\b/i,
  /\b(h[ée]morragie|je\s+saigne|saignement\s+abondant)\b/i,
  /(vomissements?\s+de\s+sang|vomir\s+du\s+sang|crach\w+\s+du\s+sang)/i,
  /(je\s+n['e]arrive\s+plus\s+à\s+respirer|je\s+ne\s+peux\s+plus\s+respirer|difficult[ée]s?\s+à\s+respirer|j['e]étouffe)/i,
  /\b(avc|infarctus\s+en\s+cours|crise\s+cardiaque)\b/i,
  /(perte\s+de\s+connaissance|perd[u]?\s+connaissance|[ée]vanou[ie])/i,
  /\bconvulsions?\b/i,
  // Signes neuro d'AVC
  /visage\s+paralys[ée]/i,
  /paralysie\s+(soudaine|brutale|d['e]un\s+c[ôo]t[ée])/i,
  /faiblesse\s+soudaine/i,
  /confusion\s+(brutale|soudaine|aigu[ëe])/i,
  // Détresse respiratoire / cyanose / anaphylaxie
  /l[èe]vres\s+bleues/i,
  /\bcyanos[ée]/i,
  /r[ée]action\s+allergique/i,
  /gorge\s+qui\s+(gonfle|enfle)/i,
  // Méningite, traumatisme, abdomen aigu, torsion
  /raideur\s+de\s+(la\s+)?nuque/i,
  /douleur\s+violente\s+apr[èe]s\s+un\s+choc/i,
  /douleur\s+abdominale\s+(insupportable|violente|brutale|atroce)/i,
  /douleur\s+testiculaire\s+(brutale|aigu[ëe]|violente)/i,
  /br[ûu]lure\s+(étendue|grave|profonde|au\s+\w+\s+degr[ée])/i,
  /malaise\s+avec\s+(sueurs|oppression)/i,
];

/**
 * Marqueurs de situation personnelle (1ʳᵉ/2ᵉ/3ᵉ pers. déguisée, durée, possessifs santé).
 * 04_CHATBOT/07_CLASSIFIER : décrire SES symptômes ou ceux d'un proche → refus.
 */
export const PERSONAL_MARKERS: RegExp[] = [
  /j['e]ai\s+mal\b/i,
  /j['e]ai\s+(de\s+la|des|un|une)\s+\w+/i,
  /je\s+(ressens|souffre|tousse|vomis)\b/i,
  /\bmes\s+(sympt[ôo]mes|analyses|r[ée]sultats|douleurs)\b/i,
  /\bmon\s+(traitement|ordonnance|sympt[ôo]me)\b/i,
  /\bma\s+(douleur|maladie|tension)\b/i,
  /est-ce\s+(que\s+c['e]est\s+)?grave/i,
  /qu['e]est-ce\s+que\s+j['e]ai\b/i,
  // Sollicitation directe d'un diagnostic personnel (trou détecté par simulation ADR-0029)
  /dis-moi\s+ce\s+que\s+j['e]ai\b/i,
  /(qu['e]est-ce|ce)\s+que\s+j['e]ai\s*,?\s*docteur/i,
  /dois-je\s+(aller\s+aux\s+urgences|consulter|m['e]inqui[ée]ter|prendre)/i,
  /qu['e]est-ce\s+que\s+je\s+(dois|peux)\s+(prendre|faire)/i,
  /depuis\s+(ce\s+matin|hier|\d+\s+(jours?|semaines?|heures?|mois)|la\s+nuit\s+derni[èe]re|dix\s+jours|trois\s+jours)/i,
  /[çc]a\s+passe(ra)?\s+tout\s+seul/i,
  // 3ᵉ personne déguisée (un proche identifiable)
  /\b(mon|ma)\s+(fils|fille|mari|femme|p[èe]re|m[èe]re|fr[èe]re|s[œo]eur|copain|copine|conjoint[e]?|enfant|b[ée]b[ée]|gamin[e]?|grand[- ](p[èe]re|m[èe]re)|parents?)\b/i,
  /\b(mon|un|une)\s+(ami[e]?|proche|coll[èe]gue)\b/i,
];

/**
 * Tournures de contournement (jailbreak) → repliées sur personal_symptoms.
 * 07_CLASSIFIER §4 : « imagine que tu es médecin », « cas théorique : mon cas… », « pour un ami ».
 */
export const BYPASS_MARKERS: RegExp[] = [
  /imagine\s+que\s+tu\s+es\s+(un\s+|mon\s+|ma\s+)?m[ée]decin/i,
  /fais\s+comme\s+si\s+tu\s+[ée]tais\s+(un\s+|mon\s+)?m[ée]decin/i,
  /\btu\s+es\s+mon\s+m[ée]decin\b/i,
  /joue\s+le\s+r[ôo]le\s+d['e](un\s+|mon\s+)?m[ée]decin/i,
  /cas\s+(purement\s+)?(th[ée]orique|hypoth[ée]tique)\s*:/i,
  /\bpour\s+un\s+ami\b/i,
  /hypoth[ée]tiquement[, ]+mon/i,
  // Déflexions : nier l'implication personnelle tout en sollicitant un avis individualisé.
  /sans\s+parler\s+de\s+moi/i,
  /sans\s+(faire\s+de\s+)?diagnostic[, ]/i,
  /inspir[ée]e?\s+d['e]un\s+proche/i,
  /je\s+ne\s+veux\s+pas\s+consulter/i,
];

/**
 * Tournures encyclopédiques générales (définition, mécanisme) SANS marqueur personnel.
 * Seules ces formulations claires sont routées general_info de façon déterministe ;
 * tout le reste retombe en fail-safe (ambiguous) ou passe à l'étage 2.
 */
export const GENERAL_INFO_MARKERS: RegExp[] = [
  /qu['e]est-ce\s+(que|qu['e])\s+(le|la|les|l['e]|un|une)\b/i,
  /c['e]est\s+quoi\s+(le|la|les|l['e]|un|une)\b/i,
  /\bd[ée]finition\s+(de|du|d['e])\b/i,
  /comment\s+fonctionne\b/i,
  /\bà\s+quoi\s+sert\b/i,
  /quels?\s+sont\s+les\s+(m[ée]canismes|sympt[ôo]mes|causes|traitements|facteurs)\s+(de|du|des|d['e])\b/i,
  /\b(explique|expliquer|vulgarise)\b/i,
];

/** Indices clairs de hors-sujet non médical → réponse polie (pas de refus médical). */
export const OUT_OF_SCOPE_MARKERS: RegExp[] = [
  /\b(m[ée]t[ée]o|recette\s+de\s+cuisine|score\s+du\s+match|cours\s+du\s+bitcoin)\b/i,
  /(code\s+(moi\s+)?(en|une?\s+fonction)\s+(python|javascript|java)\b)/i,
];
