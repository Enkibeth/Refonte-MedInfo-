/**
 * Nettoyage des comptes rendus médicaux générés (audio_report).
 *
 * Le modèle ajoute parfois des emojis et symboles décoratifs (📋, ⚠️, ✓, ➤…) et des
 * marqueurs markdown bruts qui s'affichent mal dans un compte rendu médical destiné à
 * l'impression/PDF. Un compte rendu doit rester sobre et professionnel : on retire les
 * pictogrammes et on normalise la mise en forme, SANS toucher au contenu clinique
 * (accents français, ponctuation médicale, titres, listes et gras conservés).
 *
 * Module pur (server + client).
 */

// Plages Unicode des emojis / pictogrammes / dingbats + sélecteurs de variante et ZWJ.
// NB : la puce « • » (U+2022) est volontairement EXCLUE — elle est normalisée en tiret
// markdown plus bas, pas supprimée.
const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{2700}-\u{27BF}]/gu;

export function sanitizeMedicalReport(input: string): string {
  if (!input) return '';

  let text = input;

  // 1) Retire emojis / pictogrammes / dingbats décoratifs.
  text = text.replace(EMOJI_PATTERN, '');

  // 2) Normalise les titres markdown : un compte rendu n'a pas de titre H1 décoratif.
  //    On ramène `# ` et `## ` à un niveau de section homogène `## ` (rendu en titre).
  text = text.replace(/^#{1,3}\s+/gm, '## ');

  // 3) Retire les marqueurs de citation `> ` en début de ligne (non pertinents ici).
  text = text.replace(/^\s{0,3}>\s?/gm, '');

  // 4) Puces hétérogènes (•, ‣, ·, *, +) → tiret markdown standard.
  text = text.replace(/^(\s*)[•‣·*+]\s+/gm, '$1- ');

  // 5) Espaces parasites en fin de ligne + lignes vides multiples.
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
