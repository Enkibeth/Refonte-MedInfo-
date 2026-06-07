/**
 * Vérification RPPS réelle via l'API FHIR Annuaire Santé (ANS) — ADR-0011.
 *
 * Vérifier l'identité d'un professionnel de santé n'est PAS du MDSW (aucune donnée de santé
 * manipulée ici : seul le numéro RPPS public et le statut d'inscription `active` sont lus).
 *
 * Source de vérité : Répertoire Partagé des Professionnels de Santé (RPPS), exposé en lecture
 * publique par l'ANS (HL7 FHIR R4). On interroge la ressource `Practitioner` par identifiant :
 *   GET {base}/Practitioner?identifier={RPPS}
 * et on confirme la présence (`Bundle.total >= 1`) ET le droit d'exercice (`active !== false` :
 * un praticien radié/suspendu reste dans l'annuaire avec `active = false`).
 *
 * Recherche par VALEUR seule (sans `system`) par défaut : c'est robuste quelle que soit la
 * version de l'API. Vérifié sur la gateway ANS : le RPPS 11 chiffres est exposé sous des
 * `system` DIFFÉRENTS selon la version (`http://rpps.fr` en v1, `https://rpps.esante.gouv.fr`
 * en v2) — une recherche `system|value` ne matche donc qu'une version. La recherche par valeur
 * matche les deux. Un `system` explicite reste possible via `ANNUAIRE_SANTE_RPPS_SYSTEM`.
 *
 * Configuration (la clé + les défauts proviennent de l'inscription au portail ANS
 * `portail.openfhir.annuaire.sante.fr`) :
 *   - ANNUAIRE_SANTE_API_KEY        (obligatoire) — clé d'abonnement « Annuaire Santé FHIR ».
 *   - ANNUAIRE_SANTE_API_URL        (optionnel)   — base FHIR ; défaut gateway ANS v2.
 *   - ANNUAIRE_SANTE_API_KEY_HEADER (optionnel)   — nom de l'en-tête ; défaut ESANTE-API-KEY.
 *   - ANNUAIRE_SANTE_RPPS_SYSTEM    (optionnel)   — system FHIR de l'identifiant (sinon valeur seule).
 *
 * SÉCURITÉ — fail-closed : toute erreur réseau / réponse inattendue → `unavailable` (aucun
 * accès accordé, statut « en attente »). Jamais d'auto-validation pro sans confirmation ANS.
 */

const DEFAULT_BASE_URL = 'https://gateway.api.esante.gouv.fr/fhir/v2';
const DEFAULT_KEY_HEADER = 'ESANTE-API-KEY';
const REQUEST_TIMEOUT_MS = 8000;

export interface AnnuaireSanteConfig {
  apiKey: string;
  /** Base de l'API FHIR (sans slash final). Défaut : gateway ANS v2. */
  baseUrl?: string;
  /** Nom de l'en-tête portant la clé. Défaut : ESANTE-API-KEY. */
  keyHeader?: string;
  /** System FHIR de l'identifiant RPPS. Si absent : recherche par valeur seule (robuste). */
  rppsSystem?: string;
  /** Injection de fetch (tests). Défaut : fetch global. */
  fetchImpl?: typeof fetch;
}

export type RppsVerification =
  /** RPPS trouvé dans l'annuaire et droit d'exercice actif. */
  | { status: 'verified' }
  /** RPPS introuvable ou praticien inactif (radié/suspendu). Refus déterministe. */
  | { status: 'rejected'; reason: string }
  /** API injoignable / réponse illisible → fail-closed (mettre « en attente », ne rien écrire). */
  | { status: 'unavailable'; reason: string };

/** Construit la config depuis l'environnement serveur (ou null si la clé manque). */
export function annuaireConfigFromEnv(): AnnuaireSanteConfig | null {
  const apiKey = process.env.ANNUAIRE_SANTE_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.ANNUAIRE_SANTE_API_URL,
    keyHeader: process.env.ANNUAIRE_SANTE_API_KEY_HEADER,
    rppsSystem: process.env.ANNUAIRE_SANTE_RPPS_SYSTEM,
  };
}

/**
 * Interroge l'Annuaire Santé pour confirmer un RPPS (format déjà validé en amont).
 * Ne lève jamais : toute erreur est convertie en `unavailable` (fail-closed).
 */
export async function verifyRpps(
  rpps: string,
  config: AnnuaireSanteConfig,
): Promise<RppsVerification> {
  const base = (config.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const header = config.keyHeader?.trim() || DEFAULT_KEY_HEADER;
  const doFetch = config.fetchImpl ?? fetch;

  // Par défaut : recherche par valeur seule (robuste cross-version). Avec `rppsSystem`
  // explicite : recherche FHIR `system|value`.
  const value = rpps.trim();
  const system = config.rppsSystem?.trim();
  const identifierParam = system ? `${system}|${value}` : value;
  const url = `${base}/Practitioner?identifier=${encodeURIComponent(identifierParam)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await doFetch(url, {
      method: 'GET',
      headers: { [header]: config.apiKey, Accept: 'application/fhir+json' },
      signal: controller.signal,
    });
  } catch (e) {
    return { status: 'unavailable', reason: e instanceof Error ? e.message : 'réseau' };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return { status: 'unavailable', reason: `HTTP ${response.status}` };
  }

  let bundle: unknown;
  try {
    bundle = await response.json();
  } catch {
    return { status: 'unavailable', reason: 'réponse FHIR illisible' };
  }

  return interpretBundle(bundle);
}

/** Lecture défensive du Bundle FHIR : présence + droit d'exercice actif. */
export function interpretBundle(bundle: unknown): RppsVerification {
  if (!bundle || typeof bundle !== 'object') {
    return { status: 'unavailable', reason: 'réponse FHIR vide' };
  }
  const b = bundle as { resourceType?: unknown; total?: unknown; entry?: unknown };
  if (b.resourceType !== 'Bundle') {
    return { status: 'unavailable', reason: 'ressource FHIR inattendue' };
  }

  const entries = Array.isArray(b.entry) ? b.entry : [];
  const total = typeof b.total === 'number' ? b.total : entries.length;
  if (total < 1 || entries.length === 0) {
    return { status: 'rejected', reason: 'RPPS introuvable dans l’Annuaire Santé' };
  }

  // Un praticien radié/suspendu reste dans l'annuaire avec active=false → refus.
  const practitioner = (entries[0] as { resource?: { active?: unknown } })?.resource;
  if (practitioner?.active === false) {
    return { status: 'rejected', reason: 'praticien inactif (radié ou suspendu)' };
  }

  return { status: 'verified' };
}
