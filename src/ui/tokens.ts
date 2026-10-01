/**
 * Design system MedInfo AI — source unique (05_DESIGN §2, §3, §4, §9).
 *
 * Direction A, septembre 2026 : blanc, encre et un accent bleu vif.
 * Hiérarchie éditoriale, contrôles contrastés et bordures fines.
 *
 * Règle : aucune valeur hex/typo en dur dans les composants — tout passe par ce fichier.
 */
import { Platform } from 'react-native';

// ── Rampe brute (ne pas consommer directement : passer par `tokens.colors`) ──
const palette = {
  // Bleu — identité de marque 2026-07 : vif et jeune, décliné pour la profondeur
  // et les fonds teintés.
  blue950: '#141E4E', // bleu nuit — hero/footer, profondeur maximale
  blue800: '#1E40AF', // profondeur, texte accent
  blue600: '#2563EB', // primaire (CTA, header)
  blue700: '#1D4ED8', // hover / actif du primaire
  blue500: '#3B82F6', // nuance secondaire
  blue100: '#D9E6FF', // fond teinté discret
  blue50: '#EEF4FF',

  // Bleu électrique — le « bleu pétant » des CTA primaires et liens d'action
  // (hérité de l'essai 2026-06, conservé et généralisé par la refonte 2026-07).
  electric600: '#0067FF',
  electric700: '#0052D6', // hover / actif

  // Neutres — slate froid légèrement teinté bleu (rafraîchi 2026-07), jamais boueux.
  white: '#FFFFFF',
  neutral25: '#FFFFFF', // Direction A : le contenu repose sur le blanc.
  neutral50: '#F6F7F9', // navigation et surfaces secondaires
  neutral100: '#EAEEF5',
  neutral200: '#D8DFE7', // séparateurs non interactifs
  neutral300: '#7D8998', // limites de contrôles : contraste > 3:1 sur blanc
  neutral500: '#526174', // texte secondaire
  neutral700: '#36435A',
  neutral900: '#142034', // encre principale

  // Sémantiques — désaturées pour rester sobres en contexte médical.
  green600: '#157F50',
  green50: '#E6F4EC',
  red600: '#C42233',
  red50: '#FBEAEC',
  amber600: '#80500C',
  amber50: '#FBF1DD',

} as const;

