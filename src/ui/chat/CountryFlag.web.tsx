/**
 * Drapeau d'un pays du sélecteur de chat — implémentation WEB.
 *
 * Windows n'a AUCUN glyphe d'emoji drapeau (choix de Microsoft : Segoe UI Emoji
 * affiche les lettres « FR » à la place) — retour Hugo 2026-07-28 : « les drapeaux
 * s'affichent sur iPhone/iPad mais pas sur Windows ». Sur Windows on rend donc de
 * petits drapeaux SVG INLINE (dessinés ici, zéro dépendance ni requête réseau,
 * même pattern que icons.web.tsx) ; partout ailleurs (macOS, iOS, Android), les
 * emoji natifs restent plus fins et cohérents avec le système.
 *
 * Les tracés sont des simplifications reconnaissables (bandes, croix, feuille
 * d'érable stylisée, Union Jack simplifié, bannière étoilée sans les 50 étoiles) —
 * suffisant à cette taille (14-18 px de haut).
 */
import type { ReactElement } from 'react';

import { getCountry, type CountryCode } from '@/ai/chat/country';

const IS_WINDOWS =
  typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent ?? '');

/** Bandes verticales (x, largeur en 60e) ou horizontales (y, hauteur en 40e). */
function Bands({ colors, horizontal = false }: { colors: string[]; horizontal?: boolean }) {
  const n = colors.length;
  return (
    <>
      {colors.map((fill, i) =>
        horizontal ? (
          <rect key={i} x={0} y={(40 / n) * i} width={60} height={40 / n + 0.5} fill={fill} />
        ) : (
          <rect key={i} x={(60 / n) * i} y={0} width={60 / n + 0.5} height={40} fill={fill} />
        ),
      )}
    </>
  );
}

/** Contenu SVG par pays (viewBox 0 0 60 40). */
const FLAG_SVG: Partial<Record<CountryCode, () => ReactElement>> = {
  FR: () => <Bands colors={['#0055A4', '#FFFFFF', '#EF4135']} />,
  BE: () => <Bands colors={['#000000', '#FDDA24', '#EF3340']} />,
  IT: () => <Bands colors={['#009246', '#FFFFFF', '#CE2B37']} />,
  DE: () => <Bands horizontal colors={['#000000', '#DD0000', '#FFCE00']} />,
  NL: () => <Bands horizontal colors={['#AE1C28', '#FFFFFF', '#21468B']} />,
  LU: () => <Bands horizontal colors={['#EF3340', '#FFFFFF', '#00A2E1']} />,
  ES: () => (
    <>
      <rect x={0} y={0} width={60} height={40} fill="#AA151B" />
      <rect x={0} y={10} width={60} height={20} fill="#F1BF00" />
    </>
  ),
  PT: () => (
    <>
      <rect x={0} y={0} width={24} height={40} fill="#046A38" />
      <rect x={24} y={0} width={36} height={40} fill="#DA291C" />
      <circle cx={24} cy={20} r={7} fill="#FFE900" />
      <circle cx={24} cy={20} r={4} fill="#DA291C" />
    </>
  ),
  CH: () => (
    <>
      <rect x={0} y={0} width={60} height={40} fill="#DA291C" />
      <rect x={26} y={9} width={8} height={22} fill="#FFFFFF" />
      <rect x={19} y={16} width={22} height={8} fill="#FFFFFF" />
    </>
  ),
  CA: () => (
    <>
      <rect x={0} y={0} width={60} height={40} fill="#FFFFFF" />
      <rect x={0} y={0} width={14} height={40} fill="#D80621" />
      <rect x={46} y={0} width={14} height={40} fill="#D80621" />
      {/* Feuille d'érable stylisée (polygone symétrique, reconnaissable à 16 px). */}
      <path
        d="M30 8 l3 6 5-3-2 7 6-1-4 5 5 3-6 2 1 5-5-2-3 6-3-6-5 2 1-5-6-2 5-3-4-5 6 1-2-7 5 3z"
        fill="#D80621"
      />
    </>
  ),
  GB: () => (
    <>
      <rect x={0} y={0} width={60} height={40} fill="#012169" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#FFFFFF" strokeWidth={8} />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth={3.5} />
      <path d="M30 0 V40 M0 20 H60" stroke="#FFFFFF" strokeWidth={13} />
      <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth={7.5} />
    </>
  ),
  US: () => (
    <>
      <rect x={0} y={0} width={60} height={40} fill="#B22234" />
      {[1, 3, 5].map((i) => (
        <rect key={i} x={0} y={(40 / 7) * i} width={60} height={40 / 7} fill="#FFFFFF" />
      ))}
      <rect x={0} y={0} width={26} height={(40 / 7) * 3} fill="#3C3B6E" />
    </>
  ),
};

export function CountryFlag({ code, size = 16 }: { code: CountryCode; size?: number }) {
  const country = getCountry(code);
  const Svg = FLAG_SVG[code];

  // Hors Windows, l'emoji système reste le meilleur rendu ; « Autre / International »
  // garde le globe 🌐 partout (cet emoji-là existe bien dans Segoe UI Emoji).
  if (!IS_WINDOWS || !Svg) {
    return <span style={{ fontSize: size, lineHeight: 1 }}>{country?.flag ?? '🌐'}</span>;
  }

  const height = size;
  const width = Math.round(size * 1.5);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 40"
      aria-hidden="true"
      focusable="false"
      style={{
        display: 'block',
        flexShrink: 0,
        borderRadius: 2,
        // Liseré discret : les drapeaux à fond clair (blanc) restent lisibles sur fond clair.
        boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.14)',
      }}
    >
      <Svg />
    </svg>
  );
}
