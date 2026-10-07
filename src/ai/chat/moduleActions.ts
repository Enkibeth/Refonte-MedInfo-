/**
 * Cartes d'action du chat (2026-10, ADR-0044) — le chat comme POINT D'ENTRÉE des modules.
 *
 * Le modèle ne lance AUCUN outil. Dans la même et unique réponse (ADR-0037 : un appel LLM,
 * aucune boucle), il peut écrire une ligne-marqueur invisible :
 *
 *   <!--OUTIL:ecos|Cardiologie-->
 *
 * que l'interface transforme en carte « Ouvrir l'outil ». Rien ne s'exécute sans clic, et
 * l'outil ouvert fait son propre travail (calcul déterministe, simulation, éditeur…) : la
 * carte ne transporte qu'un paramètre court (spécialité, nom de score, sujet), jamais une
 * donnée de patient ni un résultat.
 *
 * Cloisonnement : la liste des outils proposés au modèle est dérivée de la persona VÉRIFIÉE
 * côté serveur (`moduleActionToolsFor`), et le client re-filtre chaque carte avec la même
 * règle de visibilité — un marqueur hors périmètre n'affiche rien. Le masquage n'est jamais
 * l'unique barrière : chaque écran d'outil garde son RoleGate et ses routes leur garde serveur.
 *
 * ⚠️ Module PUR (server-safe), sans dépendance réseau ni React. Tests :
 * tests/unit/chat-module-actions.test.ts.
 */
import type { Persona } from '@/ai/prompts/_schema';
import {
  APP_FEATURES,
  isFeatureVisible,
  type AppFeatureIcon,
  type AppFeatureId,
} from '@/ai/routing/featureVisibility';

/** Outils ouvrables depuis le chat (toutes les fonctionnalités sauf le chat lui-même). */
export type ModuleActionTool = Exclude<AppFeatureId, 'chat'>;

/** Nature du paramètre unique qu'un outil accepte (ou aucun). */
export type ModuleActionParamKind = 'none' | 'specialty' | 'score' | 'topic';

export interface ChatModuleAction {
  tool: ModuleActionTool;
  /** Paramètre court, nettoyé et borné ; null si l'outil n'en prend pas ou s'il est vide. */
  param: string | null;
}

interface ModuleActionSpec {
  tool: ModuleActionTool;
  param: ModuleActionParamKind;
  /** Consigne au modèle (une ligne, envoyée dans le system prompt). */
  promptHint: string;
  /** Titre de la carte (le paramètre, s'il existe, le précise). */
  title: (param: string | null) => string;
  /** Une phrase sous le titre : ce que l'outil fait de plus qu'une réponse texte. */
  description: string;
}

/** Longueur maximale d'un paramètre (un sujet, un nom de score, une spécialité). */
export const MODULE_ACTION_PARAM_MAX = 120;
/** Cartes conservées au plus par réponse (le prompt en demande 2 au maximum). */
export const MODULE_ACTIONS_MAX = 3;

const NBSP = ' ';

/**
 * Registre des cartes. L'ordre est celui de la consigne envoyée au modèle. Les textes de
 * carte sont NEUTRES (ni « tu » ni « vous ») : une même carte apparaît dans le chat étudiant
 * (tutoiement) et dans les chats grand public et pro (vouvoiement). Titres à la première
 * personne (« mes partiels »), la voix de l'utilisateur, valable partout.
 */
