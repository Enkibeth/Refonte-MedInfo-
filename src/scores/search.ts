/**
 * Recherche de scores — PAR NOM et PAR FONCTION / INDICATION.
 *
 * Objectif produit (demande Hugo) : retrouver un score même quand on a oublié son
 * nom, en tapant ce qu'il sert à évaluer (« risque hémorragie anticoagulant » →
 * HAS-BLED ; « probabilité embolie pulmonaire » → Wells/Genève ; « clairance
 * rénale » → Cockcroft/CKD-EPI). Chaque score porte donc, en plus de son nom et
 * de ses alias, une liste de mots-clés « fonction ».
 *
 * ⚠️ Module PUR et testable (`tests/unit/scores.test.ts`) : insensible à la casse
 * et aux accents, gère les indices (CHA₂DS₂-VASc → « cha2ds2 vasc ») et le
 * rapprochement sur forme compacte (sans espaces).
 */
import { ALL_SCORES, categoryLabel } from './catalog';
import type { ScoreCategory, ScoreDefinition } from './types';

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

/** Minuscule, sans accents, indices → chiffres, tout non alphanumérique → espace. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[₀-₉]/g, (d) => String(SUBSCRIPTS.indexOf(d)))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface IndexedScore {
  def: ScoreDefinition;
  /** Nom + sigle normalisés (recherche par nom, poids fort). */
  name: string;
  /** Alias normalisés. */
  aliases: string;
  /** Tout (nom, sigle, alias, but, mots-clés, catégorie) normalisé, séparé par espaces. */
  haystack: string;
  /** haystack sans espaces (rapprochement type « chadsvasc »). */
  compact: string;
}

function buildIndex(): IndexedScore[] {
  return ALL_SCORES.map((def) => {
    const parts = [
      def.name,
      def.acronym ?? '',
      ...(def.aliases ?? []),
      def.purpose,
      ...def.keywords,
      categoryLabel(def.category),
    ];
    const haystack = normalize(parts.join(' '));
    return {
      def,
      name: normalize(`${def.name} ${def.acronym ?? ''}`),
      aliases: normalize((def.aliases ?? []).join(' ')),
      haystack,
      compact: haystack.replace(/ /g, ''),
    };
  });
}

const INDEX = buildIndex();

/** Force de correspondance d'un token ; 0 = non trouvé (exclusion AND). */
function tokenStrength(item: IndexedScore, tok: string): number {
  if (new RegExp(`(^| )${tok}`).test(item.name)) return 10; // préfixe de mot dans le nom/sigle
  if (item.name.includes(tok)) return 7;
  if (item.aliases.includes(tok)) return 6;
  if (new RegExp(`(^| )${tok}`).test(item.haystack)) return 4; // préfixe de mot (mots-clés/but)
  if (item.haystack.includes(tok)) return 2;
  if (item.compact.includes(tok)) return 1; // forme compacte (ex. « chadsvasc »)
  return 0;
}

export interface SearchOptions {
  /** Restreint à une catégorie (chips de navigation). */
  category?: ScoreCategory;
}

/**
 * Recherche les scores correspondant à `query`. Requête vide → tous les scores
 * (de la catégorie), dans l'ordre du catalogue. Sinon : TOUS les tokens doivent
 * correspondre (ET), classement par pertinence puis nom.
 */
export function searchScores(query: string, opts: SearchOptions = {}): ScoreDefinition[] {
  const inCat = (d: ScoreDefinition) => !opts.category || d.category === opts.category;
  const q = normalize(query);
  if (!q) return ALL_SCORES.filter(inCat);

  const tokens = q.split(' ').filter(Boolean);
  const scored: { def: ScoreDefinition; score: number }[] = [];
  for (const item of INDEX) {
    if (!inCat(item.def)) continue;
    let total = 0;
    let matchedAll = true;
    for (const tok of tokens) {
      const strength = tokenStrength(item, tok);
      if (strength === 0) {
        matchedAll = false;
        break;
      }
      total += strength;
    }
    if (matchedAll) scored.push({ def: item.def, score: total });
  }
  scored.sort((a, b) => b.score - a.score || a.def.name.localeCompare(b.def.name, 'fr'));
  return scored.map((x) => x.def);
}
