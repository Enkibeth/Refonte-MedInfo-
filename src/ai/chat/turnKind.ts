/**
 * Nature du tour de conversation — assemblage conditionnel du prompt (audit 2026-07, item I).
 *
 * Objectif : ne pas payer le WORKFLOW outils + la section pharmaco + les consignes de mode
 * de réponse (ni déclencher une recherche web) pour un tour PUREMENT conversationnel
 * (« bonjour », « merci », « ok »). On charge ces sections À LA DEMANDE, seulement quand le
 * tour est substantiel.
 *
 * ⚠️ SÉCURITÉ — asymétrie volontaire : on ne touche JAMAIS au cœur clinique des prompts
 * produit (rôle, sécurité, recueil minimum, signes sentinelles, formats de sortie) — ils
 * sont toujours envoyés. On ne fait PAS de routage des blocs cliniques (symptôme/résultat/
 * traitement) : ce serait réintroduire le classifieur pré-LLM retiré par l'ADR-0024, avec un
 * risque de sous-triage. Le détecteur est CONSERVATEUR : au moindre signal de substance
 * (question, chiffre, terme médical, longueur), il renvoie `false` → prompt complet + outils.
 *
 * Module PUR (server-safe, aucune donnée de santé stockée, aucun réseau) : testé dans
 * tests/unit/chat-turn-kind.test.ts.
 */

/** Retire les accents et met en minuscules (comparaison robuste FR). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Formules purement conversationnelles (salutation, remerciement, acquiescement, politesse
 * de clôture). Comparaison sur le message ENTIER débarrassé de sa ponctuation.
 */
const CONVERSATIONAL_PHRASES = new Set([
  'bonjour', 'bonsoir', 'salut', 'coucou', 'hello', 'hi', 'hey', 'yo',
  'merci', 'merci beaucoup', 'merci bien', 'mille mercis', 'grand merci',
  'ok', 'okay', 'daccord', 'd accord', 'tres bien', 'parfait', 'super', 'genial', 'nickel', 'top', 'cool',
  'au revoir', 'bonne journee', 'bonne soiree', 'a bientot', 'bye', 'ciao',
  'ca va', 'comment ca va', 'comment vas tu', 'comment allez vous',
  'oui', 'non', 'yes', 'no',
  'bonjour a vous', 'bonjour docteur', 'bonjour bonjour',
]);

/** Combinaisons courtes salutation + politesse fréquentes (ex. « bonjour merci »). */
const CONVERSATIONAL_WORDS = new Set([
  'bonjour', 'bonsoir', 'salut', 'coucou', 'hello', 'hi', 'hey',
  'merci', 'ok', 'okay', 'parfait', 'super', 'genial', 'cool', 'top',
  'oui', 'non', 'bien', 'tres', 'et', 'a', 'vous', 'toi', 'stp', 'svp',
  'bonne', 'journee', 'soiree', 'bye', 'ciao', 'au', 'revoir', 'docteur',
]);

/**
 * Le tour est-il PUREMENT conversationnel (aucun contenu médical / aucune demande) ?
 * Conservateur : ne renvoie `true` que pour des messages courts sans signal de substance.
 */
export function isConversationalTurn(text: string): boolean {
  if (typeof text !== 'string') return false;
  const raw = text.trim();
  if (!raw) return false;

  // Signal de substance : une question ou un chiffre (dose, âge, résultat de bilan…).
  if (/[?]/.test(raw) || /\d/.test(raw)) return false;

  const norm = normalize(raw)
    .replace(/[!.,;:…«»"'’()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return false;

  // Correspondance exacte d'une formule conversationnelle.
  if (CONVERSATIONAL_PHRASES.has(norm)) return true;

  const words = norm.split(' ').filter(Boolean);
  // Au-delà de 4 mots, on considère qu'il y a probablement une demande → prompt complet.
  if (words.length > 4) return false;
  // Tous les mots appartiennent au vocabulaire conversationnel → salutation composée.
  return words.every((w) => CONVERSATIONAL_WORDS.has(w));
}

interface UiMessageLike {
  role?: unknown;
  content?: unknown;
  parts?: unknown;
}

/** Extrait le texte du DERNIER message utilisateur d'une liste de messages UI (défensif). */
export function latestUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as UiMessageLike | null;
    if (!m || m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.parts)) {
      return m.parts
        .map((p) => {
          const part = p as { type?: unknown; text?: unknown } | null;
          const isText = part?.type === 'text' || typeof part?.text === 'string';
          return isText && typeof part?.text === 'string' ? part.text : '';
        })
        .join('');
    }
    return '';
  }
  return '';
}