const SPECS: ModuleActionSpec[] = [
  {
    tool: 'partiel',
    param: 'none',
    promptHint:
      "analyser des résultats de partiels (rang, moyenne pondérée, simulateur). Les notes restent sur l'appareil de l'utilisateur : ne demande JAMAIS de coller les notes d'une promotion dans la conversation, propose cet outil (ou de joindre le fichier, qui lui sera transmis sans passer par toi).",
    title: () => 'Analyser mes partiels',
    description: "Rang, moyenne pondérée et simulateur. Les notes restent sur l’appareil.",
  },
  {
    tool: 'ecos',
    param: 'specialty',
    promptHint:
      "s'entraîner sur une station ECOS (patient simulé puis évaluation notée). Paramètre : la spécialité ou le thème (ex. Cardiologie).",
    title: (p) => (p ? `Station ECOS${NBSP}: ${p}` : "S’entraîner sur une station ECOS"),
    description: 'Patient simulé, puis évaluation notée sur 20.',
  },
  {
    tool: 'scores',
    param: 'score',
    promptHint:
      "calculer un score clinique avec un calculateur déterministe (critères figés, sans IA). Paramètre : le nom du score (ex. CHA2DS2-VASc). Quand on te demande quel score utiliser, nomme-le dès la première phrase. Si ta réponse contient déjà une ligne <!--CALC:…-->, n'ajoute pas cette carte.",
    title: (p) => (p ? `Calculer${NBSP}: ${p}` : 'Calculer un score clinique'),
    description: 'Calculateur déterministe, sans IA\u00a0: critères figés et interprétation immédiate.',
  },
  {
    tool: 'revision',
    param: 'none',
    promptHint: 'construire un planning de révisions réaliste jusqu’à un examen.',
    title: () => 'Planifier mes révisions',
    description: "Charge quotidienne réaliste jusqu’à l’examen, suivi et jauge de risque.",
  },
  {
    tool: 'presentation',
    param: 'topic',
    promptHint:
      'créer une présentation (diapositives, export PPTX). Paramètre : le sujet en une ligne.',
    title: (p) => (p ? `Présentation${NBSP}: ${p}` : 'Créer une présentation'),
    description: 'Sujet pré-rempli dans le mode IA, génération au clic. Export PPTX.',
  },
  {
    tool: 'article',
    param: 'none',
    promptHint: 'rédiger un article, un abstract, un cas clinique, une revue ou une thèse.',
    title: () => 'Rédiger mon article',
    description: 'Plan IMRaD, compteurs, bibliographie Vancouver et aides à la rédaction.',
  },
  {
    tool: 'cv-builder',
    param: 'none',
    promptHint:
      "créer, importer (PDF ou Word) et relire un CV médical, puis l'exporter en PDF. Propose cet outil plutôt que de demander de coller ou d'envoyer le CV dans la conversation (données personnelles).",
    title: () => 'Construire mon CV',
    description: 'Éditeur, aperçu A4, relecture et export PDF lisible par les logiciels de tri.',
  },
  {
    tool: 'document',
    param: 'none',
    promptHint:
      "faire expliquer en langage clair un document médical que l'utilisateur possède (compte rendu, ordonnance, résultats).",
    title: () => 'Analyser un document',
    description: "Résumé en langage clair d’un compte rendu ou d’une ordonnance.",
  },
  {
    tool: 'audio',
    param: 'none',
    promptHint: "produire le compte rendu structuré d'une consultation dictée.",
    title: () => 'Compte rendu de consultation',
    description: 'Dictée de la consultation, puis compte rendu structuré.',
  },
];

const SPEC_BY_TOOL = new Map<ModuleActionTool, ModuleActionSpec>(SPECS.map((s) => [s.tool, s]));

/** Identifiants d'outils ouvrables depuis le chat, dans l'ordre du registre. */
export const MODULE_ACTION_TOOLS: ModuleActionTool[] = SPECS.map((s) => s.tool);

export function isModuleActionTool(value: unknown): value is ModuleActionTool {
  return typeof value === 'string' && SPEC_BY_TOOL.has(value as ModuleActionTool);
}

// ── Marqueur ──────────────────────────────────────────────────────────────────

/**
 * Ouverture et fermeture d'un commentaire d'interface, TOLÉRANTES : un modèle « corrige »
 * parfois la typographie (`<!—`, `—>`, `–>`, `→`). Un marqueur déformé doit rester un
 * marqueur, jamais du texte affiché.
 */
