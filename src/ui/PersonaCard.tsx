import { useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from './icons';
import { tokens } from './tokens';
import { useReducedMotion } from './useReducedMotion';

export type PersonaId = 'pro' | 'student' | 'public';

/**
 * Carte d'audience (refonte « brutalisme structuré »). Bloc bordé encre à angle
 * vif, index monospace « 01 », pavé d'icône en APLAT couleur persona. Au survol
 * la carte se décale (-3 px) et révèle une ombre DURE de la couleur persona.
 * `prefers-reduced-motion` respecté.
 */
export function PersonaCard({
  persona,
  index,
  eyebrow,
  title,
  description,
  cta,
  icon,
  onPress,
}: {
  persona: PersonaId;
  index?: number;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  icon: IconName;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const lift = useRef(new Animated.Value(0)).current;
  const accent = tokens.colors.personas[persona];

  const animate = (to: number) => {
    if (reduced) return;
    Animated.timing(lift, {
      toValue: to,
      duration: tokens.motion.duration.fast,
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    }).start();
  };

  const translate = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const idx = typeof index === 'number' ? String(index + 1).padStart(2, '0') : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${cta}`}
      onPress={onPress}
      onHoverIn={() => animate(1)}
      onHoverOut={() => animate(0)}
      onPressIn={() => Platform.OS !== 'web' && animate(1)}
      onPressOut={() => Platform.OS !== 'web' && animate(0)}
      style={styles.pressable}
    >
      {({ hovered }: { hovered?: boolean }) => (
        <Animated.View
          style={[
            styles.card,
            { transform: [{ translateX: translate }, { translateY: translate }] },
            hovered
              ? (Platform.select({ web: { boxShadow: `6px 6px 0 0 ${accent.accent}` }, default: {} }) as object)
              : null,
          ]}
        >
          <View style={styles.head}>
            <Text style={styles.index}>{idx ? `[ ${idx} ]` : eyebrow.toUpperCase()}</Text>
            <View style={[styles.iconBlock, { backgroundColor: accent.accent }]}>
              <Icon name={icon} size={22} color={tokens.colors.onAccent} />
            </View>
          </View>

          <Text style={[styles.eyebrow, { color: accent.accent }]}>{eyebrow.toUpperCase()}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.rule} />
          <View style={styles.ctaRow}>
            <Text style={styles.cta}>{cta}</Text>
            <Icon name="arrowRight" size={18} color={tokens.colors.text} />
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { flexGrow: 1, flexBasis: 240 },
  card: {
    flex: 1,
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.surfacePure,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    padding: tokens.space.xl,
    gap: tokens.space.sm,
    ...tokens.motion.transitionWeb,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.space.xs,
  },
  index: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
  },
  iconBlock: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: tokens.font.mono,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  description: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  rule: {
    height: tokens.border.hairline,
    backgroundColor: tokens.colors.border,
    marginTop: tokens.space.sm,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.space.xs,
  },
  cta: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
