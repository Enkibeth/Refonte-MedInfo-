/**
 * Design system MedInfo AI — source unique (05_DESIGN §2, §3, §8).
 *
 * Identité « bleu pétrole » conservée et étoffée : rampe petrol complète, neutres
 * cliniques (gris froids non boueux), sémantiques sobres, échelle typographique
 * modulaire, espacements 4-pt, rayons mesurés et élévations discrètes.
 *
 * Règle : aucune valeur hex/typo en dur dans les composants — tout passe par ce fichier.
 */
import { Platform } from 'react-native';

// ── Rampe brute (ne pas consommer directement : passer par `tokens.colors`) ──
const palette = {
  // Petrol — identité de marque, déclinée pour la profondeur et les fonds teintés.
  petrol900: '#062B3D',
  petrol800: '#083B52', // profondeur, texte accent
  petrol700: '#0A4D68', // primaire (CTA, header)
  petrol600: '#0C5C7E', // hover / actif
  petrol500: '#127193',
  petrol100: '#DCEAF1', // fond teinté discret
  petrol50: '#EFF5F9',

  // Neutres cliniques — gris froids légèrement désaturés, jamais bleu criard.
  white: '#FFFFFF',
  neutral25: '#FAFBFC', // fond d'app (off-white, moins « plat » que blanc pur)
  neutral50: '#F4F6F8', // surfaces alt, cartes
  neutral100: '#ECEFF2',
  neutral200: '#DEE3E8', // bordures
  neutral300: '#C4CCD2',
  neutral500: '#697880', // texte secondaire
  neutral700: '#3A474E',
  neutral900: '#0F1B22', // encre principale

  // Sémantiques — désaturées pour rester sobres en contexte médical.
  green600: '#157F50',
  green50: '#E6F4EC',
  red600: '#C42233',
  red50: '#FBEAEC',
  amber600: '#9A6516',
  amber50: '#FBF1DD',
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
    onAccent: palette.white, // texte sur fond petrol

    // Accent petrol
    accent: palette.petrol700, // primaire
    accentStrong: palette.petrol600, // hover / actif
    accentDeep: palette.petrol800, // texte accent sur fond clair
    accentDarker: palette.petrol900, // fond hero, profondeur maximale
    accentSurface: palette.petrol50, // fond teinté très léger
    accentSurfaceStrong: palette.petrol100,

    // États
    success: palette.green600,
    successBackground: palette.green50,
    danger: palette.red600,
    dangerBackground: palette.red50,
    warningText: palette.amber600,
    warningBackground: palette.amber50,
  },

  // ── Typographie ────────────────────────────────────────────────────────────
  // Inter sur web (chargé via app/+html.tsx), police système native ailleurs.
  font: {
    sans: Platform.select({
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
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
  // Échelle modulaire (~1.2). Letter-spacing négatif sur les grands titres = rendu « dessiné ».
  type: {
    display: { fontSize: 40, lineHeight: 46, letterSpacing: -0.8 },
    h1: { fontSize: 30, lineHeight: 38, letterSpacing: -0.5 },
    h2: { fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
    h3: { fontSize: 18, lineHeight: 26, letterSpacing: -0.2 },
    bodyLg: { fontSize: 17, lineHeight: 27, letterSpacing: 0 },
    body: { fontSize: 15, lineHeight: 24, letterSpacing: 0 },
    label: { fontSize: 14, lineHeight: 20, letterSpacing: 0 },
    caption: { fontSize: 12.5, lineHeight: 18, letterSpacing: 0.1 },
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
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },

  // ── Élévation (ombres discrètes ; web only, ignorées proprement en natif) ───
  elevation: {
    sm: Platform.select({
      web: { boxShadow: '0 1px 2px rgba(15, 27, 34, 0.06)' },
      default: {},
    }) as object,
    md: Platform.select({
      web: { boxShadow: '0 4px 16px -4px rgba(15, 27, 34, 0.10)' },
      default: {},
    }) as object,
    lg: Platform.select({
      web: { boxShadow: '0 12px 32px -8px rgba(8, 59, 82, 0.16)' },
      default: {},
    }) as object,
  },
} as const;
