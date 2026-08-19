/**
 * Modèle de données + validation/minimisation du module CV Builder
 * (ADR-0028, refonte v2 : ADR-0036).
 *
 * Module PUR et testable :
 *  - `sanitizeCvPayload` borne et valide le payload venu de l'iframe AVANT écriture
 *    en base (table `cv_documents`, own-row RLS, migration 0029).
 *  - `sanitizeCvForAi` applique la MINIMISATION des données personnelles (RGPD/CNIL)
 *    avant tout envoi au service d'IA de relecture : jamais la photo, jamais les
 *    contacts (téléphone, e-mail, adresse) — seul le texte à corriger part.
 *  - `normalizeImportedCv` normalise la sortie de l'IA d'import.
 *
 * ⚠️  SCHÉMA : depuis la refonte, un CV est un document VERSIONNÉ à sections libres
 * (`schemaVersion: 2` — en-tête + liste ordonnée de sections, chacune avec ses
 * entrées). La MIGRATION des anciens documents (rubriques figées : experiences[],
 * education[]…) vit à UN SEUL endroit : `migrate()` dans le moteur de
 * `public/cv-builder.html`, appliquée par le client à l'ouverture. Le serveur ne
 * migre rien : il valide, borne et stocke le document tel quel (colonne jsonb).
 * C'est pourquoi `normalizeImportedCv` renvoie encore la structure « rubriques »
 * (elle est le format d'EXTRACTION de l'IA, que le client convertit en sections).
 *
 * ⚠️  Un CV contient des DONNÉES PERSONNELLES (identité, parfois celles de référents).
 * Toujours appliquer une logique de minimisation : n'envoyer à l'IA que le texte
 * strictement nécessaire à la correction.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Garde-fous de taille (un CV reste petit ; la photo base64 domine le poids). */
export const MAX_TITLE_CHARS = 200;
export const MAX_CV_JSON_CHARS = 600_000; // ~ couvre une photo base64 raisonnable

/**
 * Colonne `theme` de la table : elle reste 'medical' (le thème RÉEL du CV vit
 * désormais dans `document.theme`, avec ses couleurs et sa typographie).
 */
export type CvTheme = 'medical';

/** Version de schéma du document produite par l'éditeur (cf. `migrate()` côté client). */
export const CV_SCHEMA_VERSION = 2;

// ── Document v2 (sections libres) ───────────────────────────────────────────

export interface CvV2Entry {
  id?: string;
  title?: string;
  date?: string;
  organisation?: string;
  description?: string[];
  bullets?: string[];
  rating?: number;
  underline?: string;
}

export interface CvV2Section {
  id?: string;
  title?: string;
  column?: 'main' | 'side';
  layout?: 'entries' | 'tags' | 'ratings' | 'text';
  pageBreakBefore?: boolean;
  entries?: CvV2Entry[];
}

export interface CvV2Document {
  schemaVersion: number;
  meta?: { id?: string; title?: string; updatedAt?: string };
  header?: {
    fullName?: string;
    headline?: string;
    photo?: { dataUrl?: string } | null;
    contacts?: Array<{ id?: string; icon?: string; value?: string; href?: string }>;
  };
  sections?: CvV2Section[];
  theme?: Record<string, unknown>;
}

// ── Format d'EXTRACTION d'un CV existant (sortie de /api/cv-import) ─────────
//  Ce n'est PAS le format de stockage : le client le convertit en document v2
//  via `migrate()`. Les rubriques figées ci-dessous guident l'extraction de l'IA.

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
  // Titre : explicite, sinon celui du document, sinon dérivé du nom de la personne.
  const meta = (document.meta as Record<string, unknown> | undefined) ?? {};
  const header = (document.header as Record<string, unknown> | undefined) ?? {};
  const info = (document.personalInfo as Record<string, unknown> | undefined) ?? {};
  const legacyName = [info.firstName, info.lastName]
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ');
  const name = typeof header.fullName === 'string' && header.fullName.trim() ? header.fullName : legacyName;
  const title =
    coerceTitle(b.title) ||
    coerceTitle(meta.title) ||
    coerceTitle(name ? `CV ${name}` : '') ||
    'CV sans titre';

  return { ok: true, value: { title, theme: coerceTheme(b.theme), document } };
}

// ── Minimisation RGPD avant envoi à l'IA ────────────────────────────────────

export interface SanitizeForAiOptions {
  /** Inclure les contacts (téléphone, e-mail, adresse). OFF par défaut : minimisation. */
  includeContacts?: boolean;
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
 *  - jamais la photo ;
 *  - jamais les contacts (téléphone, e-mail, adresse) sauf demande explicite ;
 *  - uniquement le texte utile à la correction (orthographe, style, cohérence).
 *
 * ⚠️  Les INDEX sont préservés à l'identique (aucune section ni entrée n'est filtrée,
 * même vide) : c'est ce qui rend le `fieldPath` renvoyé par l'IA
 * (`sections.2.entries.0.bullets.1`) directement applicable au document côté client.
 * Filtrer les vides décalerait les index et appliquerait une suggestion au mauvais champ.
 */