const OPEN = '<!(?:--|—|–|-)';
const CLOSE = '(?:--|—|–|-)?\\s*(?:>|→|⟶)';
/** Marqueur complet sur sa ligne : `<!--OUTIL:id-->` ou `<!--OUTIL:id|paramètre-->`. */
const MARKER_RE = new RegExp(`^\\s*${OPEN}\\s*OUTIL\\s*:\\s*([a-z]+(?:-[a-z]+)*)\\s*(?:\\|([^<>→⟶]*?))?\\s*${CLOSE}\\s*$`, 'i');
/** Début d'un marqueur (streaming : la ligne est retenue jusqu'à sa fermeture). */
export const MODULE_ACTION_MARKER_START = new RegExp(`^${OPEN}\\s*OUTIL\\s*:`, 'i');
/** Fin d'un marqueur (ou de tout commentaire d'interface) en fin de ligne. */
const MARKER_END_RE = new RegExp(`${CLOSE}\\s*$`);
/** Commentaire d'interface complet, n'importe où dans un texte. */
const INTERFACE_COMMENT_RE = new RegExp(`${OPEN}[\\s\\S]*?${CLOSE}`, 'g');
/** Marqueur d'outil complet glissé dans une ligne. */
const INLINE_MARKER_RE = new RegExp(`[^\\S\\n]*(${OPEN}\\s*OUTIL\\s*:[^<>\\n→⟶]*?${CLOSE})[^\\S\\n]*`, 'gi');

