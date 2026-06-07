/**
 * Carte « Auto-réflexion » — rend le bloc de méta-réflexion que le modèle ajoute en fin de
 * réponse (cf. src/ai/ui/reflection.ts). Design distinct du corps de réponse : liseré d'accent,
 * fond teinté discret, en-tête à pastille. Repliable, ouverte par défaut.
 */
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { tokens } from '@/ui/tokens';

export function ReflectionCard({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const [open, setOpen] = useState(true);

  return (
    <View style={styles.card}>
      <View style={styles.accent} />
      <View style={styles.inner}>
        <TouchableOpacity
          style={styles.header}
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🧠</Text>
          </View>
          <Text style={styles.title}>Auto-réflexion</Text>
          {streaming ? <Text style={styles.dots}>…</Text> : null}
          <View style={styles.spacer} />
          <Text style={styles.toggle}>{open ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {open ? <Text style={styles.body}>{text}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginTop: tokens.space.sm,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  accent: { width: 4, backgroundColor: tokens.colors.accent },
  inner: { flex: 1, padding: tokens.space.md, gap: tokens.space.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: { fontSize: 13 },
  title: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dots: { color: tokens.colors.accentDeep, fontSize: tokens.type.caption.fontSize },
  spacer: { flex: 1 },
  toggle: { color: tokens.colors.accentDeep, fontSize: 10 },
  body: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 19,
    fontStyle: 'italic',
  },
});
