/**
 * CRUD client des passages ECOS (table `ecos_attempts`, migration 0035, ADR-0032).
 *
 * Écran natif (pas d'iframe) → client Supabase navigateur (clé anon) : la RLS
 * own-row est la barrière réelle — l'utilisateur ne lit/écrit QUE ses passages.
 * Même pattern que `src/revision/db/queries.ts`. Aucun appel LLM ici.
 *
 * Un passage est IMMUABLE (insert/select/delete seulement, pas d'update) :
 * on n'archive que l'évaluation pédagogique et la note extraite — jamais la
 * transcription de la simulation.
 */
import { getSupabaseClient } from '@/db/supabase';

const LIST_LIMIT = 200;

export interface EcosAttemptRow {
  id: string;
  case_slug: string;
  case_title: string;
  specialty: string;
  score: number | null;
  evaluation: string;
  created_at: string;
}

const COLUMNS = 'id, case_slug, case_title, specialty, score, evaluation, created_at';

/** Normalise une ligne PostgREST (le numeric `score` peut arriver en string). */
function mapAttempt(row: Record<string, unknown>): EcosAttemptRow {
  const rawScore = row.score;
  const score = rawScore === null || rawScore === undefined ? null : Number(rawScore);
  return {
    id: String(row.id),
    case_slug: String(row.case_slug ?? ''),
    case_title: String(row.case_title ?? ''),
    specialty: String(row.specialty ?? ''),
    score: score !== null && Number.isFinite(score) ? score : null,
    evaluation: String(row.evaluation ?? ''),
    created_at: String(row.created_at ?? ''),
  };
}

/** Passages du user courant, du plus récent au plus ancien. */
export async function listAttempts(): Promise<EcosAttemptRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('ecos_attempts')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapAttempt(row as Record<string, unknown>));
}

export interface SaveAttemptInput {
  userId: string;
  caseSlug: string;
  caseTitle: string;
  specialty: string;
  score: number | null;
  evaluation: string;
}

export async function saveAttempt(input: SaveAttemptInput): Promise<EcosAttemptRow> {
  const { data, error } = await getSupabaseClient()
    .from('ecos_attempts')
    .insert({
      user_id: input.userId,
      case_slug: input.caseSlug.slice(0, 200),
      case_title: input.caseTitle.slice(0, 300),
      specialty: input.specialty.slice(0, 120),
      score: input.score,
      evaluation: input.evaluation.slice(0, 40_000),
    })
    .select(COLUMNS)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? 'Enregistrement impossible.');
  return mapAttempt(data as Record<string, unknown>);
}

export async function deleteAttempt(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('ecos_attempts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
