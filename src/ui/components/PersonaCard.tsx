import { useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/ui/icons/icons';
import { tokens } from '@/ui/theme/tokens';
import { useReducedMotion } from '@/ui/theme/useReducedMotion';

export type PersonaId = 'pro' | 'student' | 'public';

/**
 * Carte d'audience (design system §7, UI kit PersonaCard). Trois publics, chacun
 * avec son accent (eyebrow pill + pastille d'icône). Interaction sobre :
 *   - web  : survol → lift (-2 px), ombre md, bordure accentuée ;
 *   - natif : appui → léger enfoncement (scale 0.985).
 * `prefers-reduced-motion` respecté via useReducedMotion.
 */
export function PersonaCard({
  persona,
  eyebrow,
  title,
  description,
  cta,
  icon,
  onPress,
}: {
  persona: PersonaId;
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
      duration: tokens.motion.duration.base,
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    }).start();
  };

  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.004] });

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
            { transform: [{ translateY }, { scale }] },
            hovered ? [styles.cardHover, { borderColor: accent.accent }] : null,
          ]}
        >
          <View style={styles.head}>
            <View style={styles.marker}>
              <View style={[styles.markerDot, { backgroundColor: accent.accent }]} />
              <Text style={[styles.markerText, { color: accent.accent }]}>{eyebrow}</Text>
            </View>
            <View style={[styles.iconBadge, { backgroundColor: accent.soft }]}>
              <Icon name={icon} size={22} color={accent.accent} />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.ctaRow}>
            <Text style={[styles.cta, { color: accent.accent }]}>{cta}</Text>
            <Icon name="arrowRight" size={16} color={accent.accent} />
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
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.xl,
    gap: tokens.space.md,
    ...tokens.elevation.sm,
  },
  cardHover: tokens.elevation.md as object,
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Marqueur d'audience : point coloré + libellé en casse normale. Plus discret
  // (et moins « template ») que l'ancienne pastille uppercase.
  marker: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  markerDot: { width: 6, height: 6, borderRadius: 3 },
  markerText: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    letterSpacing: 0.2,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    lineHeight: tokens.type.h3.lineHeight,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  description: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
    marginTop: tokens.space.xs,
  },
  cta: {
    fontFamily: tokens.font.display,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});
