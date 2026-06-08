/**
 * Design system MedInfo AI — « Brutalisme structuré » (refonte 2026-06).
 *
 * Parti pris assumé, anti-template : grille visible, filets noirs francs, blocs
 * bordés, aplats de couleur, ombres DURES décalées (jamais de flou), zéro arrondi,
 * gros titres serrés, micro-labels en mono. On évite délibérément toute la
 * signature « SaaS généré par IA » (halos, dégradés, cartes flottantes molles).
 *
 * Règle : aucune valeur hex/typo en dur dans les composants — tout passe par ce fichier.
 */
import { Platform } from 'react-native';

// ── Rampe brute (ne pas consommer directement : passer par `tokens.colors`) ──
const palette = {
  // Encre — quasi-noir chaud. Texte, bordures, ombres dures : l'ossature du système.
  ink: '#16140E',
  inkSoft: '#3A362C', // texte secondaire
  inkMute: '#6E695B', // captions / métadonnées
  inkFaint: '#9A9486',

  // Papier — fonds « newsprint » chauds, pas de blanc générique d'écran.
  paper: '#EBE7DC', // fond d'app
  paperAlt: '#E1DCCC', // sections alternées (plus dense)
  surface: '#FAF8F2', // boîtes / cartes (légèrement plus clair que le papier)
  surfacePure: '#FFFFFF',

  // Petrol — accent de marque conservé, mais en APLAT franc (jamais de dégradé).
  petrol700: '#0A4D68', // accent primaire
  petrol600: '#0C5C7E',
  petrol500: '#127193',
  petrol800: '#083B52',
  petrol100: '#CFE2EA',
  petrol50: '#E4EEF2',

  white: '#FFFFFF',

  // Sémantiques — aplats francs (le brutalisme n'a pas peur de la couleur pleine).
  green: '#12603C',
  greenSoft: '#CFE6D7',
  red: '#B81F2D',
  redSoft: '#F3D2D5',
  amber: '#B5740E',
  amberSoft: '#F4E2BE',

  // Accents par audience — utilisés en BLOCS pleins (cartes persona), pas en pastille molle.
  proAccent: '#A84B12', // ambre brûlé — professionnels
  proSoft: '#F1DCC4',
  studentAccent: '#3F6212', // olive — étudiants
  studentSoft: '#DCE8BE',
  publicAccent: '#A21456', // framboise — grand public
  publicSoft: '#F2CFDF',
} as const;