/** Nettoie un paramètre : une ligne, sans balisage, borné. Vide → null. */
export function cleanModuleActionParam(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>`*_#[\]{}|→⟶]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-—–]+$/, '')
    .trim()
    .slice(0, MODULE_ACTION_PARAM_MAX)
    .trim();
  return text || null;
}

/**
 * Lit une ligne-marqueur. Renvoie l'action, ou null si la ligne n'en est pas une ou si
 * l'outil est inconnu. Le paramètre d'un outil qui n'en prend pas est ignoré.
 */
export function parseModuleActionMarker(line: string): ChatModuleAction | null {
  const match = line.match(MARKER_RE);
  if (!match) return null;
  const tool = match[1].toLowerCase();
  if (!isModuleActionTool(tool)) return null;
  const spec = SPEC_BY_TOOL.get(tool)!;
  return { tool, param: spec.param === 'none' ? null : cleanModuleActionParam(match[2]) };
}

/** La ligne est-elle un marqueur d'outil (valide ou non) ? Un marqueur n'est jamais du contenu. */
export function isModuleActionMarkerLine(line: string): boolean {
  return MODULE_ACTION_MARKER_START.test(line.trim()) && MARKER_END_RE.test(line);
}

/**
 * Place chaque marqueur glissé en milieu de ligne (« Ouvre l'outil <!--OUTIL:ecos--> ») sur
 * sa propre ligne, pour que le parseur en fasse une carte. Le texte qui l'entoure est conservé.
 */
export function isolateModuleActionMarkers(text: string): string {
  return text.replace(INLINE_MARKER_RE, (match, marker: string, offset: number, all: string) => {
    const before = offset > 0 && all[offset - 1] !== '\n' ? '\n' : '';
    const end = offset + match.length;
    const after = end < all.length && all[end] !== '\n' ? '\n' : '';
    return `${before}${marker}${after}`;
  });
}

/** Retire tout commentaire HTML d'un markdown affiché (un marqueur n'est jamais du contenu). */
export function stripInterfaceComments(markdown: string): string {
  return markdown.replace(INTERFACE_COMMENT_RE, '');
}

/** Ajoute des actions à une liste existante : dédoublonnées (outil + paramètre), bornées. */
export function mergeModuleActions(
  current: ChatModuleAction[],
  incoming: ChatModuleAction[],
): ChatModuleAction[] {
  const out = [...current];
  for (const action of incoming) {
    if (out.length >= MODULE_ACTIONS_MAX) break;
    const key = `${action.tool}|${(action.param ?? '').toLowerCase()}`;
    if (out.some((a) => `${a.tool}|${(a.param ?? '').toLowerCase()}` === key)) continue;
    out.push(action);
  }
  return out;
}

/**
 * Cartes proposées dans une réponse, par outil (instrumentation, ADR-0044) : clés
 * `carte:<outil>`, rangées avec les décomptes d'outils de `ai_interactions.tool_calls`.
 * Des NOMS seulement, jamais le paramètre ni le texte ; un outil inconnu n'est pas compté.
 */
export function moduleActionCounts(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const line of isolateModuleActionMarkers(text).split('\n')) {
    const action = parseModuleActionMarker(line);
    if (!action) continue;
    const key = `${action.tool}|${(action.param ?? '').toLowerCase()}`;
    if (seen.has(key) || seen.size >= MODULE_ACTIONS_MAX) continue;
    seen.add(key);
    counts[`carte:${action.tool}`] = (counts[`carte:${action.tool}`] ?? 0) + 1;
  }
  return counts;
}

// ── Capacités du client (anti-décalage de versions) ──────────────────────────

/**
 * Capacités que l'écran du chat déclare dans le body de /api/chat. Un onglet chargé AVANT un
 * déploiement exécute l'ancien code : il ne sait pas afficher les cartes et montrerait les
 * marqueurs en clair (constaté sur iPhone, 2026-10). Le serveur n'envoie donc la consigne des
 * cartes qu'à un client qui la déclare : un ancien onglet n'en reçoit simplement aucune.
 */
export type ClientCapability = 'module-actions';
const CLIENT_CAPABILITIES: ClientCapability[] = ['module-actions'];

/** Capacités déclarées par le client, bornées aux valeurs connues (jamais un droit). */
export function coerceClientCapabilities(value: unknown): ClientCapability[] {
  if (!Array.isArray(value)) return [];
  return CLIENT_CAPABILITIES.filter((c) => value.includes(c));
}

// ── Cloisonnement ─────────────────────────────────────────────────────────────

export interface ModuleActionAudience {
  /** Persona VÉRIFIÉE (serveur) ou persona du profil (client). */
  persona: Persona | null | undefined;
  isAdmin?: boolean;
  /** Visiteur non connecté : aucune carte (il ne voit que le chat). */
  isGuest?: boolean;
}

/** Outils que cette audience peut ouvrir depuis le chat (même règle que la navigation). */
export function moduleActionToolsFor(audience: ModuleActionAudience): ModuleActionTool[] {
  if (audience.isGuest) return [];
  return MODULE_ACTION_TOOLS.filter((tool) =>
    isFeatureVisible(tool, audience.persona, { isAdmin: audience.isAdmin }),
  );
}

/**
 * Outils à proposer au modèle pour UNE requête de /api/chat : rien si le client ne déclare
 * pas savoir afficher les cartes (onglet resté sur un ancien code), sinon les outils de la
 * persona VÉRIFIÉE (jamais du body) ; un appel anonyme n'en reçoit aucun.
 */
export function moduleToolsForRequest(input: {
  capabilities: unknown;
  persona: Persona | null;
  isAdmin: boolean;
  verified: boolean;
}): ModuleActionTool[] {
  if (!coerceClientCapabilities(input.capabilities).includes('module-actions')) return [];
  return moduleActionToolsFor({ persona: input.persona, isAdmin: input.isAdmin, isGuest: !input.verified });
}

// ── Consigne au modèle ────────────────────────────────────────────────────────

/**
 * Section ajoutée au system prompt : les outils que CET utilisateur peut ouvrir, et quand
 * en proposer un. Vide si aucun outil (visiteur, liste vide) : rien n'est demandé au modèle.
 */
export function buildModuleActionsSection(tools: ModuleActionTool[]): string {
  const specs = SPECS.filter((s) => tools.includes(s.tool));
  if (specs.length === 0) return '';
  const lines = specs.map((s) => `- ${s.tool} : ${s.promptHint}`);
  return (
    `\n\nOUTILS MEDINFO (cartes d'action)\n` +
    `L'utilisateur dispose dans MedInfo des outils ci-dessous. Quand sa demande porte sur une TÂCHE ` +
    `qu'un outil réalise mieux qu'une réponse écrite (il veut le faire, pas seulement comprendre une ` +
    `notion), propose de l'ouvrir en écrivant, sur une ligne seule, à la fin du corps de ta réponse ` +
    `(juste avant SOURCES ou les propositions s'il y en a) :\n` +
    `<!--OUTIL:identifiant-->  ou, si l'outil prend un paramètre :  <!--OUTIL:identifiant|paramètre-->\n` +
    `L'interface en fait une carte cliquable ; la ligne elle-même n'est jamais affichée.\n` +
    `Outils disponibles :\n${lines.join('\n')}\n` +
    `Règles : au plus 2 lignes OUTIL par réponse ; aucune pour une simple question de connaissances ; ` +
    `réponds toujours à la demande (brièvement si elle porte seulement sur l'outil), la carte complète ` +
    `ta réponse sans la remplacer ; n'écris jamais que tu as ouvert ou exécuté un outil ni un résultat ` +
    `qu'il aurait produit : l'utilisateur décide de l'ouvrir ; le paramètre ne contient jamais de donnée ` +
    `personnelle, de nom ni de valeur de patient ; n'utilise que les identifiants listés.\n` +
    `Résultats transmis par un outil : quand le message reprend des chiffres calculés par un outil ` +
    `MedInfo (résultats de partiels, évaluation d'une station ECOS), appuie-toi sur eux sans les ` +
    `recalculer ni en inventer d'autres, et propose s'il y a lieu l'outil de l'étape suivante (par ` +
    `exemple le planning de révisions après un plan d'action).`
  );
}

