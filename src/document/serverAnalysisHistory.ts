/**
 * Archivage serveur du résultat d'une analyse de document (complément du CRUD client
 * src/document/analysisHistory.ts).
 *
 * Appelé par `/api/analyze` en fin de génération (onFinish) : si l'utilisateur quitte
 * la page pendant le streaming, le résultat est quand même archivé et récupérable
 * depuis l'historique. ⚠️ Seul le RÉSULTAT est écrit — jamais le document fourni.
 *
 * Le client service_role contourne la RLS : `userId` provient TOUJOURS du token
 * vérifié (resolveVerifiedUserId), jamais du body.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnalysisMode } from './analysisHistory';

export async function saveAnalysisServer(
  supabase: SupabaseClient,
  {
    userId,
    mode,
    sourceName,
    targetLanguage,
    result,
  }: {
    userId: string;
    mode: AnalysisMode;
    sourceName: string | null;
    targetLanguage: string | null;
    result: string;
  },
): Promise<void> {
  if (!result.trim()) return;
  try {
    await supabase.from('document_analyses').insert({
      user_id: userId,
      mode,
      source_name: sourceName,
      target_language: mode === 'translation' ? targetLanguage : null,
      result,
    });
  } catch {
    // Archivage best-effort : ne doit jamais casser la réponse.
  }
}
