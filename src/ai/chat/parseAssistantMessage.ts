/**
 * Parseur des réponses des 3 chatbots (refonte 2026-06).
 *
 * Les prompts produit (public.v3 / student.v3 / professional.v2) imposent des formats
 * texte structurés que l'interface transforme en éléments interactifs :
 *   - SOURCES            → cartes cliquables `SRCn :: [BADGE] … :: … :: Titre :: Année` + URL + Justification ;
 *   - APPROFONDISSEMENTS → 3 boutons `n. TITRE :: Description :: Question complète` ;
 *   - QUESTIONS_PATIENT  → formulaire de 3 questions à choix multiples ;
 *   - INTERACTION        → boutons d'action `[Option]` (public) ou `Question ? [A]+[B]+[C]` (pro) ;
 *   - AUTO-RÉFLEXION     → carte repliable de fin de réponse ;
 *   - <!--CALC:ids-->    → puces de scores cliniques suggérés ;
 *   - étudiant           → 3 questions numérotées + ligne `[1] + [2] + [3]` → 3 boutons.
 *
 * Module PUR (aucune dépendance UI/réseau) : testé dans tests/unit/parse-assistant-message.test.ts.
 * Tolérant au streaming : un texte partiel produit simplement des blocs partiels.
 */

export type SourceBadge = 'OFFICIEL' | 'GUIDELINE' | 'ÉTUDE' | 'RCP';

export interface EvidenceLevel {
  /** Libellé court affiché dans la pastille de la modale. */
  label: string;
  /** Explication en une phrase, adaptée au grand public. */
  description: string;
}

/** Niveau de preuve associé à un badge de source (pour la modale de détail). */
export function evidenceLevelFor(badge: SourceBadge | null): EvidenceLevel {
  switch (badge) {
    case 'OFFICIEL':
      return {
        label: 'Source officielle',
        description:
          "Recommandation d'une autorité de santé (HAS, ANSM, OMS…). Niveau de confiance élevé.",
      };
    case 'GUIDELINE':
      return {
        label: 'Recommandation de société savante',
        description:
          "Recommandation d'experts d'une spécialité (ESC, NICE, EULAR…). Niveau de confiance élevé.",
      };
    case 'ÉTUDE':
      return {
        label: 'Étude scientifique',
        description:
          'Essai clinique, méta-analyse ou revue systématique publiée. Niveau de preuve variable selon le type.',
      };
    case 'RCP':
      return {
        label: 'Notice / RCP officielle',
        description:
          "Résumé des caractéristiques du produit ou fiche médicament officielle (ANSM, EMA, FDA).",
      };
    default:
      return {
        label: 'Référence citée',
        description: 'Référence fournie à l\'appui de la réponse.',
      };
  }
}

export interface ParsedSource {
  id: string; // SRC1…SRC6
  badge: SourceBadge | null;
  /** Libellé court (ex. « HAS », « ESC AF 2024 », « Auteurs, Journal »). */
  shortLabel: string | null;
  /** Organisme ou auteurs. */
  org: string | null;
  /** Titre (reformulé patient ou titre guideline). */
  title: string | null;
  year: string | null;
  url: string | null;
  justification: string | null;
}

export interface DeepeningItem {
  title: string;
  description: string;
  question: string;
}

export interface PatientQuestion {
  text: string;
  options: string[];
}

export interface InteractionGroup {
  /** Question d'accroche (format pro) — null pour les boutons simples (format public). */
  question: string | null;
  options: string[];
}

export type ParsedBlock =
  | { type: 'body'; markdown: string }
  | { type: 'sources'; sources: ParsedSource[] }
  | { type: 'deepening'; items: DeepeningItem[] }
  | { type: 'questionsPatient'; questions: PatientQuestion[] }
  | { type: 'interaction'; groups: InteractionGroup[] }
  | { type: 'reflection'; markdown: string }
  | { type: 'calc'; ids: string[] }
  | { type: 'followups'; questions: string[] };

