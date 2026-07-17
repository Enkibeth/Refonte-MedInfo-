/**
 * Contexte PAYS des chats (2026-07) — sélecteur en haut du chat.
 *
 * L'utilisateur déclare le pays où il exerce / se trouve ; cette information est
 * envoyée dans le body de la requête (comme `personalInfo`, JAMAIS de source de
 * vérité serveur, aucune migration) et injectée dans le system prompt pour que
 * l'IA PRIORISE les bonnes ressources officielles (agence du médicament, RCP,
 * recommandations) et adapte disponibilité / noms commerciaux / réglementation.
 *
 * ⚠️ Module PUR (server-safe), sans dépendance réseau ni React.
 */

export type CountryCode =
  | 'FR' | 'BE' | 'CH' | 'LU' | 'CA' | 'DE' | 'ES' | 'IT' | 'PT' | 'NL' | 'GB' | 'US' | 'OTHER';

export interface CountryOption {
  code: CountryCode;
  /** Libellé FR. */
  name: string;
  /** Emoji drapeau (UI seulement). */
  flag: string;
  /** Sources officielles à prioriser pour le médicament / les recommandations. */
  sources: string[];
}

/**
 * Liste volontairement centrée sur l'audience francophone + Europe + quelques
 * majeurs, avec une entrée « International » de repli. Sources = références
 * PUBLIQUES et officielles (agences du médicament, RCP, recommandations).
 */
export const COUNTRIES: CountryOption[] = [
  { code: 'FR', name: 'France', flag: '🇫🇷', sources: ['ANSM', 'base-donnees-publique.medicaments.gouv.fr (RCP)', 'HAS', 'Le CRAT (grossesse/allaitement)', 'thésaurus des interactions de l’ANSM'] },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪', sources: ['AFMPS/FAGG', 'CBIP/BCFI (répertoire commenté des médicaments)', 'KCE'] },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭', sources: ['Swissmedic', 'Compendium.ch', 'OFSP/BAG'] },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', sources: ['Ministère de la Santé', 'EMA'] },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', sources: ['Santé Canada (Base de données sur les produits pharmaceutiques)', 'INESSS (Québec)'] },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪', sources: ['BfArM', 'EMA', 'Fachinformation'] },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸', sources: ['AEMPS (CIMA)', 'EMA'] },
  { code: 'IT', name: 'Italie', flag: '🇮🇹', sources: ['AIFA', 'EMA'] },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', sources: ['INFARMED', 'EMA'] },
  { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱', sources: ['CBG-MEB', 'Farmacotherapeutisch Kompas', 'EMA'] },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧', sources: ['MHRA', 'BNF (NICE)', 'electronic Medicines Compendium (emc)'] },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸', sources: ['FDA (DailyMed)', 'openFDA'] },
  { code: 'OTHER', name: 'Autre / International', flag: '🌐', sources: ['EMA (Europe)', 'OMS/WHO', 'agence nationale du médicament du pays concerné'] },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: CountryCode): CountryOption | undefined {
  return BY_CODE.get(code);
}

/** Coerce une valeur reçue du client en code pays connu (sinon null). */
export function coerceCountry(value: unknown): CountryCode | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  return BY_CODE.has(upper as CountryCode) ? (upper as CountryCode) : null;
}

/**
 * Section « contexte pays » concaténée au system prompt. Vide si aucun pays.
 * Oriente le choix des SOURCES sans jamais remplacer les consignes de format.
 */
export function buildCountryContextSection(code: CountryCode | null): string {
  if (!code) return '';
  const country = BY_CODE.get(code);
  if (!country) return '';
  const isOther = country.code === 'OTHER';
  return (
    `\n\nCONTEXTE PAYS (déclaré par l'utilisateur) : ${country.name}\n` +
    `- Priorise, pour le médicament et les recommandations, les sources officielles ${isOther ? 'internationales' : 'de ce pays'} : ${country.sources.join(', ')}.\n` +
    `- Adapte-toi aux spécificités locales : disponibilité et noms commerciaux des médicaments, cadre réglementaire (AMM), pratiques et numéros d'urgence.\n` +
    `- Complète avec les sources européennes (EMA) et la littérature internationale (PubMed / Europe PMC) ; signale EXPLICITEMENT quand une information (AMM, nom commercial, posologie autorisée, remboursement) peut différer d'un pays à l'autre.\n` +
    `- Si l'utilisateur mentionne explicitement un autre pays dans sa question, ce contexte ne s'applique pas à ce cas précis.`
  );
}
