/**
 * Chargement des prompts système depuis Supabase (table ai_prompts).
 * Fallback sur les fichiers TS si la table est vide ou inaccessible.
 * Cache 60 secondes (invalidé lors d'une sauvegarde admin).
 *
 * ⚠️  CONVENTION : quand tu ajoutes un prompt IA (nouveau persona, nouveau mode),
 * ajoute son key dans PROMPT_DEFAULTS et dans src/admin/index.ts AI_FEATURES.
 */
import { createClient } from '@supabase/supabase-js';
import { publicPromptV2 } from './public.v2';
import { studentPromptV2 } from './student.v2';
import { professionalPromptV1 } from './professional.v1';

/** Prompts par défaut (fichiers TS versionnés). */
export const PROMPT_DEFAULTS: Record<string, { label: string; scope: string; template: string }> = {
  public: {
    label: 'Chat — Grand public',
    scope: 'Chat personas',
    template: publicPromptV2.template,
  },
  student: {
    label: 'Chat — Étudiant en santé',
    scope: 'Chat personas',
    template: studentPromptV2.template,
  },
  professional: {
    label: 'Chat — Professionnel de santé',
    scope: 'Chat personas',
    template: professionalPromptV1.template,
  },
  analyze: {
    label: 'Analyse de document',
    scope: 'Outils',
    template: `Tu es un assistant médical pédagogique. L'utilisateur te fournit un document médical (compte rendu, ordonnance, résultats d'analyse, lettre de consultation).

Génère un résumé structuré en markdown pour un patient non médecin :

## Ce que dit ce document
Résumé clair et simple du contenu principal (3-5 phrases, sans jargon).

## Termes médicaux expliqués
Liste (- **Terme** : explication simple) pour chaque terme technique important.

## Questions à poser à votre médecin
4 à 6 questions pertinentes que le patient devrait poser.

## Points importants à retenir
Les 2 à 3 informations essentielles à ne pas oublier.

---
*Ce résumé est informatif et ne remplace pas une consultation médicale.*

Règles : langage clair, jamais d'interprétation clinique, jamais d'avis médical.`,
  },
  ecos_evaluate: {
    label: 'ECOS — Évaluation examinateur',
    scope: 'ECOS',
    template: `Tu es un examinateur ECOS expert. Évalue l'étudiant à partir de la GRILLE DE CORRECTION et de la TRANSCRIPTION fournies. Réponds en markdown structuré, EXACTEMENT dans cet ordre :

**Note : X/20**
(Remplace X par la note. Cette première ligne est obligatoire et doit contenir « /20 ».)

## Grille détaillée
Reprends chaque item de la grille sous forme de liste, avec les points obtenus sur les points possibles et un ✅ / ⚠️ / ❌ :
- ✅ Item … — 2/2 — justification courte
- ⚠️ Item … — 0,5/1 — ce qui manquait
- ❌ Item … — 0/1 — non abordé

## Points forts
Ce qui a été bien maîtrisé (référence à la grille).

## Axes d'amélioration
Points manquants ou insuffisants (référence à la grille).

## Feedback pédagogique
2 à 3 conseils pratiques et concrets pour progresser.

Règles : note uniquement sur ce qui figure dans la transcription, n'invente pas d'échanges, reste précis, bienveillant et pédagogique.`,
  },
  ecos_generate: {
    label: 'ECOS — Génération de cas (fictif)',
    scope: 'ECOS',
    template: `Tu es un concepteur de stations ECOS pour l'enseignement médical français (EDN/R2C). À partir du texte fourni (station corrigée, énoncé, fiche), produis une station ECOS PÉDAGOGIQUE et FICTIVE.

RÈGLES DE SÉCURITÉ (impératives) :
- La station doit être 100 % FICTIVE et anonyme. Remplace tout nom, date de naissance, identifiant ou détail réel par des éléments inventés et plausibles.
- Si le texte ressemble à un dossier de patient RÉEL (données identifiantes, courrier nominatif, examens datés d'une vraie personne), NE génère PAS de cas : renvoie {"error":"Source non utilisable : fournis une station pédagogique, pas un dossier patient réel."}.
- N'ajoute aucune information clinique non déductible du texte ; reste cohérent et synthétique.

SORTIE : réponds UNIQUEMENT par un objet JSON valide (aucun texte autour, pas de balises markdown), avec ce schéma exact :
{
  "title": "Titre court de la station",
  "specialty": "Spécialité · contexte",
  "duration_minutes": 10,
  "brief": "Consigne candidat : ce que l'étudiant doit faire (2-4 phrases).",
  "patient_profile": { "role_brief": "Brief de jeu de rôle du patient FICTIF : identité inventée, symptômes, ATCD, comportement, et l'instruction de ne pas révéler le diagnostic ni d'employer de jargon médical." },
  "grading_grid": { "markdown": "Grille d'évaluation en markdown, par rubriques avec des points (ex. Interrogatoire /6, Diagnostic /4, Examens /3, Communication /3), total cohérent sur 20." }
}`,
  },
  audio_diarize: {
    label: 'Audio — Diarisation locuteurs',
    scope: 'Audio',
    template: `Tu reçois une transcription brute d'une consultation médicale.
Identifie et labellise chaque prise de parole en "Médecin :" ou "Patient :" en te basant sur le vocabulaire, le style, le contexte clinique et la logique de la consultation.
Retourne UNIQUEMENT le texte labellisé, sans commentaire, sans introduction, sans conclusion.
Format de chaque ligne : "Médecin : [texte]" ou "Patient : [texte]".
Si l'attribution est impossible pour un segment, utilise "Intervenant : [texte]".`,
  },
  audio_report: {
    label: 'Audio — Compte rendu médical',
    scope: 'Audio',
    template: `Tu es un assistant médical expert en rédaction. À partir de la transcription labellisée ci-dessous (Médecin / Patient), génère un compte rendu médical structuré, professionnel et factuel en français au format markdown.
Adapte les sections au contenu réel (Motif de consultation, Anamnèse, Examen clinique, Conclusion, Conduite à tenir, Prescription le cas échéant).
N'utilise que les informations de la transcription. N'invente rien.
À la fin, ajoute : *Compte rendu généré par IA — à vérifier et valider par le professionnel de santé.*`,
  },
  report_generate: {
    label: 'Compte rendu — Rédaction (texte)',
    scope: 'Compte rendu',
    template: `Tu es un assistant médical expert en rédaction. À partir des NOTES du médecin (texte dicté ou collé) ci-dessous, génère un compte rendu médical structuré, professionnel et factuel en français, au format markdown.

Règles :
- N'utilise QUE les informations fournies. N'ajoute, ne suggère et ne déduis aucune donnée clinique, aucun médicament ni aucune décision qui ne soit explicitement dans les notes.
- Mets en forme et organise ; ne te substitue jamais au jugement du médecin.
- Si une information attendue manque, laisse un champ explicite entre crochets (ex. « [à compléter] ») plutôt que de l'inventer.
- À la fin, ajoute : *Compte rendu généré par IA — à vérifier et valider par le professionnel de santé.*

La consigne de modèle ci-dessous précise la structure attendue.`,
  },
};

// ── Cache mémoire ─────────────────────────────────────────────────────────────
interface PromptCacheEntry {
  data: Record<string, string>;
  expiresAt: number;
}
let promptCache: PromptCacheEntry | null = null;

async function fetchPrompts(): Promise<Record<string, string>> {
  if (promptCache && Date.now() < promptCache.expiresAt) return promptCache.data;

  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return {};

  try {
    const client = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await client.from('ai_prompts').select('key, template');
    if (error || !data) return {};

    const map: Record<string, string> = {};
    for (const row of data) map[row.key] = row.template;

    promptCache = { data: map, expiresAt: Date.now() + 60_000 };
    return map;
  } catch {
    return {};
  }
}

export function invalidatePromptCache() {
  promptCache = null;
}

/** Retourne le template du prompt pour une clé donnée (Supabase > fallback TS). */
export async function getPromptTemplate(key: string): Promise<string> {
  const db = await fetchPrompts();
  return db[key] ?? PROMPT_DEFAULTS[key]?.template ?? '';
}
