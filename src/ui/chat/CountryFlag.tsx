/**
 * Drapeau d'un pays du sélecteur de chat — implémentation NATIVE (iOS/Android).
 *
 * Les emoji drapeaux sont parfaitement rendus par les plateformes Apple/Google :
 * on garde l'emoji. Le cas Windows (Segoe UI Emoji n'a AUCUN glyphe de drapeau —
 * il affiche « FR » en lettres) est traité par l'implémentation web
 * (CountryFlag.web.tsx, résolue automatiquement par Metro).
 */
import { Text } from 'react-native';

import { getCountry, type CountryCode } from '@/ai/chat/country';

export function CountryFlag({ code, size = 16 }: { code: CountryCode; size?: number }) {
  const flag = getCountry(code)?.flag ?? '🌐';
  return <Text style={{ fontSize: size, lineHeight: size + 4 }}>{flag}</Text>;
}