// ── Scores suggérés par le chatbot pro (<!--CALC:…-->) ───────────────────────

/**
 * Identifiants du marqueur CALC (prompt professionnel) → identifiant du score dans le
 * calculateur déterministe (src/scores). Les scores absents du catalogue (GRACE, PSI,
 * Apgar…) n'ont pas d'entrée : leur puce reste sans lien vers l'outil.
 */
const CALC_TO_SCORE_ID: Record<string, string> = {
  chads: 'cha2ds2-vasc',
  hasbled: 'has-bled',
  timi: 'timi-nstemi',
  rcri: 'rcri',
  heart: 'heart',
  wells: 'wells-ep',
  wellstvp: 'wells-tvp',
  pesi: 'pesi',
  curb65: 'curb-65',
  geneva: 'geneve-ep',
  news2: 'news2',
  qsofa: 'qsofa',
  sofa: 'sofa',
  glasgow: 'glasgow',
  nihss: 'nihss',
  abcd2: 'abcd2',
  mrs: 'rankin',
  gbs: 'blatchford',
  childpugh: 'child-pugh',
  meld: 'meld',
  centor: 'centor-mcisaac',
};

/** Score du calculateur correspondant à un identifiant CALC, ou null. */
export function scoreIdForCalc(calcId: string): string | null {
  return CALC_TO_SCORE_ID[calcId.trim().toLowerCase()] ?? null;
}

// ── Carte (rendu client) ──────────────────────────────────────────────────────

export interface ModuleActionCard {
  tool: ModuleActionTool;
  title: string;
  description: string;
  icon: AppFeatureIcon;
  /** Route Expo Router de l'outil. */
  route: string;
  param: string | null;
  paramKind: ModuleActionParamKind;
}

/** Contenu affiché d'une carte. */
export function moduleActionCard(action: ChatModuleAction): ModuleActionCard {
  const spec = SPEC_BY_TOOL.get(action.tool)!;
  const meta = APP_FEATURES.find((f) => f.id === action.tool)!;
  return {
    tool: action.tool,
    title: spec.title(action.param),
    description: spec.description,
    icon: meta.icon,
    route: meta.route,
    param: action.param,
    paramKind: spec.param,
  };
}
