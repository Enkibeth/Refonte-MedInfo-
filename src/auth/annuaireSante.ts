/**
 * Vérification RPPS via l'API FHIR R4 de l'Annuaire Santé (ANS) — ADR-0007, ADR-0011, 06_BILLING §10.2.
 *
 * Appel direct REST via `fetch` (pas de SDK) → testable hors réseau en injectant `fetchImpl`.
 * AUCUNE donnée de santé : on n'interroge que l'existence d'un Practitioner par son RPPS.
 *
 * Endpoint (doc 06_BILLING §10.2) :
 *   GET {base}/Practitioner?identifier=http://rpps.fr|{RPPS_11_chiffres}
 *   Header: ESANTE-API-KEY / GRAVITEE-API-KEY: <clé>
 * Bundle vide (total=0 / aucun entry) = RPPS non inscrit ou radié → non vérifié.
 */
const ANNUAIRE_FHIR_BASE =
  process.env.ANNUAIRE_SANTE_FHIR_URL ?? 'https://gateway.api.esante.gouv.fr/fhir/v2';

export interface RppsLookupResult {
  /** true si l'Annuaire Santé renvoie au moins un Practitioner pour ce RPPS. */
  found: boolean;
}

export interface RppsLookupDeps {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

interface FhirBundle {
  total?: number;
  entry?: unknown[];
}

export async function lookupRpps(rpps: string, deps: RppsLookupDeps): Promise<RppsLookupResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const identifier = `http://rpps.fr|${rpps.trim()}`;
  const url = `${ANNUAIRE_FHIR_BASE}/Practitioner?identifier=${encodeURIComponent(identifier)}`;

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/fhir+json',
      // L'ANS a renommé l'en-tête (GRAVITEE → ESANTE) selon les passerelles : on envoie les deux.
      'ESANTE-API-KEY': deps.apiKey,
      'GRAVITEE-API-KEY': deps.apiKey,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Annuaire Santé a répondu ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const bundle = (await response.json()) as FhirBundle;
  const total = typeof bundle.total === 'number' ? bundle.total : undefined;
  const entryCount = Array.isArray(bundle.entry) ? bundle.entry.length : 0;
  return { found: (total ?? entryCount) > 0 };
}