export interface ParsedAssistantMessage {
  blocks: ParsedBlock[];
  /** Toutes les sources de la réponse (pour l'onglet Sources global). */
  sources: ParsedSource[];
}

// ── Détection des sections ────────────────────────────────────────────────────

type SectionKind = 'sources' | 'deepening' | 'questionsPatient' | 'interaction' | 'reflection';

function sectionKindOf(line: string): SectionKind | null {
  const t = line.trim();
  if (/^SOURCES$/.test(t)) return 'sources';
  if (/^APPROFONDISSEMENTS$/.test(t)) return 'deepening';
  if (/^QUESTIONS_PATIENT$/.test(t)) return 'questionsPatient';
  if (/^INTERACTION$/.test(t)) return 'interaction';
  if (/^AUTO[-\s]?R[ÉE]FLEXION$/.test(t)) return 'reflection';
  return null;
}

/** Ligne titre de section MAJUSCULES (format public/pro) — utilisée pour borner les sections. */
export function isUppercaseHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80) return false;
  if (!/[A-ZÀ-ÖØ-Þ]/.test(t)) return false;
  if (/[a-zà-öø-ÿ]/.test(t)) return false;
  // Lettres majuscules, chiffres, espaces et ponctuation légère uniquement.
  return /^[A-ZÀ-ÖØ-Þ0-9\s'’\-—–:,.()&/!?%]+$/.test(t);
}

const CALC_RE = /<!--\s*CALC:([a-z0-9_,\s]+)\s*-->/i;
const SRC_LINE_RE = /^SRC(\d+)\s*::\s*(.+)$/;
const BADGE_RE = /^\[(OFFICIEL|GUIDELINE|ÉTUDE|ETUDE|RCP)\]\s*/i;
const URL_RE = /^https?:\/\/\S+$/;
const JUSTIF_RE = /^Justification\s*:\s*(.*)$/i;
const BRACKET_OPTION_RE = /^\[([^\][]+)\]$/;
const NUMBERED_RE = /^(\d+)[.)]\s+(.+)$/;
const STUDENT_FOLLOWUP_MARKER_RE = /^\[1\]\s*\+\s*\[2\]\s*\+\s*\[3\]$/;

function normalizeBadge(raw: string): SourceBadge {
  const up = raw.toUpperCase();
  if (up === 'ETUDE' || up === 'ÉTUDE') return 'ÉTUDE';
  return up as SourceBadge;
}

// ── Parseurs de sections ──────────────────────────────────────────────────────

function parseSourcesLines(lines: string[]): ParsedSource[] {
  const sources: ParsedSource[] = [];
  let current: ParsedSource | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const srcMatch = line.match(SRC_LINE_RE);
    if (srcMatch) {
      if (current) sources.push(current);
      const fields = srcMatch[2].split('::').map((f) => f.trim());
      let badge: SourceBadge | null = null;
      let first = fields[0] ?? '';
      const badgeMatch = first.match(BADGE_RE);
      if (badgeMatch) {
        badge = normalizeBadge(badgeMatch[1]);
        first = first.replace(BADGE_RE, '').trim();
      }
      current = {
        id: `SRC${srcMatch[1]}`,
        badge,
        shortLabel: first || null,
        org: fields[1] ?? null,
        title: fields[2] ?? null,
        year: fields[3] ?? null,
        url: null,
        justification: null,
      };
      continue;
    }
    if (!current) continue;
    if (URL_RE.test(line)) {
      current.url = line;
      continue;
    }
    const justif = line.match(JUSTIF_RE);
    if (justif) {
      current.justification = justif[1] || null;
      continue;
    }
  }
  if (current) sources.push(current);
  return sources;
}

