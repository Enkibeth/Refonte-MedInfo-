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
    description: 'Les 3 chatbots (grand public, étudiant, professionnel), modèle partagé',
    apiRoute: '/api/chat',
    promptKeys: ['public', 'student', 'professional'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'chat_researcher',
    emoji: '🔎',
    label: 'Chat — Agent chercheur (orchestrateur)',
    description:
      'Split orchestrateur/rédacteur (flag CHAT_ORCHESTRATOR_SPLIT) : modèle bon marché qui rassemble un dossier de preuves vérifié, la rédaction restant sur le modèle du chat',
    apiRoute: '/api/chat',
    promptKeys: ['chat_researcher'],
    providers: ['openai', 'anthropic', 'google'],
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
    key: 'pubmed_agent',
    emoji: '🔬',
    label: 'Chat — Sous-agent PubMed',
    description:
      'Recherche PubMed déléguée par le chatbot professionnel à un modèle Claude (connecteur MCP hébergé Anthropic)',
    apiRoute: '/api/chat',
    promptKeys: ['pubmed_agent'],
    providers: ['anthropic'],
  },
  {
    key: 'analyze',
    emoji: '📄',
    label: 'Analyse de document',
    description: 'Résumé patient ou traduction d\'un document médical (texte, PDF, photo)',
    apiRoute: '/api/analyze',
    promptKeys: ['analyze', 'analyze_translate'],
    providers: ['anthropic', 'openai'],
  },
  {
    key: 'qcm_generate',
    emoji: '📝',
    label: 'QCM — Génération type EDN',
    description: 'Génère à la demande un mini-examen de QCM/QCS type EDN sur le sujet du chat étudiant',
    apiRoute: '/api/qcm',
    promptKeys: ['qcm_generate'],
    providers: ['anthropic', 'openai', 'google'],
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
    key: 'presentation_generate',
    emoji: '🖥️',
    label: 'Présentations — Co-construction',
    description: 'Médecin senior qui co-construit une présentation médicale (deck JSON) pour étudiants/pros',
    apiRoute: '/api/presentation',
    promptKeys: ['presentation_generate'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'revision_plan_assist',
    emoji: '🗓️',
    label: 'Révisions — Coup de pouce planning',
    description: 'Propose des ajustements de planning (reprioriser, alléger, rappels) : pédagogique, jamais médical',
    apiRoute: '/api/revision',
    promptKeys: ['revision_plan_assist'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'cv_review',
    emoji: '📋',
    label: 'CV — Relecture IA',
    description: 'Relit un CV médical/pro et renvoie des suggestions (orthographe, style, cohérence) à valider, jamais de réécriture auto',
    apiRoute: '/api/cv',
    promptKeys: ['cv_review'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'cv_import',
    emoji: '📥',
    label: 'CV — Import (pré-remplissage)',
    description: 'Structure le texte d\'un CV existant (PDF/Word) dans les champs de l\'éditeur, sans rien inventer',
    apiRoute: '/api/cv-import',
    promptKeys: ['cv_import'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'article_assist',
    emoji: '✒️',
    label: 'Article — Aide à la rédaction',
    description:
      'Améliore une section de manuscrit médical (style scientifique, clarté, traduction, titres) ; n\'invente jamais un fait ni une référence',
    apiRoute: '/api/article',
    promptKeys: ['article_assist'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'article_reduce',
    emoji: '✂️',
    label: 'Article — Réduction de caractères',
    description:
      'Réduit une section à la limite imposée (caractères/mots) en préservant faits, chiffres et appels de citation',
    apiRoute: '/api/article',
    promptKeys: ['article_reduce'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'article_originality',
    emoji: '🔍',
    label: 'Article — Contrôle d\'originalité',
    description:
      'Repère les formulations trop proches de sources publiées (recherche web) et propose des reformulations ; indicatif, ne remplace pas un logiciel anti-plagiat',
    apiRoute: '/api/article',
    promptKeys: ['article_originality'],
    providers: ['anthropic', 'openai', 'google'],
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
  {
    key: 'blog_topic',
    emoji: '🗓️',
    label: 'Blog — Choix du sujet hebdo',
    description: 'Agent hebdomadaire : choisit le sujet de la semaine en évitant les doublons',
    apiRoute: '/api/cron/weekly-blog',
    promptKeys: ['blog_topic'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'blog_fact_check',
    emoji: '🔬',
    label: 'Blog — Vérification des faits et sources',
    description: 'Agent hebdomadaire : vérifie les faits, chiffres et sources citées de l\'article (recherche web), rapport transmis au relecteur final',
    apiRoute: '/api/cron/weekly-blog',
    promptKeys: ['blog_fact_check'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'blog_copyedit',
    emoji: '✍️',
    label: 'Blog — Relecture rédactionnelle',
    description: 'Agent hebdomadaire : corrige orthographe, style et structure de l\'article (jamais les faits) avant la relecture finale',
    apiRoute: '/api/cron/weekly-blog',
    promptKeys: ['blog_copyedit'],
    providers: ['anthropic', 'openai', 'google'],
  },
  {
    key: 'blog_review',
    emoji: '🔎',
    label: 'Blog — Relecture avant publication',
    description: 'Agent hebdomadaire : relit l\'article (publish / revise / reject) avant publication automatique',
    apiRoute: '/api/cron/weekly-blog',
    promptKeys: ['blog_review'],
    providers: ['anthropic', 'openai', 'google'],
  },
] as const;

export type FeatureKey = (typeof AI_FEATURES)[number]['key'];
