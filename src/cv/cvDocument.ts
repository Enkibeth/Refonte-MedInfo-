/**
 * Modèle de données + validation/minimisation du module CV Builder (ADR-0028).
 *
 * Module PUR et testable :
 *  - `sanitizeCvPayload` borne et valide le payload venu de l'iframe AVANT écriture
 *    en base (table `cv_documents`, own-row RLS, migration 0029).
 *  - `sanitizeCvForAi` applique la MINIMISATION des données personnelles (RGPD/CNIL)
 *    avant tout envoi au service d'IA de relecture : on retire la photo et, par défaut,
 *    les coordonnées (téléphone/email) des référents.
 *
 * ⚠️  Un CV contient des DONNÉES PERSONNELLES (identité, parfois celles des référents).
 * Toujours appliquer une logique de minimisation : n'envoyer à l'IA que le texte
 * strictement nécessaire à la correction.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Garde-fous de taille (un CV reste petit ; la photo base64 domine le poids). */
export const MAX_TITLE_CHARS = 200;
export const MAX_CV_JSON_CHARS = 600_000; // ~ couvre une photo base64 raisonnable

/** Un seul thème en v1 (schéma extensible : on ajoutera des thèmes plus tard). */
export type CvTheme = 'medical';

export interface CvPersonalInfo {
  firstName?: string;
  lastName?: string;
  headline?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  nationality?: string;
  website?: string;
  /** Photo en data-URI base64 (jamais envoyée à l'IA — cf sanitizeCvForAi). */
  photoUrl?: string;
}

export interface CvExperience {
  id: string;
  title?: string;
  institution?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  bullets?: string[];
}

export interface CvEducation {
  id: string;
  degree?: string;
  institution?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  bullets?: string[];
}

export interface CvResearchProject {
  id: string;
  title?: string;
  institution?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  bullets?: string[];
}

export interface CvReference {
  id: string;
  name?: string;
  title?: string;
  institution?: string;
  location?: string;
  /** Coordonnées : retirées par défaut avant envoi à l'IA (minimisation). */
  phone?: string;
  email?: string;
}

export interface CvCertificate {
  id: string;
  title?: string;
  subtitle?: string;
  score?: string;
  date?: string;
}

export interface CvLanguage {
  id: string;
  name?: string;
  levelLabel?: string;
  /** 1..5 (jauge). */
  level?: number;
}

export interface CvInterest {
  id: string;
  label?: string;
}

export interface CvPersonalProject {
  id: string;
  title?: string;
  description?: string;
  url?: string;
}

export interface CvDocument {
  personalInfo: CvPersonalInfo;
  summary?: string;
  experiences: CvExperience[];
  education: CvEducation[];
  researchProjects: CvResearchProject[];
  references: CvReference[];
  certificates: CvCertificate[];
  languages: CvLanguage[];
  interests: CvInterest[];
  personalProjects: CvPersonalProject[];
}

export interface CvPayload {
  title: string;
  theme: CvTheme;
  document: Record<string, unknown>;
}

export type SanitizeResult = { ok: true; value: CvPayload } | { ok: false; error: string };

/** Id de CV transmis par le client (uuid, sinon null). */
export function coerceCvId(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

export function coerceTheme(_value: unknown): CvTheme {
  // Un seul thème en v1. Toute valeur inconnue retombe sur 'medical'.
  return 'medical';
}

export function coerceTitle(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_CHARS);
}

function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Valide et borne le corps d'une sauvegarde de CV. Échoue (ok:false) si le document
 * est absent/illisible ou trop volumineux (garde-fou payload), sinon renvoie un objet
 * propre prêt à écrire.
 */