export const tokens = {
  colors: {
    // Surfaces
    background: palette.neutral25, // surface principale
    surface: palette.white, // cartes, panneaux surélevés
    surfaceAlt: palette.neutral50, // bulles IA, zones secondaires
    surfaceSunken: palette.neutral100, // champs, fonds enfoncés
    border: palette.neutral200,
    borderStrong: palette.neutral300,

    // Texte
    text: palette.neutral900, // ink
    textMuted: palette.neutral500, // ink-soft
    textSubtle: palette.neutral700,
    onAccent: palette.white, // texte sur fond bleu

    // Accent bleu vif (refonte 2026-07)
    accent: palette.electric700, // texte/liens et contrôles : même famille que la primaire
    accentStrong: palette.blue500, // nuance secondaire, jamais pour le texte courant
    accentDeep: palette.electric700, // texte accent sur fond clair
    accentDarker: palette.blue950, // encre de marque historique
    accentSurface: palette.blue50, // fond teinté très léger
    accentSurfaceStrong: palette.blue100,
    accentVivid: palette.electric600, // CTA primaires et liens d'action (« bleu pétant »)
    accentVividStrong: palette.electric700, // hover des CTA vifs

    // États
    success: palette.green600,
    successBackground: palette.green50,
    danger: palette.red600,
    dangerBackground: palette.red50,
    warningText: palette.amber600,
    warningBackground: palette.amber50,
    transparent: 'transparent',
    overlay: 'rgba(20,32,52,0.4)',
    onDarkMuted: 'rgba(255,255,255,0.8)',
    onDarkBorder: 'rgba(255,255,255,0.6)',
    onDarkHover: 'rgba(255,255,255,0.12)',

    // États d'interaction (web : hover/focus). Sobres, dérivés de la rampe existante.
    surfaceHover: palette.neutral50, // survol d'une surface blanche (boutons, cartes)
    accentSurfaceHover: palette.blue100, // survol d'une pastille teintée bleue

    // ── Accents par audience (persona) ───────────────────────────────────────
    // Trois publics distincts du design system : pro / étudiant / grand public.
    personas: {
      pro: { accent: palette.electric700, soft: palette.blue50 },
      student: { accent: palette.electric700, soft: palette.blue50 },
      public: { accent: palette.electric700, soft: palette.blue50 },
    },

    // ── Teintes de pastilles par outil (shell 2026-07) ───────────────────────
    // Chips colorées des cartes/listes d'outils (dashboard, panneau Outils,
    // activité récente) : fond doux + encre foncée AA. Usage strict : pastille
    // d'icône et monogramme — jamais des aplats de section entiers.
    tints: {
      blue: { fg: palette.electric700, bg: palette.blue50 },
      green: { fg: palette.electric700, bg: palette.blue50 },
      amber: { fg: palette.electric700, bg: palette.blue50 },
      rose: { fg: palette.electric700, bg: palette.blue50 },
      violet: { fg: palette.electric700, bg: palette.blue50 },
      teal: { fg: palette.electric700, bg: palette.blue50 },
      indigo: { fg: palette.electric700, bg: palette.blue50 },
      slate: { fg: palette.neutral700, bg: palette.neutral100 },
    },
  },

  // ── Typographie ────────────────────────────────────────────────────────────
  // Inter sur web (chargé via app/+html.tsx), police système native ailleurs.
  font: {
    sans: Platform.select({
      // « Inter Fallback » : Arial mis à l'échelle d'Inter (app/+html.tsx, anti-CLS).
      web: "'Inter', 'Inter Fallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      default: 'System',
    }) as string,
    // Schibsted Grotesk — grotesk éditoriale open-source (Free Faces), réservée aux
    // titres / display (design system §3). Remplace DM Sans (2026-07) pour sortir du
    // combo « Inter/DM Sans » générique pointé par l'audit design. Inter en repli.
    display: Platform.select({
      web: "'Schibsted Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      default: 'System',
    }) as string,
    // Source Serif 4 — serif éditoriale pour les grands titres (hero, têtes de
    // section). Choisie pour son ancrage édition scientifique/longue lecture,
    // hors des serifs par défaut des générateurs (ex-Fraunces, remplacée 2026-07).
    // Réservée aux niveaux display/h1 ; jamais en corps de texte.
    serif: Platform.select({
      // « Source Serif 4 Fallback » : Times New Roman mis à l'échelle (app/+html.tsx, anti-CLS).
      web: "'Source Serif 4', 'Source Serif 4 Fallback', 'Georgia', 'Times New Roman', serif",
      default: Platform.OS === 'ios' ? 'Georgia' : 'serif',
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
  // ── Tracking des libellés UPPERCASE (deux crans seulement) ──────────────────
  // caps : étiquettes UI (badges, labels de section/champ, méta) ;
  // capsWide : eyebrows éditoriaux du marketing/hero. Jamais d'autre valeur.
  tracking: {
    caps: 0.8,
    capsWide: 1.2,
  },
  // Échelle modulaire (~1.2). Letter-spacing négatif sur les grands titres = rendu « dessiné ».
  type: {
    landing: { fontSize: 60, lineHeight: 68, letterSpacing: -1.2 },
    hero: { fontSize: 44, lineHeight: 52, letterSpacing: -0.6 }, // headline du hero landing uniquement
    display: { fontSize: 40, lineHeight: 46, letterSpacing: -0.8 },
    h1: { fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
    h2: { fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
    h3: { fontSize: 18, lineHeight: 26, letterSpacing: -0.2 },
    bodyLg: { fontSize: 17, lineHeight: 27, letterSpacing: 0 },
    body: { fontSize: 15, lineHeight: 24, letterSpacing: 0 },
    label: { fontSize: 14, lineHeight: 20, letterSpacing: 0 },
    caption: { fontSize: 13, lineHeight: 20, letterSpacing: 0 },
    micro: { fontSize: 11, lineHeight: 15, letterSpacing: 0.2 }, // badges, méta, onglets — plus petit cran autorisé
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
  },

  // ── Rayons (mesurés, pas de « tout arrondi ») ───────────────────────────────
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 8,
    xl: 12,
    pill: 999,
  },

  // ── Tailles de contrôle (hauteurs unifiées boutons / champs / icônes) ────────
  size: {
    controlMd: 44,
    composerAction: 104,
    controlLg: 52,
    iconButton: 44,
    iconSm: 16,
    iconMd: 20,
    iconLg: 24,
    ring: 32,
    stroke: 2,
  },
  layout: { compact: 640, tablet: 768, shell: 1024, wide: 1280, sidebar: 224, rail: 72, reading: 760, page: 1200, form: 560, audience: 384, history: 256 },
  border: { thin: 1, accent: 3 },

  // ── Élévation (ombres discrètes ; web only, ignorées proprement en natif) ───
  // Ombres en deux couches (contact + diffusion) : profondeur crédible sans halo
  // « template ». Une seule grande ombre floue est un tell de design générique.
  elevation: {
    sm: Platform.select({
      web: {},
      default: {},
    }) as object,
    md: Platform.select({
      web: { boxShadow: '0 4px 12px rgba(20,32,52,0.08)' },
      default: {},
    }) as object,
    lg: Platform.select({
      web: { boxShadow: '0 4px 8px rgba(30, 64, 175, 0.06), 0 16px 40px -12px rgba(30, 64, 175, 0.18)' },
      default: {},
    }) as object,
  },

  // ── Focus (accessibilité web) ────────────────────────────────────────────────
  // Anneau de focus visible, contrasté, posé via boxShadow (web only). Sur natif
  // le focus clavier ne s'applique pas de la même façon → objet vide ignoré.
  focus: {
    ring: Platform.select({
      web: { outlineStyle: 'solid', outlineWidth: 2, outlineColor: palette.electric700, outlineOffset: 3 },
      default: {},
    }) as object,
  },

  // ── Mouvement (design system §4) ─────────────────────────────────────────────
  // Pas de bounce ni de spring tape-à-l'œil : fades, translate 4–8 px, scale 0.98→1.
  // Toujours coupé sous prefers-reduced-motion (cf. useReducedMotion).
  motion: {
    duration: { fast: 120, base: 200, slow: 320 },
    // Transition CSS douce pour les états interactifs (web only ; ignorée en natif
    // où l'on s'appuie sur Animated / Pressable). Couvre couleur, ombre, transform.
    transitionWeb: Platform.select({
      web: {
        transitionProperty: 'background-color, border-color, box-shadow, transform, opacity',
        transitionDuration: '180ms',
        // Ease-out : l'interface répond vite puis se pose — jamais de bounce.
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      default: {},
    }) as object,
    // Courbes de Bézier (mêmes valeurs côté web CSS, cf. app/+html.tsx).
    easing: {
      standard: [0.4, 0, 0.2, 1] as const, // entrée / interaction
      out: [0.16, 1, 0.3, 1] as const, // sortie douce
    },
    // Amplitudes d'entrée par défaut.
    revealOffset: 8, // translateY initial (px)
    revealStagger: 70, // décalage entre éléments d'une séquence (ms)
  },
} as const;
