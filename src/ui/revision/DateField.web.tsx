/**
 * Champ date — implémentation WEB : vrai `<input type="date">` (date-picker natif du
 * navigateur). react-native-web rend via react-dom, donc le tag DOM brut est fiable
 * (même approche que `src/ui/icons.web.tsx`). Le format de valeur est `AAAA-MM-JJ`,
 * exactement celui attendu par l'input date HTML et stocké par le moteur.
 */
import { tokens } from '@/ui/tokens';

export function DateField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** Nom accessible (le libellé visible du champ n'est pas relié au <input>). */
  label: string;
}) {
  return (
    <input
      type="date"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: 44,
        boxSizing: 'border-box',
        borderRadius: tokens.radius.md,
        border: `1px solid ${tokens.colors.borderStrong}`,
        backgroundColor: tokens.colors.surface,
        padding: `0 ${tokens.space.md}px`,
        fontFamily: tokens.font.sans,
        fontSize: tokens.type.body.fontSize,
        color: tokens.colors.text,
        width: '100%',
      }}
    />
  );
}
