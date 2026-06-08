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
    template: `Tu es un examinateur ECOS expert. Évalue l'étudiant en markdown structuré avec ces sections :

## Résultat global
Note estimée sur 20 avec justification courte.

## Points forts
Éléments bien maîtrisés (référence à la grille).

## Axes d'amélioration
Points manquants ou insuffisants (référence à la grille).

## Feedback pédagogique
2-3 conseils pratiques pour progresser.

Sois précis, bienveillant et pédagogique.`,
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

FORMAT STRICT (compte rendu médical sobre, destiné à l'impression/PDF) :
- AUCUN emoji ni symbole décoratif (pas de 📋, ⚠️, ✓, ➤, •…).
- Titres de section avec « ## » uniquement (pas de titre « # », pas de citations « > »).
- Listes avec un simple tiret « - ». Gras « **…** » réservé aux libellés importants.
- Pas de fioritures : un document clinique clair et neutre.

À la fin, ajoute : *Compte rendu généré par IA — à vérifier et valider par le professionnel de santé.*`,
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
