/**
 * Champ date — implémentation NATIVE (iOS/Android).
 * Saisie texte `AAAA-MM-JJ` (pas de date-picker natif sans dépendance ajoutée).
 * Sur web, Metro résout `DateField.web.tsx` (vrai `<input type="date">`).
 */
import { TextInput, StyleSheet } from 'react-native';

import { tokens } from '@/ui/tokens';

export function DateField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** Nom accessible (le libellé visible du champ n'est pas relié au champ). */
  label: string;
}) {
  return (
    <TextInput
      accessibilityLabel={label}
      style={styles.input}
      defaultValue={value}
      onChangeText={(t) => onChange(t.trim())}
      placeholder="2026-06-01"
      placeholderTextColor={tokens.colors.textMuted}
      autoCapitalize="none"
      keyboardType="numbers-and-punctuation"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
  },
});
