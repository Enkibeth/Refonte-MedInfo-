/**
 * Tokens design — source unique (05_DESIGN §2, §8).
 * Palette validée « bleu pétrole » (identité MedInfo) : fond blanc, accent petrol.
 * Tout changement de couleur passe par ce fichier — jamais de hex en dur dans les composants.
 */
export const tokens = {
  colors: {
    // Surfaces
    background: '#FFFFFF', // surface principale (blanc)
    surface: '#F4F7FA', // surface-alt : cartes, bulles IA
    border: '#E1E8ED',
    // Texte
    text: '#0F1B22', // ink
    textMuted: '#4A5A63', // ink-soft
    // Accent petrol
    accent: '#0A4D68', // primaire (CTA, header, bulle user)
    accentStrong: '#0C4A6E', // hover / état actif
    accentDeep: '#083B52', // profondeur, texte accent sur fond clair
    // États
    success: '#1A9E60', // QCM correct
    successBackground: '#E7F6EE', // fond réponse QCM correcte
    danger: '#D7263D', // erreur / refus / urgence
    warningBackground: '#FCEFD6', // bandeau vigilance (amber doux)
    warningText: '#8A5A12',
  },
} as const;
