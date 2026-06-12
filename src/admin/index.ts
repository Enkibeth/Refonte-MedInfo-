/**
 * Contrôle d'accès admin (lecture seule côté client).
 *
 * ⚠️  CONVENTION : chaque nouvelle fonctionnalité IA DOIT être enregistrée dans
 * le panel admin (app/(admin)/index.tsx) — voir README_ADMIN.md et le registre
 * AI_FEATURES ci-dessous. Ne pas oublier de déclarer le feature key dans
 * featureModel.ts et d'insérer une ligne dans ai_model_config (migration SQL).
 */
import { createClient } from '@supabase/supabase-js';

/** IDs des comptes administrateurs (jamais exposés côté client). */
export const ADMIN_USER_IDS = new Set([
  'fc110458-1037-4242-8b1c-545f9e0c7f19', // medaifr1@gmail.com
  '0ffd3fb8-ade3-47f4-8e38-6340ae706fb4', // h.bilal0@icloud.com
]);

export function isAdminUserId(userId: string): boolean {
  return ADMIN_USER_IDS.has(userId);
}

/**
 * Vérifie le token JWT et retourne l'ID utilisateur si admin.
 * À utiliser dans les routes API /api/admin/*.
 */
export async function requireAdmin(request: Request): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return {
      ok: false,
      response: Response.json({ error: 'Backend non configuré.' }, { status: 503 }),
    };
  }

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return {
      ok: false,
      response: Response.json({ error: 'Non authentifié.' }, { status: 401 }),
    };
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return {
      ok: false,
      response: Response.json({ error: 'Session invalide.' }, { status: 401 }),
    };
  }

  if (!isAdminUserId(data.user.id)) {
    return {
      ok: false,
      response: Response.json({ error: 'Accès refusé.' }, { status: 403 }),
    };
  }

  return { ok: true, userId: data.user.id };
}

/**
 * Registre centralisé de toutes les fonctionnalités IA de l'application.
 *
 * ⚠️  RÈGLE : toute nouvelle fonctionnalité IA (API route ou composant qui appelle
 * un LLM) doit ajouter une entrée ici ET dans la migration SQL ai_model_config.
 */
export const AI_FEATURES = [
  {
    key: 'chat',
    emoji: '💬',
    label: 'Chat santé',
    description: 'Les 3 chatbots (grand public, étudiant, professionnel) — modèle partagé',
    apiRoute: '/api/chat',
    promptKeys: ['public', 'student', 'professional'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'chat_meta',
    emoji: '🏷️',
    label: 'Chat — Titre & catégorie',
    description: 'Nomme et classe automatiquement les conversations de l\'historique',
    apiRoute: '/api/chat-meta',
    promptKeys: ['chat_meta'],
    providers: ['google', 'openai', 'anthropic'],
  },
  {
    key: 'analyze',
    emoji: '📄',
    label: 'Analyse de document',
    description: 'Résumé patient d\'un document médical (CR, ordonnance…)',
    apiRoute: '/api/analyze',
    promptKeys: ['analyze'],
    providers: ['anthropic', 'openai'],
  },
  {
    key: 'ecos_simulate',
    emoji: '🩺',
    label: 'ECOS — Simulation patient',
    description: 'IA joue le rôle du patient pendant la simulation ECOS',
    apiRoute: '/api/ecos',
    promptKeys: ['ecos_patient'],
    providers: ['anthropic', 'openai'],
  },
  {
    key: 'ecos_evaluate',
    emoji: '📊',
    label: 'ECOS — Évaluation',
    description: 'IA évalue l\'étudiant sur la grille de correction',
    apiRoute: '/api/ecos',
    promptKeys: ['ecos_evaluate'],
    providers: ['anthropic', 'openai'],
  },
  {
    key: 'audio_diarize',
    emoji: '🔊',
    label: 'Audio — Diarisation',
    description: 'Identifie et labellise les locuteurs (Médecin / Patient)',
    apiRoute: '/api/transcribe',
    promptKeys: ['audio_diarize'],
    providers: ['openai'],
  },
  {
    key: 'audio_report',
    emoji: '🎤',
    label: 'Audio — Compte rendu',
    description: 'Génère un compte rendu médical structuré depuis la transcription',
    apiRoute: '/api/transcribe',
    promptKeys: ['audio_report'],
    providers: ['openai', 'anthropic'],
  },
  {
    key: 'blog_generate',
    emoji: '📰',
    label: 'Blog — Génération d\'article',
    description: 'Rédige un article santé innovant (titre, sommaire, sections) pour le blog public',
    apiRoute: '/api/admin/blog',
    promptKeys: ['blog_generate'],
    providers: ['anthropic', 'openai', 'google'],
  },
] as const;

export type FeatureKey = (typeof AI_FEATURES)[number]['key'];
