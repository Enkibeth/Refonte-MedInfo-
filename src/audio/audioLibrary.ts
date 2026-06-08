/**
 * Bibliothèque audio (ADR-0022) — accès client à `audio_documents` + Storage.
 *
 * Conservation : le texte (transcription / compte rendu) est gardé indéfiniment ; l'audio
 * source est conservé ≤ 24h dans le bucket privé `consultation-audio` puis purgé côté serveur
 * (cron). Toutes les opérations passent par la RLS own-row : un utilisateur ne voit que SES
 * documents et ne lit que SON dossier de stockage ({user_id}/...).
 */
import { getSupabaseClient } from '@/db/supabase';

export const AUDIO_BUCKET = 'consultation-audio';
const AUDIO_TTL_MS = 24 * 60 * 60 * 1000;

export type AudioKind = 'transcription' | 'report';

export interface AudioDocument {
  id: string;
  title: string;
  folder: string | null;
  kind: AudioKind;
  transcription: string;
  report: string | null;
  audio_path: string | null;
  audio_expires_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

/** L'audio est-il encore disponible (non purgé / non expiré) ? */
export function isAudioAvailable(doc: AudioDocument): boolean {
  if (!doc.audio_path || !doc.audio_expires_at) return false;
  return new Date(doc.audio_expires_at).getTime() > Date.now();
}

export interface SaveAudioInput {
  userId: string;
  title: string;
  kind: AudioKind;
  transcription: string;
  report?: string | null;
  audioBlob?: Blob | null;
  audioMimeType?: string;
  durationSeconds?: number | null;
}

/**
 * Enregistre un document (texte conservé indéfiniment) et téléverse l'audio (≤24h) si fourni.
 * L'échec du téléversement audio n'empêche pas la sauvegarde du texte (dégradation propre).
 */
export async function saveAudioDocument(input: SaveAudioInput): Promise<AudioDocument> {
  const supabase = getSupabaseClient();
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let audioPath: string | null = null;
  let audioExpiresAt: string | null = null;

  if (input.audioBlob) {
    const ext = input.audioMimeType?.includes('mp4') ? 'mp4' : 'webm';
    const path = `${input.userId}/${id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(path, input.audioBlob, {
        contentType: input.audioMimeType || 'audio/webm',
        upsert: true,
      });
    if (!upErr) {
      audioPath = path;
      audioExpiresAt = new Date(Date.now() + AUDIO_TTL_MS).toISOString();
    }
  }

  const { data, error } = await supabase
    .from('audio_documents')
    .insert({
      id,
      user_id: input.userId,
      title: input.title.trim() || 'Compte rendu',
      kind: input.kind,
      transcription: input.transcription,
      report: input.report ?? null,
      audio_path: audioPath,
      audio_expires_at: audioExpiresAt,
      duration_seconds: input.durationSeconds ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as AudioDocument;
}

export async function listAudioDocuments(): Promise<AudioDocument[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('audio_documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AudioDocument[];
}

export async function updateAudioDocument(
  id: string,
  patch: { title?: string; folder?: string | null },
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('audio_documents')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAudioDocument(doc: AudioDocument): Promise<void> {
  const supabase = getSupabaseClient();
  if (doc.audio_path) {
    // Best-effort : on retire l'audio du bucket avant de supprimer la ligne.
    await supabase.storage.from(AUDIO_BUCKET).remove([doc.audio_path]).catch(() => undefined);
  }
  const { error } = await supabase.from('audio_documents').delete().eq('id', doc.id);
  if (error) throw error;
}

/** URL signée (1h) pour réécouter l'audio tant qu'il n'est pas purgé. */
export async function getAudioSignedUrl(path: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