export function sanitizeCvForAi(
  document: unknown,
  options: SanitizeForAiOptions = {},
): Record<string, unknown> {
  const doc = (document && typeof document === 'object' ? document : {}) as Record<string, unknown>;
  const header = (doc.header as Record<string, unknown> | undefined) ?? {};
  const sections = Array.isArray(doc.sections) ? doc.sections : [];

  const contacts = options.includeContacts && Array.isArray(header.contacts)
    ? (header.contacts as Record<string, unknown>[]).map((c) => s(c?.value)).filter((v): v is string => !!v)
    : undefined;

  return compact({
    header: compact({
      fullName: s(header.fullName),
      headline: s(header.headline),
      contacts,
    }),
    sections: sections.map((raw) => {
      const section = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const entries = Array.isArray(section.entries) ? section.entries : [];
      return compact({
        title: s(section.title),
        layout: s(section.layout),
        // `map` sans `filter` : un index d'entrée ne bouge jamais.
        entries: entries.map((rawEntry) => {
          const e = (rawEntry && typeof rawEntry === 'object' ? rawEntry : {}) as Record<string, unknown>;
          return compact({
            title: s(e.title),
            date: s(e.date),
            organisation: s(e.organisation),
            description: strArray(e.description),
            bullets: strArray(e.bullets),
          });
        }),
      });
    }),
  });
}

// ── Import d'un CV existant (extraction IA) ─────────────────────────────────

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function importBullets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim().slice(0, 600))
    .slice(0, 20);
}
function importArr(obj: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const v = obj[key];
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [];
}
function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : 'id-' + Math.random().toString(36).slice(2, 12);
}

/**
 * Normalise la sortie IA d'un import de CV (PDF/Word extrait en texte, structuré par
 * `generateObject`) en un `CvDocument` propre : bornes de longueur, ids d'items assignés
 * côté serveur, photo jamais importée. Module PUR (testé). L'IA n'invente rien : les champs
 * absents restent vides ; l'utilisateur corrige ensuite dans l'éditeur.
 */
export function normalizeImportedCv(raw: unknown): CvDocument {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const info = (r.personalInfo as Record<string, unknown> | undefined) ?? {};

  return {
    personalInfo: {
      firstName: str(info.firstName, 80),
      lastName: str(info.lastName, 80),
      headline: str(info.headline, 200),
      email: str(info.email, 120),
      phone: str(info.phone, 60),
      city: str(info.city, 80),
      country: str(info.country, 80),
      nationality: str(info.nationality, 80),
      website: str(info.website, 200),
      photoUrl: '', // jamais importée
    },
    summary: str(r.summary, 2000),
    experiences: importArr(r, 'experiences').slice(0, 40).map((e) => ({
      id: newId(),
      title: str(e.title, 200),
      institution: str(e.institution, 200),
      location: str(e.location, 120),
      startDate: str(e.startDate, 40),
      endDate: str(e.endDate, 40),
      isCurrent: e.isCurrent === true,
      description: str(e.description, 1500),
      bullets: importBullets(e.bullets),
    })),
    education: importArr(r, 'education').slice(0, 30).map((e) => ({
      id: newId(),
      degree: str(e.degree, 200),
      institution: str(e.institution, 200),
      location: str(e.location, 120),
      startDate: str(e.startDate, 40),
      endDate: str(e.endDate, 40),
      description: str(e.description, 1500),
      bullets: importBullets(e.bullets),
    })),
    researchProjects: importArr(r, 'researchProjects').slice(0, 30).map((e) => ({
      id: newId(),
      title: str(e.title, 300),
      institution: str(e.institution, 200),
      department: str(e.department, 200),
      startDate: str(e.startDate, 40),
      endDate: str(e.endDate, 40),
      isCurrent: e.isCurrent === true,
      bullets: importBullets(e.bullets),
    })),
    references: importArr(r, 'references').slice(0, 30).map((e) => ({
      id: newId(),
      name: str(e.name, 120),
      title: str(e.title, 300),
      institution: str(e.institution, 200),
      location: str(e.location, 120),
      phone: str(e.phone, 60),
      email: str(e.email, 120),
    })),
    certificates: importArr(r, 'certificates').slice(0, 40).map((e) => ({
      id: newId(),
      title: str(e.title, 300),
      subtitle: str(e.subtitle, 300),
      score: str(e.score, 60),
      date: str(e.date, 60),
    })),
    languages: importArr(r, 'languages').slice(0, 20).map((e) => ({
      id: newId(),
      name: str(e.name, 60),
      levelLabel: str(e.levelLabel, 60),
      level: typeof e.level === 'number' ? Math.max(1, Math.min(5, Math.round(e.level))) : undefined,
    })),
    interests: (Array.isArray(r.interests) ? r.interests : []).slice(0, 40).map((e) => ({
      id: newId(),
      label: typeof e === 'string' ? e.trim().slice(0, 120) : str((e as Record<string, unknown>)?.label, 120),
    })).filter((i) => i.label),
    personalProjects: importArr(r, 'personalProjects').slice(0, 20).map((e) => ({
      id: newId(),
      title: str(e.title, 200),
      description: str(e.description, 1500),
      url: str(e.url, 300),
    })),
  };
}