function parseDeepeningLines(lines: string[]): DeepeningItem[] {
  const items: DeepeningItem[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(NUMBERED_RE);
    if (!m) continue;
    const parts = m[2].split('::').map((p) => p.trim());
    if (parts.length >= 3) {
      items.push({ title: parts[0], description: parts[1], question: parts.slice(2).join(' — ') });
    } else if (parts.length === 2) {
      items.push({ title: parts[0], description: '', question: parts[1] });
    } else if (parts[0]) {
      items.push({ title: parts[0], description: '', question: parts[0] });
    }
  }
  return items;
}

function parsePatientQuestionLines(lines: string[]): PatientQuestion[] {
  const questions: PatientQuestion[] = [];
  let current: PatientQuestion | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const q = line.match(/^Q\d+\s*:\s*(.+)$/);
    if (q) {
      if (current) questions.push(current);
      current = { text: q[1].trim(), options: [] };
      continue;
    }
    const opt = line.match(/^[-•]\s+(.+)$/);
    if (opt && current) {
      current.options.push(opt[1].trim());
    }
  }
  if (current) questions.push(current);
  return questions;
}

function parseInteractionLines(lines: string[]): InteractionGroup[] {
  const groups: InteractionGroup[] = [];
  let simple: InteractionGroup | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Format pro : « 1. Question clinique utile ? » puis « [A]+[B]+[C] ».
    const numbered = line.match(NUMBERED_RE);
    if (numbered) {
      groups.push({ question: numbered[2].trim(), options: [] });
      continue;
    }
    if (line.includes(']+[') || /^\[.+\]\s*\+/.test(line)) {
      const options = [...line.matchAll(/\[([^\][]+)\]/g)].map((m) => m[1].trim());
      const last = groups[groups.length - 1];
      if (last && last.options.length === 0) {
        last.options = options;
      } else if (options.length > 0) {
        groups.push({ question: null, options });
      }
      continue;
    }
    // Format public : « [Option] » seule sur sa ligne.
    const single = line.match(BRACKET_OPTION_RE);
    if (single) {
      if (!simple) {
        simple = { question: null, options: [] };
        groups.push(simple);
      }
      simple.options.push(single[1].trim());
    }
  }
  return groups.filter((g) => g.options.length > 0 || g.question);
}

// ── Boutons d'approfondissement étudiants ([1] + [2] + [3]) ──────────────────

/**
 * Détecte le motif étudiant : 3 questions numérotées suivies de la ligne `[1] + [2] + [3]`.
 * Retourne les lignes du corps sans ce motif + le bloc followups, ou null si absent.
 */
function extractStudentFollowups(lines: string[]): { lines: string[]; questions: string[] } | null {
  const markerIdx = lines.findIndex((l) => STUDENT_FOLLOWUP_MARKER_RE.test(l.trim()));
  if (markerIdx < 0) return null;

  // Remonte pour trouver les questions numérotées (1., 2., 3.) juste au-dessus du marqueur.
  const questions: { idx: number; text: string }[] = [];
  for (let i = markerIdx - 1; i >= 0 && questions.length < 3; i--) {
    const t = lines[i].trim();
    if (!t) continue;
    const m = t.match(NUMBERED_RE);
    if (m) {
      questions.unshift({ idx: i, text: m[2].trim() });
    } else if (questions.length > 0) {
      break;
    } else {
      // Texte d'intro entre les questions et le marqueur : on continue à remonter un peu.
      if (markerIdx - i > 6) break;
    }
  }
  if (questions.length === 0) return null;

  const removeIdx = new Set([markerIdx, ...questions.map((q) => q.idx)]);
  return {
    lines: lines.filter((_, i) => !removeIdx.has(i)),
    questions: questions.map((q) => q.text),
  };
}

// ── Parseur principal ─────────────────────────────────────────────────────────

