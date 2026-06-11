import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { Button } from '@/ui/Button';
import { Logo } from '@/ui/Logo';
import { tokens } from '@/ui/tokens';

/**
 * Header de navigation de la landing (audit 2026-06) : logo MedInfo à gauche,
 * liens marketing + CTA à droite. Rendu hors du ScrollView de la landing →
 * reste visible pendant le défilement, sur toutes les plateformes.
 *
 * Rôle-aware : visiteur → Tarifs / Se connecter / Commencer ;
 * connecté → Tarifs / Mon compte / Ouvrir le chat.
 * Le masquage UI n'est jamais l'unique barrière (autorisation serveur conservée).
 */
const COMPACT_BREAKPOINT = 640;

export function LandingHeader() {
  const router = useRouter();
  const { user } = useSession();
  const { width } = useWindowDimensions();

  const isAuthed = !!user;
  const compact = width < COMPACT_BREAKPOINT;

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Logo size="sm" />

        <View style={styles.nav}>
          {!compact ? (
            <NavLink label="Tarifs" onPress={() => router.push('/(billing)/pricing')} />
          ) : null}
          {!compact ? (
            isAuthed ? (
              <NavLink label="Mon compte" onPress={() => router.push('/(account)/account')} />
            ) : (
              <NavLink label="Se connecter" onPress={() => router.push('/(auth)/sign-in')} />
            )
          ) : null}
          <Button
            label={isAuthed ? 'Ouvrir le chat' : 'Commencer'}
            size="md"
            fullWidth={false}
            onPress={() => router.push('/(chat)/chat')}
          />
        </View>
      </View>
    </View>
  );
}

function NavLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [
        styles.link,
        hovered && styles.linkHovered,
        focused && styles.linkFocused,
      ]}
    >
      <Text style={styles.linkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    paddingHorizontal: tokens.space.xl,
    alignItems: 'center',
    zIndex: 10,
  },
  inner: {
    width: '100%',
    maxWidth: 960,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.space.md,
    gap: tokens.space.md,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  link: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.sm,
    ...tokens.motion.transitionWeb,
  },
  linkHovered: { backgroundColor: tokens.colors.surfaceHover },
  linkFocused: tokens.focus.ring,
  linkLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});
