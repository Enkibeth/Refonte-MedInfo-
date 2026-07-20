/**
 * Design system MedInfo AI — source unique (05_DESIGN §2, §3, §4, §9).
 *
 * Refonte 2026-07 (demande Hugo) : exit le « bleu pétrole » jugé fade — identité
 * BLEU VIF : rampe bleue électrique complète (hero/footer en bleu nuit profond,
 * CTA saturés), neutres rafraîchis (slate froid légèrement teinté bleu),
 * sémantiques sobres, échelle typographique modulaire, espacements 4-pt,
 * rayons mesurés et élévations discrètes.
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
  blue500: '#3B82F6', // lueurs, décor
  blue100: '#D9E6FF', // fond teinté discret
  blue50: '#EEF4FF',

  // Bleu électrique — le « bleu pétant » des CTA primaires et liens d'action
  // (hérité de l'essai 2026-06, conservé et généralisé par la refonte 2026-07).
  electric600: '#0067FF',
  electric700: '#0052D6', // hover / actif

  // Neutres — slate froid légèrement teinté bleu (rafraîchi 2026-07), jamais boueux.
  white: '#FFFFFF',
  neutral25: '#F7F9FC', // fond d'app (off-white teinté bleu, moins « plat » que blanc pur)
  neutral50: '#F3F6FA', // surfaces alt, cartes
  neutral100: '#EAEEF5',
  neutral200: '#DDE3ED', // bordures
  neutral300: '#C3CDDB',
  neutral500: '#5D6B80', // texte secondaire
  neutral700: '#36435A',
  neutral900: '#0E1626', // encre principale

  // Sémantiques — désaturées pour rester sobres en contexte médical.
  green600: '#157F50',
  green50: '#E6F4EC',
  red600: '#C42233',
  red50: '#FBEAEC',
  amber600: '#9A6516',
  amber50: '#FBF1DD',

  // Accents par audience (design system §4 — usage strict : eyebrow pills,
  // bordure d'accent, pastille d'icône. ≤ 5 % de la surface).
  proAccent: '#B45309', // ambre brûlé — professionnels de santé
  proSoft: '#FBF1E3',
  studentAccent: '#4D7C0F', // olive — étudiants en médecine
  studentSoft: '#EEF6DE',
  publicAccent: '#BE185D', // framboise sobre — grand public
  publicSoft: '#FBE7F0',
} as const;

export const tokens = {
  colors: {
    // Surfaces
    background: palette.neutral25, // surface principale (off-white)
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
    accent: palette.blue600, // primaire
    accentStrong: palette.blue500, // lueur / décor (hero) — plus clair que le primaire
    accentDeep: palette.blue800, // texte accent sur fond clair
    accentDarker: palette.blue950, // fond hero/footer, profondeur maximale
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

    // États d'interaction (web : hover/focus). Sobres, dérivés de la rampe existante.
    surfaceHover: palette.neutral50, // survol d'une surface blanche (boutons, cartes)
    accentSurfaceHover: palette.blue100, // survol d'une pastille teintée bleue

    // ── Accents par audience (persona) ───────────────────────────────────────
    // Trois publics distincts du design system : pro / étudiant / grand public.
    personas: {
      pro: { accent: palette.proAccent, soft: palette.proSoft },
      student: { accent: palette.studentAccent, soft: palette.studentSoft },
      public: { accent: palette.publicAccent, soft: palette.publicSoft },
    },

    // ── Teintes de pastilles par outil (shell 2026-07) ───────────────────────
    // Chips colorées des cartes/listes d'outils (dashboard, panneau Outils,
    // activité récente) : fond doux + encre foncée AA. Usage strict : pastille
    // d'icône et monogramme — jamais des aplats de section entiers.
    tints: {
      blue: { fg: palette.blue700, bg: '#E4EDFF' },
      green: { fg: '#0E6B4A', bg: '#DFF3E9' },
      amber: { fg: '#8A5410', bg: '#FBEEDA' },
      rose: { fg: '#B01E45', bg: '#FCE5EC' },
      violet: { fg: '#5B34C7', bg: '#ECE6FC' },
      teal: { fg: '#0C6E67', bg: '#DCF2F0' },
      indigo: { fg: '#4338CA', bg: '#E7E9FE' },
      slate: { fg: palette.neutral700, bg: palette.neutral100 },
    },
  },

  // ── Typographie ────────────────────────────────────────────────────────────
  // Inter sur web (chargé via app/+html.tsx), police système native ailleurs.
  font: {
    sans: Platform.select({
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      default: 'System',
    }) as string,
    // DM Sans — réservée aux titres / display (design system §3). Inter en repli.
    display: Platform.select({
      web: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      default: 'System',
    }) as string,
    // Source Serif 4 — serif éditoriale pour les grands titres (hero, têtes de
    // section). Choisie pour son ancrage édition scientifique/longue lecture,
    // hors des serifs par défaut des générateurs (ex-Fraunces, remplacée 2026-07).
    // Réservée aux niveaux display/h1 ; jamais en corps de texte.
    serif: Platform.select({
      web: "'Source Serif 4', 'Georgia', 'Times New Roman', serif",
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
    hero: { fontSize: 44, lineHeight: 52, letterSpacing: -0.6 }, // headline du hero landing uniquement
    display: { fontSize: 40, lineHeight: 46, letterSpacing: -0.8 },
    h1: { fontSize: 30, lineHeight: 38, letterSpacing: -0.5 },
    h2: { fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
    h3: { fontSize: 18, lineHeight: 26, letterSpacing: -0.2 },
    bodyLg: { fontSize: 17, lineHeight: 27, letterSpacing: 0 },
    body: { fontSize: 15, lineHeight: 24, letterSpacing: 0 },
    label: { fontSize: 14, lineHeight: 20, letterSpacing: 0 },
    caption: { fontSize: 12.5, lineHeight: 18, letterSpacing: 0.1 },
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
  },

  // ── Rayons (mesurés, pas de « tout arrondi ») ───────────────────────────────
  radius: {
    xs: 6, // coin « pincé » des bulles de chat (queue côté émetteur)
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },

  // ── Tailles de contrôle (hauteurs unifiées boutons / champs / icônes) ────────
  size: {
    controlMd: 44,
    controlLg: 52,
    iconButton: 38,
  },

  // ── Élévation (ombres discrètes ; web only, ignorées proprement en natif) ───
  // Ombres en deux couches (contact + diffusion) : profondeur crédible sans halo
  // « template ». Une seule grande ombre floue est un tell de design générique.
  elevation: {
    sm: Platform.select({
      web: { boxShadow: '0 1px 2px rgba(14, 22, 38, 0.05), 0 1px 1px rgba(14, 22, 38, 0.04)' },
      default: {},
    }) as object,
    md: Platform.select({
      web: { boxShadow: '0 2px 4px rgba(30, 64, 175, 0.05), 0 8px 20px -6px rgba(30, 64, 175, 0.10)' },
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
      web: { boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.40)' },
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
