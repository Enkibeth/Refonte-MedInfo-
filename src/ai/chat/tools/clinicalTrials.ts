/**
 * Outil `clinical_trials_search` — essais cliniques enregistrés, via l'API REST v2
 * publique de ClinicalTrials.gov (sans clé d'API). Réservé au chatbot professionnel :
 * « quels essais en cours pour X ? » est une vraie demande de cliniciens.
 *
 * Renvoie NCT, titre, statut, phase, conditions, promoteur et URL officielle — le
 * modèle n'invente jamais un numéro NCT ni un statut de recrutement.
 *
 * Construction d'URL et formatage purs et testés ; seul `execute` touche le réseau.
 */
import { tool } from 'ai';
import { z } from 'zod';

import type { ResearchEvent } from '@/ai/chat/researchTimeline';

const CTGOV_ENDPOINT = 'https://clinicaltrials.gov/api/v2/studies';
const FETCH_TIMEOUT_MS = 8_000;

export function buildClinicalTrialsSearchUrl(
  query: string,
  opts: { limit?: number; recruitingOnly?: boolean } = {},
): string {
  const pageSize = Math.min(Math.max(Math.floor(opts.limit ?? 5), 1), 8);
  const params = new URLSearchParams({
    'query.term': query.trim().slice(0, 300),
    pageSize: String(pageSize),
    sort: '@relevance',
    // Timeline de progression : totalCount = nombre TOTAL d'essais correspondants
    // (« ≈ N essais »), distinct des quelques résultats affichés au modèle.
    countTotal: 'true',
  });
  if (opts.recruitingOnly) params.set('filter.overallStatus', 'RECRUITING');
  return `${CTGOV_ENDPOINT}?${params.toString()}`;
}

interface CtGovStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { overallStatus?: string; startDateStruct?: { date?: string } };
    designModule?: { phases?: string[] };
    conditionsModule?: { conditions?: string[] };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
  };
}

/** Nombre TOTAL d'essais correspondant à la requête (champ totalCount de l'API v2). */
export function clinicalTrialsTotalCount(json: unknown): number | null {
  const n = (json as { totalCount?: unknown } | null)?.totalCount;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Formate la réponse JSON de ClinicalTrials.gov v2 en liste compacte pour le modèle. */
export function formatClinicalTrialsResults(json: unknown): string {
  const studies = (json as { studies?: CtGovStudy[] } | null)?.studies;
  if (!Array.isArray(studies) || studies.length === 0) {
    return 'Aucun essai trouvé pour cette requête. Reformule (termes anglais : pathologie, molécule) ou élargis la recherche.';
  }
  const lines = studies.map((s, i) => {
    const p = s.protocolSection ?? {};
    const nct = p.identificationModule?.nctId;
    const meta = [
      p.statusModule?.overallStatus ? `Statut : ${p.statusModule.overallStatus}` : null,
      p.designModule?.phases?.length ? `Phase : ${p.designModule.phases.join('/')}` : null,
      p.conditionsModule?.conditions?.length
        ? `Conditions : ${p.conditionsModule.conditions.slice(0, 4).join(', ')}`
        : null,
      p.sponsorCollaboratorsModule?.leadSponsor?.name
        ? `Promoteur : ${p.sponsorCollaboratorsModule.leadSponsor.name}`
        : null,
      p.statusModule?.startDateStruct?.date ? `Début : ${p.statusModule.startDateStruct.date}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return [
      `${i + 1}. ${nct ? `[${nct}] ` : ''}${p.identificationModule?.briefTitle ?? 'Sans titre'}`,
      meta || null,
      nct ? `URL : https://clinicaltrials.gov/study/${nct}` : null,
    ]
      .filter(Boolean)
      .join('\n   ');
  });
  return lines.join('\n');
}

export function clinicalTrialsSearchTool(
  fetchImpl: typeof fetch = fetch,
  onEvent?: (e: ResearchEvent) => void,
) {
  return tool({
    description:
      'Recherche les essais cliniques enregistrés sur ClinicalTrials.gov (registre officiel). ' +
      'Renvoie numéro NCT, titre, statut de recrutement, phase, conditions, promoteur et URL officielle. ' +
      "À utiliser quand la question porte sur les essais en cours, une thérapie émergente ou une molécule en développement — n'invente jamais un NCT ni un statut. " +
      'Requête en anglais (pathologie, molécule, intervention).',
    inputSchema: z.object({
      query: z.string().min(2).describe('Requête (anglais : pathologie, molécule, intervention)'),
      limit: z.number().int().min(1).max(8).optional().describe('Nombre de résultats (défaut 5)'),
      recruitingOnly: z
        .boolean()
        .optional()
        .describe('true pour ne renvoyer que les essais en cours de recrutement'),
    }),
    execute: async ({
      query,
      limit,
      recruitingOnly,
    }: {
      query: string;
      limit?: number;
      recruitingOnly?: boolean;
    }) => {
      try {
        const res = await fetchImpl(buildClinicalTrialsSearchUrl(query, { limit, recruitingOnly }), {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { accept: 'application/json' },
        });
        if (!res.ok) {
          onEvent?.({ kind: 'trials', query, found: null });
          return `Recherche ClinicalTrials.gov indisponible (HTTP ${res.status}). Appuie-toi sur la recherche web et signale l'incertitude.`;
        }
        const json = await res.json();
        onEvent?.({ kind: 'trials', query, found: clinicalTrialsTotalCount(json) });
        return formatClinicalTrialsResults(json);
      } catch {
        onEvent?.({ kind: 'trials', query, found: null });
        return "Recherche ClinicalTrials.gov indisponible (réseau). Appuie-toi sur la recherche web et signale l'incertitude.";
      }
    },
  });
}