export function sanitizeCvPayload(body: unknown): SanitizeResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  if (!b.document || typeof b.document !== 'object' || Array.isArray(b.document)) {
    return { ok: false, error: 'document requis (objet).' };
  }
  if (jsonSize(b.document) > MAX_CV_JSON_CHARS) {
    return { ok: false, error: 'CV trop volumineux (photo trop lourde ?).' };
  }

  const document = b.document as Record<string, unknown>;
  // Titre : explicite, sinon dérivé du nom de la personne.
  const info = (document.personalInfo as Record<string, unknown> | undefined) ?? {};
  const derived = [info.firstName, info.lastName]
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ');
  const title = coerceTitle(b.title) || coerceTitle(derived ? `CV ${derived}` : '') || 'CV sans titre';

  return { ok: true, value: { title, theme: coerceTheme(b.theme), document } };
}

// ── Minimisation RGPD avant envoi à l'IA ────────────────────────────────────

export interface SanitizeForAiOptions {
  /** Inclure téléphone/email des référents (OFF par défaut : minimisation). */
  includeReferenceContactDetails?: boolean;
}

function s(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function strArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return out.length ? out : undefined;
}

/** Retire les `undefined` pour un payload IA compact. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

/**
 * Construit la version MINIMISÉE du CV envoyée au service de relecture IA.
 *  - jamais la photo (`photoUrl`) ;
 *  - jamais les coordonnées des référents par défaut (téléphone/email) ;
 *  - uniquement le texte utile à la correction (orthographe, style, cohérence).
 *
 * Le `fieldPath` conservé reste stable pour rapprocher les suggestions de l'IA des
 * champs côté client (cf. applyCvSuggestion dans public/cv-builder.html).
 */
export function sanitizeCvForAi(
  document: unknown,
  options: SanitizeForAiOptions = {},
): Record<string, unknown> {
  const doc = (document && typeof document === 'object' ? document : {}) as Record<string, unknown>;
  const info = (doc.personalInfo as Record<string, unknown> | undefined) ?? {};
  const arr = (key: string): Record<string, unknown>[] => {
    const v = doc[key];
    return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [];
  };

  return compact({
    personalInfo: compact({
      // Identité utile au ton, JAMAIS la photo, l'email perso, le téléphone.
      firstName: s(info.firstName),
      lastName: s(info.lastName),
      headline: s(info.headline),
      city: s(info.city),
      country: s(info.country),
      nationality: s(info.nationality),
    }),
    summary: s(doc.summary),
    experiences: arr('experiences').map((e) =>
      compact({
        title: s(e.title),
        institution: s(e.institution),
        location: s(e.location),
        startDate: s(e.startDate),
        endDate: e.isCurrent ? 'présent' : s(e.endDate),
        description: s(e.description),
        bullets: strArray(e.bullets),
      }),
    ),
    education: arr('education').map((e) =>
      compact({
        degree: s(e.degree),
        institution: s(e.institution),
        location: s(e.location),
        startDate: s(e.startDate),
        endDate: s(e.endDate),
        description: s(e.description),
        bullets: strArray(e.bullets),
      }),
    ),
    researchProjects: arr('researchProjects').map((e) =>
      compact({
        title: s(e.title),
        institution: s(e.institution),
        department: s(e.department),
        startDate: s(e.startDate),
        endDate: e.isCurrent ? 'présent' : s(e.endDate),
        bullets: strArray(e.bullets),
      }),
    ),
    certificates: arr('certificates').map((e) =>
      compact({ title: s(e.title), subtitle: s(e.subtitle), score: s(e.score), date: s(e.date) }),
    ),
    languages: arr('languages').map((e) => compact({ name: s(e.name), levelLabel: s(e.levelLabel) })),
    interests: arr('interests')
      .map((e) => s(e.label))
      .filter((x): x is string => !!x),
    personalProjects: arr('personalProjects').map((e) =>
      compact({ title: s(e.title), description: s(e.description), url: s(e.url) }),
    ),
    references: arr('references').map((r) =>
      compact({
        name: s(r.name),
        title: s(r.title),
        institution: s(r.institution),
        location: s(r.location),
        // Minimisation : coordonnées seulement si l'utilisateur l'a explicitement demandé.
        phone: options.includeReferenceContactDetails ? s(r.phone) : undefined,
        email: options.includeReferenceContactDetails ? s(r.email) : undefined,
      }),
    ),
  });
}
