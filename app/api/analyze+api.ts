/**
 * POST /api/analyze — Analyse ou traduction de document médical (streaming).
 *
 * Deux entrées possibles :
 *   - JSON `{ documentText, mode?, targetLanguage? }` (texte collé) ;
 *   - multipart/form-data `file` + `mode` + `targetLanguage` (PDF, photo JPEG/PNG/WebP,
 *     fichier texte) — le document est transmis au modèle multimodal puis OUBLIÉ :
 *     seul le résultat est archivé dans l'historique (`document_analyses`, onFinish).
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "analyze") est configurable
 * depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { streamText, type ModelMessage } from 'ai';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { resolveVerifiedUserId } from '@/auth/serverIdentity';
import { createServerSupabaseClient } from '@/db/serverSupabase';
import { saveAnalysisServer } from '@/document/serverAnalysisHistory';
import type { AnalysisMode } from '@/document/analysisHistory';

const MAX_DOC_LENGTH = 12_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 Mo (limite providers PDF/vision)

/** Formats acceptés (PDF, photos de compte rendu, texte brut). */
const PDF_TYPE = 'application/pdf';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv']);

const EXTENSION_TYPES: Record<string, string> = {
  pdf: PDF_TYPE,
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
};

/** Fichier multipart côté serveur (File undici ; les types RN de FormData divergent du DOM). */
type UploadedFile = Blob & { name?: string };

/** Type MIME effectif du fichier (déclaré, sinon déduit de l'extension). */
function resolveMediaType(file: UploadedFile): string | null {
  const declared = (file.type || '').toLowerCase().split(';')[0].trim();
  if (declared === PDF_TYPE || IMAGE_TYPES.has(declared) || TEXT_TYPES.has(declared)) {
    return declared;
  }
  const ext = (file.name ?? '').toLowerCase().split('.').pop() ?? '';
  return EXTENSION_TYPES[ext] ?? null;
}

function coerceMode(value: unknown): AnalysisMode {
  return value === 'translation' ? 'translation' : 'analysis';
}

function coerceTargetLanguage(value: unknown): string {
  const lang = typeof value === 'string' ? value.trim().slice(0, 40) : '';
  return lang || 'français';
}

interface DocumentInput {
  mode: AnalysisMode;
  targetLanguage: string;
  sourceName: string | null;
  /** Texte du document (texte collé ou fichier texte). */
  text: string | null;
  /** Fichier binaire (PDF ou image) transmis tel quel au modèle. */
  file: { bytes: Uint8Array; mediaType: string } | null;
}

async function parseInput(request: Request): Promise<DocumentInput | Response> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    let form: { get(name: string): unknown };
    try {
      form = (await request.formData()) as unknown as { get(name: string): unknown };
    } catch {
      return Response.json({ error: 'Formulaire invalide.' }, { status: 400 });
    }
    const file = form.get('file') as UploadedFile | null;
    if (!(file instanceof Blob) || file.size === 0) {
      return Response.json({ error: 'Aucun fichier reçu.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: 'Fichier trop volumineux (maximum 15 Mo).' }, { status: 400 });
    }
    const mediaType = resolveMediaType(file);
    if (!mediaType) {
      return Response.json(
        { error: 'Format non pris en charge. Formats acceptés : PDF, JPEG, PNG, WebP, texte.' },
        { status: 400 },
      );
    }
    const mode = coerceMode(form.get('mode'));
    const targetLanguage = coerceTargetLanguage(form.get('targetLanguage'));
    const sourceName = (file.name ?? '').slice(0, 200) || 'Document';

    if (TEXT_TYPES.has(mediaType)) {
      const text = (await file.text()).trim();
      if (text.length < 20) {
        return Response.json({ error: 'Document trop court (minimum 20 caractères).' }, { status: 400 });
      }
      return { mode, targetLanguage, sourceName, text: text.slice(0, MAX_DOC_LENGTH), file: null };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    return { mode, targetLanguage, sourceName, text: null, file: { bytes, mediaType } };
  }

  // Entrée JSON : texte collé.
  let body: { documentText?: string; mode?: unknown; targetLanguage?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }
  const documentText = body.documentText?.trim() ?? '';
  if (documentText.length < 20) {
    return Response.json({ error: 'Document trop court (minimum 20 caractères).' }, { status: 400 });
  }
  return {
    mode: coerceMode(body.mode),
    targetLanguage: coerceTargetLanguage(body.targetLanguage),
    sourceName: null,
    text: documentText.slice(0, MAX_DOC_LENGTH),
    file: null,
  };
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = await checkChatRateLimit(request, 'public');
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Limite de requêtes atteinte.' }, { status: 429 });
  }

  const input = await parseInput(request);
  if (input instanceof Response) return input;

  // Identité vérifiée (token → user) : conditionne uniquement l'archivage du résultat.
  const supabase = createServerSupabaseClient();
  const userId = supabase ? await resolveVerifiedUserId(request, supabase) : null;

  try {
    const promptKey = input.mode === 'translation' ? 'analyze_translate' : 'analyze';
    const [runtime, systemPrompt] = await Promise.all([
      getRuntimeForFeature('analyze'),
      getPromptTemplate(promptKey),
    ]);

    const instruction =
      input.mode === 'translation'
        ? `Voici le document médical à traduire. Langue cible : ${input.targetLanguage}.`
        : 'Voici le document médical à analyser :';

    const userContent: Exclude<(ModelMessage & { role: 'user' })['content'], string> = input.file
      ? [
          { type: 'text', text: instruction },
          input.file.mediaType === PDF_TYPE
            ? { type: 'file', data: input.file.bytes, mediaType: PDF_TYPE }
            : { type: 'image', image: input.file.bytes, mediaType: input.file.mediaType },
        ]
      : [{ type: 'text', text: `${instruction}\n\n${input.text}` }];

    const result = streamText({
      model: runtime.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      ...runtime.options,
      onFinish: async ({ text }) => {
        // Archivage du seul RÉSULTAT (jamais du document) pour les comptes connectés.
        if (userId && supabase) {
          await saveAnalysisServer(supabase, {
            userId,
            mode: input.mode,
            sourceName: input.sourceName ?? 'Texte collé',
            targetLanguage: input.targetLanguage,
            result: text,
          });
        }
      },
    });

    // La génération va au bout même si le client coupe le flux : le résultat archivé
    // reste récupérable depuis l'historique des analyses.
    void result.consumeStream();

    return result.toTextStreamResponse();
  } catch (e) {
    console.error('Analyze error:', e);
    return Response.json({ error: 'Analyse impossible pour le moment.' }, { status: 502 });
  }
}