export function parseAssistantMessage(text: string): ParsedAssistantMessage {
  const blocks: ParsedBlock[] = [];
  const allSources: ParsedSource[] = [];

  const rawLines = text.replace(/\r\n/g, '\n').split('\n');

  let bodyBuffer: string[] = [];
  let section: SectionKind | null = null;
  let sectionBuffer: string[] = [];

  const flushBody = () => {
    const md = bodyBuffer.join('\n').trim();
    bodyBuffer = [];
    if (!md) return;
    blocks.push({ type: 'body', markdown: md });
  };

  const flushSection = () => {
    if (!section) return;
    const lines = sectionBuffer;
    sectionBuffer = [];
    const kind = section;
    section = null;

    if (kind === 'sources') {
      const sources = parseSourcesLines(lines);
      if (sources.length > 0) {
        allSources.push(...sources);
        blocks.push({ type: 'sources', sources });
      }
    } else if (kind === 'deepening') {
      const items = parseDeepeningLines(lines);
      if (items.length > 0) blocks.push({ type: 'deepening', items });
    } else if (kind === 'questionsPatient') {
      const questions = parsePatientQuestionLines(lines);
      if (questions.length > 0) blocks.push({ type: 'questionsPatient', questions });
    } else if (kind === 'interaction') {
      const groups = parseInteractionLines(lines);
      if (groups.length > 0) blocks.push({ type: 'interaction', groups });
    } else if (kind === 'reflection') {
      const md = lines.join('\n').trim();
      if (md) blocks.push({ type: 'reflection', markdown: md });
    }
  };

  for (const rawLine of rawLines) {
    const line = rawLine;

    // Marqueur calculateur (pro) — bloc autonome, où qu'il apparaisse.
    const calc = line.match(CALC_RE);
    if (calc) {
      flushSection();
      flushBody();
      const ids = calc[1]
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (ids.length > 0) blocks.push({ type: 'calc', ids });
      continue;
    }

    const kind = sectionKindOf(line);
    if (kind) {
      flushSection();
      flushBody();
      section = kind;
      continue;
    }

    if (section) {
      // Une section structurée se termine quand un nouveau titre MAJUSCULES apparaît
      // (ex. POINTS DE VIGILANCE après SOURCES) — il repart dans le corps.
      if (isUppercaseHeading(line) && !SRC_LINE_RE.test(line.trim())) {
        flushSection();
        bodyBuffer.push(line);
        continue;
      }
      sectionBuffer.push(line);
      continue;
    }

    bodyBuffer.push(line);
  }

  flushSection();

  // Motif étudiant [1] + [2] + [3] dans le corps restant.
  const followups = extractStudentFollowups(bodyBuffer);
  if (followups) {
    bodyBuffer = followups.lines;
    flushBody();
    blocks.push({ type: 'followups', questions: followups.questions });
  } else {
    flushBody();
  }

  return { blocks, sources: allSources };
}

// ── Références inline (SRCx) → appels de note en exposant ────────────────────

const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'] as const;

function superscriptOf(num: string): string {
  return [...num].map((d) => SUPERSCRIPT_DIGITS[Number(d)] ?? d).join('');
}

