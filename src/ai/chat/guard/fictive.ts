/**
 * Exception étudiante étroite (reprise de l'ancien orchestrateur, ea616fc) :
 * seuls les cas explicitement fictifs et pédagogiques peuvent atteindre le LLM
 * malgré des marqueurs cliniques (y compris d'urgence : une vignette ECOS
 * « douleur thoracique » est le pain quotidien de l'entraînement EDN — c'est
 * pourquoi cette exception est évaluée AVANT le verrou urgence, ADR-0029).
 * La moindre trace de patient réel/personnel garde le refus.
 */
import { BYPASS_MARKERS, PERSONAL_MARKERS } from './lexicon';
import { normalizeApostrophes } from './regexClassifier';

const FICTIVE_EDUCATIONAL_CASE_MARKERS: RegExp[] = [
  /cas\s+clinique\s+(fictif|p[ée]dagogique)/i,
  /cas\s+(fictif|p[ée]dagogique)\s+(edn|r2c|ecos|de\s+formation)/i,
  /(vignette|sc[ée]nario)\s+(fictive?|p[ée]dagogique|edn|r2c|ecos)/i,
  /patient\s+standardis[ée]/i,
  /entra[îi]nement\s+(edn|r2c|ecos)/i,
];

const REAL_PATIENT_CASE_MARKERS: RegExp[] = [
  /\b(patient|patiente)\s+r[ée]el(le)?\b/i,
  /\bvrai(e)?\s+(patient|patiente|cas)\b/i,
  /\b(mon|ma|notre)\s+(patient|patiente)\b/i,
  /\bcas\s+(r[ée]el|anonymis[ée]|vu\s+en\s+stage|du\s+service|du\s+cabinet)\b/i,
  /\b(en\s+stage|aux\s+urgences|dans\s+le\s+service|au\s+cabinet)\b/i,
  /\binspir[ée]e?\s+d['e]un\s+(vrai\s+)?(patient|proche|cas)\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function isExplicitFictiveEducationalCase(rawText: string): boolean {
  const text = normalizeApostrophes(rawText);
  if (!matchesAny(text, FICTIVE_EDUCATIONAL_CASE_MARKERS)) return false;
  if (matchesAny(text, REAL_PATIENT_CASE_MARKERS)) return false;
  if (matchesAny(text, PERSONAL_MARKERS)) return false;
  // BYPASS_MARKERS contient volontairement « cas théorique : » ; un cas explicitement
  // fictif/pédagogique reste autorisé, mais les autres contournements demeurent bloquants.
  const blockingBypass = BYPASS_MARKERS.filter(
    (pattern) => !pattern.source.includes('cas\\s+(purement\\s+)?(th'),
  );
  if (matchesAny(text, blockingBypass)) return false;
  return true;
}
