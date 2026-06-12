/**
 * Historique des analyses de documents (migration 0023).
 *
 * CRUD client via supabase-js : la RLS own-row garantit que l'utilisateur ne voit
 * que SES analyses. ⚠️ Le document fourni n'est jamais conservé — seul le résultat
 * généré par l'IA est archivé (côté serveur, /api/analyze onFinish).
 */
import { getSupabaseClient } from '@/db/supabase';

export type AnalysisMode = 'analysis' | 'translation';

export interface DocumentAnalysis {
  id: string;
  mode: AnalysisMode;
  source_name: string | null;
  target_language: string | null;
  result: string;
  created_at: string;
}

export async function listAnalyses(userId: string): Promise<DocumentAnalysis[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('document_analyses')
    .select('id, mode, source_name, target_language, result, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data as DocumentAnalysis[];
}

export async function deleteAnalysis(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('document_analyses').delete().eq('id', id);
}