/** Regex d'un exposant complet (un seul SRCn, jamais coupé par un espace). */
export const SUPERSCRIPT_RUN_RE = /^[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/;

/** Inverse de `superscriptOf` : reconstruit l'identifiant SRCn depuis son exposant affiché. */
export function sourceIdFromSuperscript(sup: string): string | null {
  const digits = [...sup].map((c) => SUPERSCRIPT_DIGITS.indexOf(c as (typeof SUPERSCRIPT_DIGITS)[number]));
  if (digits.some((d) => d < 0)) return null;
  return `SRC${digits.join('')}`;
}

/**
 * Remplace les références inline imposées par les prompts — `(SRC1)`, `(SRC1, SRC2)`,
 * `(Classe I · SRC1)`, `SRC3` isolé — par des appels de note en exposant : ¹, ¹ ²,
 * (Classe I)¹… Les cartes de la section SOURCES restent la légende de ces numéros.
 * Les lignes de légende `SRCn :: …` (présentes dans l'export PDF, jamais dans le
 * corps rendu) gardent leur contenu mais prennent le même numéro en exposant.
 */
export function formatInlineCitations(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => {
      const legend = line.match(SRC_LINE_RE);
      if (legend) return `${superscriptOf(legend[1])} ${legend[2]}`;
      // Groupes parenthésés contenant au moins une référence SRCn.
      let out = line.replace(/([ \t]*)\(([^()]*SRC\d[^()]*)\)/g, (_full, space: string, inner: string) => {
        const sup = [...inner.matchAll(/SRC(\d+)/g)].map((m) => superscriptOf(m[1])).join(' ');
        const rest = inner
          .replace(/SRC\d+/g, '')
          .replace(/\s{2,}/g, ' ')
          .replace(/^[\s,·:;–—-]+|[\s,·:;–—-]+$/g, '')
          .trim();
        // Sans texte restant, l'appel de note se colle au mot précédent (« dysphagie.¹ ² »).
        return rest ? `${space}(${rest})${sup}` : sup;
      });
      // Références SRCn isolées hors parenthèses.
      out = out.replace(/\bSRC(\d+)\b/g, (_m, n: string) => superscriptOf(n));
      return out;
    })
    .join('\n');
}

// ── Texte propre pour Copier / export PDF ─────────────────────────────────────

/** Numéro d'une source `SRCn` en exposant (¹ ²…) pour la légende exportée. */
function superscriptOfSourceId(id: string): string {
  const digits = id.replace(/^SRC/, '');
  return superscriptOf(digits);
}

/**
 * Version « texte propre » d'une réponse assistant, partagée par le bouton Copier
 * et l'export PDF : le corps avec les références inline en exposant, la section
 * SOURCES en légende numérotée lisible (badge, libellé, année, URL), l'auto-réflexion
 * conservée sous son titre. Les blocs purement interactifs (propositions à cocher,
 * formulaire QUESTIONS_PATIENT, marqueurs CALC, relances étudiant) sont omis :
 * ce sont des affordances d'interface, pas du contenu.
 */
export function assistantTextForExport(text: string): string {
  const { blocks } = parseAssistantMessage(text);
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === 'body') {
      parts.push(formatInlineCitations(block.markdown));
    } else if (block.type === 'sources') {
      const lines = block.sources.map((s) => {
        const label = [s.shortLabel, s.org && s.org !== s.shortLabel ? s.org : null, s.title]
          .filter(Boolean)
          .join(' — ');
        const meta = [s.badge ? `[${s.badge}]` : null, label || s.id, s.year]
          .filter(Boolean)
          .join(' ');
        return `${superscriptOfSourceId(s.id)} ${meta}${s.url ? `\n   ${s.url}` : ''}`;
      });
      parts.push(`Sources\n${lines.join('\n')}`);
    } else if (block.type === 'reflection') {
      parts.push(`Auto-réflexion\n${formatInlineCitations(block.markdown)}`);
    }
    // deepening / questionsPatient / interaction / calc / followups : omis (interactifs).
  }

  return parts.join('\n\n').trim();
}

// ── Découpage du corps en sections MAJUSCULES (rendu) ─────────────────────────

export interface BodySection {
  /** Titre MAJUSCULES (null pour le contenu avant le premier titre). */
  heading: string | null;
  markdown: string;
}

/** Découpe un bloc body en sections selon les titres MAJUSCULES (format public/pro). */
export function splitBodySections(markdown: string): BodySection[] {
  const lines = markdown.split('\n');
  const sections: BodySection[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const md = buffer.join('\n').trim();
    buffer = [];
    if (heading || md) sections.push({ heading, markdown: md });
  };

  for (const line of lines) {
    // Les titres markdown (## …) restent gérés par le renderer markdown.
    if (isUppercaseHeading(line) && !line.trim().startsWith('#') && !line.trim().startsWith('|')) {
      flush();
      heading = line.trim();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections;
}
