/**
 * POST /api/cv-import — Import d'un CV existant → pré-remplissage structuré (ADR-0028).
 *
 * Le client extrait le TEXTE d'un CV existant (PDF via pdf.js, Word via mammoth, ou texte
 * collé) et l'envoie ici. L'IA structure ce texte dans le modèle de CV (identité, expériences,
 * formation, etc.) via `generateObject` + schéma Zod. Elle N'INVENTE RIEN : les champs absents
 * restent vides ; l'utilisateur corrige ensuite dans l'éditeur. La photo n'est jamais importée.
 *
 * Sécurité (ADR-0018) : réservé aux comptes vérifiés ÉTUDIANT / PROFESSIONNEL (et admins),
 * persona dérivée du profil vérifié côté serveur (jamais du body). Rate-limit (compteur étudiant).
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "cv_import") est configurable depuis le
 * panel admin (app/(admin)/index.tsx). Si tu ajoutes une étape IA ici, déclare-la dans
 * src/admin/index.ts AI_FEATURES.
 */
import { generateObject } from 'ai';
import { z } from 'zod';

import { isAdminUserId } from '@/admin/index';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { resolveChatPersona } from '@/ai/routing/serverPersona';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { normalizeImportedCv } from '@/cv/cvDocument';

const MAX_TEXT = 24_000;

// ⚠️ AUCUN champ optionnel dans ce schéma : l'API Anthropic refuse les schémas
// d'outil comptant plus de 24 paramètres optionnels (« Schemas contains too many
// optional parameters », vu en prod avec l'ancien `.partial()` → 64 optionnels).
// Tout est requis ; l'absence se dit par chaîne vide / tableau vide / false / 0,
// ce que `normalizeImportedCv` (défensif, `raw: unknown`) nettoie de toute façon.
const entry = z.object({
  title: z.string(),
  degree: z.string(),
  institution: z.string(),
  department: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean(),
  description: z.string(),
  bullets: z.array(z.string()),
});

const importSchema = z.object({
  personalInfo: z.object({
    firstName: z.string(),
    lastName: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    city: z.string(),
    country: z.string(),
    nationality: z.string(),
    website: z.string(),
  }),
  summary: z.string(),
  experiences: z.array(entry),
  education: z.array(entry),
  researchProjects: z.array(entry),
  references: z.array(
    z.object({ name: z.string(), title: z.string(), institution: z.string(), location: z.string(), phone: z.string(), email: z.string() }),
  ),
  certificates: z.array(z.object({ title: z.string(), subtitle: z.string(), score: z.string(), date: z.string() })),
  languages: z.array(z.object({ name: z.string(), levelLabel: z.string(), level: z.number() })),
  interests: z.array(z.string()),
  personalProjects: z.array(z.object({ title: z.string(), description: z.string(), url: z.string() })),
});

export async function POST(request: Request): Promise<Response> {
  const rateLimit = await checkChatRateLimit(request, 'student');
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Limite d\'imports atteinte pour aujourd\'hui.' }, { status: 429 });
  }

  const resolution = await resolveChatPersona(request, null);
  const isAdmin = resolution.userId ? isAdminUserId(resolution.userId) : false;
  if (!isAdmin && resolution.persona !== 'student' && resolution.persona !== 'professional') {
    return Response.json(
      { error: 'Outil réservé aux comptes vérifiés étudiant ou professionnel.' },
      { status: 403 },
    );
  }

  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT) : '';
  if (text.trim().length < 30) {
    return Response.json({ error: 'Texte du CV vide ou trop court (CV scanné ?).' }, { status: 400 });
  }

  const [system, runtime] = await Promise.all([
    getPromptTemplate('cv_import'),
    getRuntimeForFeature('cv_import'),
  ]);
  const { tools: _tools, ...callOptions } = runtime.options;

  try {
    const { object } = await generateObject({
      model: runtime.model,
      system,
      schema: importSchema,
      prompt:
        'Voici le texte brut d\'un CV existant. Structure-le fidèlement dans le format demandé, ' +
        'sans rien inventer ni reformuler (recopie les intitulés, dates et lieux tels quels). ' +
        'Tous les champs sont requis : mets une chaîne vide (ou un tableau vide, false, 0) ' +
        'pour toute information absente du CV.\n\n"""' + text + '"""',
      ...callOptions,
    });
    return Response.json({ document: normalizeImportedCv(object) });
  } catch (e) {
    console.error('CV import error:', e);
    return Response.json({ error: 'Échec de l\'import. Réessaie ou remplis le CV manuellement.' }, { status: 502 });
  }
}
