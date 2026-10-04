/**
 * Design system MedInfo AI — source unique (05_DESIGN §2, §3, §4, §9).
 *
 * Direction A enrichie, septembre 2026 : papier ivoire, encre et bleu vif.
 * Surfaces éditoriales et repères colorés ; contenu long sur surface blanche.
 *
 * Règle : aucune valeur hex/typo en dur dans les composants — tout passe par ce fichier.
 */
import { Platform } from 'react-native';

// ── Rampe brute (ne pas consommer directement : passer par `tokens.colors`) ──
const palette = {
  // Bleu — identité de marque 2026-07 : vif et jeune, décliné pour la profondeur
  // et les fonds teintés. (2026-10 : les nuances héritées du nuancier par défaut de
  // Tailwind, blue500 à blue800, sont retirées : doublons ou valeurs sans usage.)
  blue950: '#141E4E', // bleu nuit — hero/footer, profondeur maximale
  blue100: '#D9E6FF', // fond teinté discret
  blue50: '#EEF4FF',

  // Bleu électrique — le « bleu pétant » des CTA primaires et liens d'action
  // (hérité de l'essai 2026-06, conservé et généralisé par la refonte 2026-07).
  electric600: '#0067FF',
  electric700: '#0052D6', // hover / actif
  electric800: '#0043B0', // appui du primaire

  // Neutres — slate froid légèrement teinté bleu (rafraîchi 2026-07), jamais boueux.
  white: '#FFFFFF',
  neutral25: '#F8F7F3', // Papier ivoire : distingue la page des surfaces de lecture.
  neutral50: '#EDF1F7', // Navigation et surfaces secondaires bleu brume.
  // Champs enfoncés et états désactivés : distinct de neutral50 (ΔE 4,6 ; l'ancien #EAEEF5
  // en était indiscernable, ΔE 1,1). textMuted y reste à 4,99:1.
  neutral100: '#DFE5EE',
  neutral200: '#D8DFE7', // séparateurs non interactifs
  neutral250: '#C9D2DD', // filet des boutons secondaires au repos (le libellé identifie le bouton)
  neutral300: '#7D8998', // limites de contrôles : contraste > 3:1 sur blanc
  neutral500: '#526174', // texte secondaire
  neutral700: '#36435A',
  neutral900: '#142034', // encre principale

  // Sémantiques — désaturées pour rester sobres en contexte médical.
  green600: '#12744A', // 5,1:1 sur green50 (l'ancien #157F50 n'atteignait que 4,43:1, sous AA)
  green50: '#E6F4EC',
  red600: '#C42233',
  red50: '#FBEAEC',
  amber600: '#80500C',
  amber50: '#FBF1DD',

  // Couleurs éditoriales : repères d'audience et d'outils, jamais des statuts.
  sage50: '#E5F0E9',
  sage700: '#285C4B',
  lilac50: '#F0EAF8',
  lilac700: '#654582',
  clay50: '#F9EDE7',
  clay700: '#874932',
  sand50: '#F6EEDC',
  sand700: '#775622',
  mist: '#E8EFFA',
  midnight: '#172E46',
  moonlight: '#F4F7FC',
  moonlightMuted: '#C7D5E3',
  midnightRule: '#4F667D',
  mintLight: '#CDE6D9',

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
    // Filet d'un bouton secondaire au repos : plus léger que borderStrong (le gris foncé
    // alourdissait barres d'outils et formulaires), renforcé au survol (05_DESIGN §5).
    borderControl: palette.neutral250,

    // Texte
    text: palette.neutral900, // ink
    textMuted: palette.neutral500, // ink-soft
    textSubtle: palette.neutral700,
    onAccent: palette.white, // texte sur fond bleu

    // Accent bleu vif (refonte 2026-07)
    accent: palette.electric700, // texte/liens et contrôles : même famille que la primaire
    accentStrong: palette.electric600, // nuance secondaire, jamais pour le texte courant
    accentDeep: palette.electric700, // texte accent sur fond clair
    accentDarker: palette.blue950, // encre de marque historique
    accentSurface: palette.blue50, // fond teinté très léger
    accentSurfaceStrong: palette.blue100,
    accentVivid: palette.electric600, // CTA primaires et liens d'action (« bleu pétant »)
    accentVividStrong: palette.electric700, // hover des CTA vifs
    accentVividPressed: palette.electric800, // appui des CTA vifs (plus d'atténuation d'opacité)

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
    onDarkPressed: 'rgba(255,255,255,0.2)',

    // États d'interaction (web : hover/focus). Sobres, dérivés de la rampe existante.
    surfaceHover: palette.neutral50, // survol d'une surface blanche (boutons, cartes)
    accentSurfaceHover: palette.blue100, // survol d'une pastille teintée bleue

    // ── Surfaces éditoriales ────────────────────────────────────────────────
    editorial: {
      hero: palette.mist,
      photoMount: palette.lilac50,
      warmMount: palette.sand50,
      ink: palette.midnight,
      onInk: palette.moonlight,
      onInkMuted: palette.moonlightMuted,
      inkRule: palette.midnightRule,
      highlight: palette.mintLight,
    },

    // ── Accents par audience (persona) ───────────────────────────────────────
    // Toujours accompagnés du nom et d'une icône ; aucun sens clinique.
    personas: {
      pro: { accent: palette.electric700, soft: palette.blue50 },
      student: { accent: palette.lilac700, soft: palette.lilac50 },
      public: { accent: palette.sage700, soft: palette.sage50 },
    },

    // ── Teintes de pastilles par outil (shell 2026-07) ───────────────────────
    // Chips colorées des cartes/listes d'outils (dashboard, panneau Outils,
    // activité récente) : fond doux + encre foncée AA. Usage strict : pastille
    // d'icône et monogramme — jamais des aplats de section entiers.
    tints: {
      blue: { fg: palette.electric700, bg: palette.blue50 },
      green: { fg: palette.sage700, bg: palette.sage50 },
      amber: { fg: palette.sand700, bg: palette.sand50 },
      rose: { fg: palette.clay700, bg: palette.clay50 },
      violet: { fg: palette.lilac700, bg: palette.lilac50 },
      teal: { fg: palette.sage700, bg: palette.sage50 },
      indigo: { fg: palette.electric800, bg: palette.mist },
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
    display: { fontSize: 40, lineHeight: 46, letterSpacing: -0.8 },
    h1: { fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
    h2: { fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
    h3: { fontSize: 18, lineHeight: 26, letterSpacing: -0.2 },
    bodyLg: { fontSize: 17, lineHeight: 27, letterSpacing: 0 },
    // Lecture longue (réponses du chat, articles) : 16 px ramène la colonne vers ~75 caractères.
    reading: { fontSize: 16, lineHeight: 26, letterSpacing: 0 },
    // Champs de saisie : jamais sous 16 px (Safari iOS zoome la page au focus en dessous).
    input: { fontSize: 16, lineHeight: 24, letterSpacing: 0 },
    // Libellés d'interface un cran au-dessus du corps (bouton lg, barre mobile).
    ui: { fontSize: 16, lineHeight: 22, letterSpacing: 0 },
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
    buttonLg: 48, // bouton « lg » : assez grand au doigt, sans l'effet « pavé » de 52 px
    iconButton: 44,
    iconSm: 16,
    iconMd: 20,
    iconLg: 24,
    ring: 32,
    stroke: 2,
  },
  // measure : largeur maximale d'un paragraphe (≈ 75 caractères à 15 px), distincte de la
  // colonne de lecture qui peut porter tableaux et cartes.
  layout: { compact: 640, tablet: 768, shell: 1024, wide: 1280, sidebar: 224, rail: 72, reading: 760, measure: 600, page: 1200, form: 560, audience: 384, history: 256 },
  border: { thin: 1, accent: 3 },

  // ── Élévation (ombres discrètes ; web only, ignorées proprement en natif) ───
  // Ombres en deux couches (contact + diffusion) : profondeur crédible sans halo
  // « template ». Une seule grande ombre floue est un tell de design générique.
  elevation: {
    // Contrôles (boutons) : ombre de contact d'1 px, jamais un halo. Donne de la matière
    // au bouton secondaire sur fond blanc ; retirée à l'état désactivé.
    control: Platform.select({
      web: { boxShadow: '0 1px 2px rgba(20,32,52,0.06)' },
      default: {},
    }) as object,
    controlPrimary: Platform.select({
      web: { boxShadow: '0 1px 2px rgba(0,52,140,0.22)' },
      default: {},
    }) as object,
    none: Platform.select({
      web: { boxShadow: 'none' },
      default: {},
    }) as object,
    sm: Platform.select({
      web: {},
      default: {},
    }) as object,
    md: Platform.select({
      web: { boxShadow: '0 4px 12px rgba(20,32,52,0.08)' },
      default: {},
    }) as object,
    lg: Platform.select({
      web: { boxShadow: '0 4px 8px rgba(0, 67, 176, 0.06), 0 16px 40px -12px rgba(0, 67, 176, 0.18)' },
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