export const tokens = {
  colors: {
    // Surfaces
    background: palette.paper,
    surface: palette.surface,
    surfaceAlt: palette.paperAlt,
    surfaceSunken: palette.paperAlt,
    surfacePure: palette.surfacePure,

    // Bordures = encre franche (le « trait » est l'élément central du système).
    border: palette.ink,
    borderStrong: palette.ink,
    borderSoft: palette.inkFaint, // filet discret là où le noir plein serait trop lourd

    // Texte
    text: palette.ink,
    textMuted: palette.inkMute,
    textSubtle: palette.inkSoft,
    onAccent: palette.white, // texte sur aplat petrol/encre
    onInk: palette.paper, // texte papier sur fond encre

    // Accent petrol
    accent: palette.petrol700,
    accentStrong: palette.petrol600,
    accentDeep: palette.petrol800,
    accentDarker: palette.ink, // fond hero = ENCRE pleine, pas un dégradé
    accentSurface: palette.petrol50,
    accentSurfaceStrong: palette.petrol100,

    // États
    success: palette.green,
    successBackground: palette.greenSoft,
    danger: palette.red,
    dangerBackground: palette.redSoft,
    warningText: palette.amber,
    warningBackground: palette.amberSoft,

    // États d'interaction (web)
    surfaceHover: palette.paperAlt,
    accentSurfaceHover: palette.petrol100,

    // Aplats de marque / hero
    ink: palette.ink,
    paperOnInk: palette.paper,

    // ── Accents par audience (persona) ───────────────────────────────────────
    personas: {
      pro: { accent: palette.proAccent, soft: palette.proSoft },
      student: { accent: palette.studentAccent, soft: palette.studentSoft },
      public: { accent: palette.publicAccent, soft: palette.publicSoft },
    },
  },

  // ── Typographie ────────────────────────────────────────────────────────────
  // Inter (corps), DM Sans (titres display), JetBrains Mono (labels/index/méta).
  font: {
    sans: Platform.select({
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      default: 'System',
    }) as string,
    display: Platform.select({
      web: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      default: 'System',
    }) as string,
    mono: Platform.select({
      web: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      default: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    }) as string,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  // Échelle à fort contraste. `hero`/`display` : interlignage serré (≈ taille) =
  // titres « empilés » massifs, signature brutaliste. Tracking très négatif.
  type: {
    hero: { fontSize: 52, lineHeight: 52, letterSpacing: -2 },
    display: { fontSize: 36, lineHeight: 38, letterSpacing: -1.2 },
    h1: { fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
    h2: { fontSize: 22, lineHeight: 27, letterSpacing: -0.5 },
    h3: { fontSize: 18, lineHeight: 24, letterSpacing: -0.3 },
    bodyLg: { fontSize: 17, lineHeight: 27, letterSpacing: 0 },
    body: { fontSize: 15, lineHeight: 24, letterSpacing: 0 },
    label: { fontSize: 14, lineHeight: 20, letterSpacing: 0 },
    caption: { fontSize: 12.5, lineHeight: 18, letterSpacing: 0.1 },
    // Micro-label monospace UPPERCASE : eyebrows, index « 01 », métadonnées.
    mono: { fontSize: 12, lineHeight: 16, letterSpacing: 1.6 },
    monoSm: { fontSize: 10.5, lineHeight: 14, letterSpacing: 1.4 },
  },

  // ── Espacement (base 4) ──────────────────────────────────────────────────────
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
    '5xl': 96,
  },

  // ── Rayons — BRUTALISME : tout est à angle vif. `pill` réservé aux vrais ronds. ──
  radius: {
    none: 0,
    xs: 0,
    sm: 0,
    md: 0,
    lg: 0,
    xl: 0,
    '2xl': 0,
    pill: 999,
  },

  // ── Épaisseurs de trait (le filet structure tout) ───────────────────────────
  border: {
    hairline: 1,
    regular: 1.5,
    bold: 2,
    heavy: 3,
  },

  // ── Tailles de contrôle ──────────────────────────────────────────────────────
  size: {
    controlMd: 44,
    controlLg: 54,
    iconButton: 40,
  },

  // ── Élévation — ombres DURES décalées (solides, sans flou). Signature brutaliste.
  // `sm` = plat (bordure seule) ; md/lg/xl = bloc décalé encre. Web only.
  elevation: {
    sm: Platform.select({ web: {}, default: {} }) as object,
    md: Platform.select({
      web: { boxShadow: '3px 3px 0 0 #16140E' },
      default: {},
    }) as object,
    lg: Platform.select({
      web: { boxShadow: '5px 5px 0 0 #16140E' },
      default: {},
    }) as object,
    xl: Platform.select({
      web: { boxShadow: '8px 8px 0 0 #16140E' },
      default: {},
    }) as object,
    // Ombre dure colorée (accent petrol) pour les éléments mis en avant.
    accent: Platform.select({
      web: { boxShadow: '5px 5px 0 0 #0A4D68' },
      default: {},
    }) as object,
  },

  // ── Focus (accessibilité web) — anneau net, sans flou, cohérent brutaliste. ──
  focus: {
    ring: Platform.select({
      web: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: '#0A4D68', outlineOffset: 2 },
      default: {},
    }) as object,
  },

  // ── Mouvement — net et direct. Décalage dur sur hover (l'élément « se pose »).
  motion: {
    duration: { fast: 110, base: 170, slow: 260 },
    transitionWeb: Platform.select({
      web: {
        transitionProperty: 'background-color, border-color, box-shadow, transform, opacity',
        transitionDuration: '120ms',
        transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      default: {},
    }) as object,
    easing: {
      standard: [0.2, 0, 0, 1] as const,
      out: [0.16, 1, 0.3, 1] as const,
    },
    revealOffset: 10,
    revealStagger: 60,
  },
} as const;
