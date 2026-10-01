import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import type { ChatbotId } from '@/ai/chat/chatContext';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons';
import { Logo } from '@/ui/Logo';
import { CHATBOT_META } from '@/ui/chat/ChatbotSwitcher';
import { tokens } from '@/ui/tokens';
import { mi, NAV_COMPACT_BREAKPOINT, NAV_WIDE_BREAKPOINT } from '@/ui/responsive';
import { useWindowWidth } from '@/ui/useWindowWidth';

/**
 * Header de navigation des pages publiques (audit landing 2026-06) : logo MedInfo à
 * gauche, liens marketing (Chatbots / Blog / À propos / Contact / Tarifs) + CTA à droite.
 * Rendu hors du ScrollView de chaque page → reste visible pendant le défilement.
 *
 * Rôle-aware : le menu « Chatbots » liste les chats du rôle vérifié (étudiant/pro/admin →
 * les 3 ; public → chat public ; visiteur → les 3, essai 1 message gratuit). Le masquage
 * UI n'est jamais l'unique barrière (autorisation serveur conservée dans /api/chat).
 */

type MenuEntry = { label: string; route: string };

export function LandingHeader() {
  const router = useRouter();
  const { user, persona } = useSession();
  const width = useWindowWidth();
  const [openMenu, setOpenMenu] = useState<'chatbots' | 'compact' | null>(null);

  const isAuthed = !!user;
  const isAdmin = user ? isAdminUserId(user.id) : false;
  const compact = width < NAV_COMPACT_BREAKPOINT;
  const wide = width >= NAV_WIDE_BREAKPOINT;
  // Web : toutes les variantes sont dans le DOM et le CSS choisit selon la largeur
  // (src/ui/responsive.ts) — le pré-rendu, fait sans fenêtre, est ainsi juste à toutes
  // les largeurs. Natif : le JS choisit.
  const web = Platform.OS === 'web';

  // Mêmes règles que l'accueil / l'écran chat : invité et rôles vérifiés étudiant/pro/admin
  // voient les 3 chatbots ; un compte public vérifié n'a que le chat public.
  const availableChatbots: ChatbotId[] =
    !isAuthed || isAdmin || persona === 'student' || persona === 'professional'
      ? ['public', 'student', 'professional']
      : ['public'];

  const chatbotEntries: MenuEntry[] = availableChatbots.map((id) => ({
    label: `Chat ${CHATBOT_META[id].label.toLowerCase()}`,
    route: `/(chat)/chat?bot=${id}`,
  }));

  const pageEntries: MenuEntry[] = [
    { label: 'Blog', route: '/(marketing)/blog' },
    { label: 'À propos', route: '/(marketing)/a-propos' },
    { label: 'Contact', route: '/(marketing)/contact' },
    { label: 'Tarifs', route: '/(billing)/pricing' },
  ];
  const accountEntry: MenuEntry = isAuthed
    ? { label: 'Mon compte', route: '/(account)/account' }
    : { label: 'Se connecter', route: '/(auth)/sign-in' };

  const go = (route: string) => {
    setOpenMenu(null);
    router.push(route as never);
  };

  return (
    <View style={styles.bar}>
      {/* Fermeture au clic à l'extérieur : calque plein écran (web : position fixed)
          rendu SOUS la barre — les liens du header et le menu restent cliquables. */}
      {openMenu ? (
        <Pressable
          style={styles.clickAway}
          onPress={() => setOpenMenu(null)}
          accessibilityLabel="Fermer le menu"
        />
      ) : null}
      <View style={styles.inner}>
        <Pressable
          style={styles.brandRow}
          onPress={() => go('/')}
          accessibilityRole="link"
          accessibilityLabel="Accueil MedInfo AI"
        >
          {/* Illustration de l'équipe (demande Hugo 2026-06) — dans le coin haut gauche,
              le logo MedInfo à sa droite. Asset relatif (cf. piège alias @/). */}
          <Image
            source={require('../../assets/brand/team-illustration-144.webp')}
            style={styles.teamBadge}
            resizeMode="cover"
            accessibilityRole="image"
            accessibilityLabel="L'équipe MedInfo AI"
          />
          <Logo size="sm" />
        </Pressable>

        <View style={styles.nav}>
          {web || !compact ? (
            <View {...mi(`ge${NAV_COMPACT_BREAKPOINT}`)}>
              <NavLink
                label="Services"
                chevron
                active={openMenu === 'chatbots'}
                onPress={() => setOpenMenu((m) => (m === 'chatbots' ? null : 'chatbots'))}
              />
              {openMenu === 'chatbots' ? (
                <DropdownCard entries={chatbotEntries} onSelect={go} />
              ) : null}
            </View>
          ) : null}

          {web || wide
            ? pageEntries.map((e) => (
                <NavLink key={e.route} layout={mi(`ge${NAV_WIDE_BREAKPOINT}`)} label={e.label} onPress={() => go(e.route)} />
              ))
            : null}
          {web || (!compact && !wide) ? (
            <NavLink layout={mi('nav-mid')} label="Blog" onPress={() => go('/(marketing)/blog')} />
          ) : null}

          {web || !compact ? (
            <NavLink layout={mi(`ge${NAV_COMPACT_BREAKPOINT}`)} label={accountEntry.label} onPress={() => go(accountEntry.route)} />
          ) : null}

          {web || compact || !wide ? (
            <View {...mi(`lt${NAV_WIDE_BREAKPOINT}`)}>
              <NavLink
                label="Menu"
                chevron
                active={openMenu === 'compact'}
                onPress={() => setOpenMenu((m) => (m === 'compact' ? null : 'compact'))}
              />
              {openMenu === 'compact' ? (
                <DropdownCard
                  entries={
                    compact
                      ? [...chatbotEntries, ...pageEntries, accountEntry]
                      : pageEntries.filter((e) => e.label !== 'Blog')
                  }
                  onSelect={go}
                />
              ) : null}
            </View>
          ) : null}

          {web || !compact ? (
            <View {...mi(`ge${NAV_COMPACT_BREAKPOINT}`)}>
              <Button
                variant="secondary"
                label={isAuthed ? 'Ouvrir le chat' : 'Commencer'}
                size="md"
                fullWidth={false}
                onPress={() => go('/(chat)/chat')}
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function NavLink({
  label,
  onPress,
  chevron = false,
  active = false,
  layout,
}: {
  label: string;
  onPress: () => void;
  chevron?: boolean;
  active?: boolean;
  /** Attribut de mise en page web (`mi(…)`), cf. src/ui/responsive.ts. */
  layout?: {};
}) {
  return (
    <Pressable
      {...layout}
      accessibilityRole="link"
      onPress={onPress}
      style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [
        styles.link,
        (hovered || active) && styles.linkHovered,
        focused && styles.linkFocused,
      ]}
    >
      <Text style={styles.linkLabel}>{label}</Text>
      {chevron ? (
        <View style={{ transform: [{ rotate: active ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={14} color={tokens.colors.accentVivid} />
        </View>
      ) : null}
    </Pressable>
  );
}

function DropdownCard({ entries, onSelect }: { entries: MenuEntry[]; onSelect: (route: string) => void }) {
  return (
    <View style={styles.dropdown}>
      {entries.map((e) => (
        <TouchableOpacity
          key={e.route + e.label}
          style={styles.dropdownRow}
          onPress={() => onSelect(e.route)}
          accessibilityRole="link"
          accessibilityLabel={e.label}
        >
          <Text style={styles.dropdownText}>{e.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  teamBadge: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  clickAway: {
    // RN web transmet 'fixed' au CSS ; sur natif, repli absolu (les dropdowns du
    // header sont une surface web-first).
    position: Platform.OS === 'web' ? ('fixed' as 'absolute') : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    ...(Platform.OS === 'web' ? ({ cursor: 'auto' } as object) : null),
  },
  bar: {
    backgroundColor: tokens.colors.surface,
    borderTopWidth: tokens.border.accent,
    borderTopColor: tokens.colors.accent,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    // Marque collée au coin gauche (demande Hugo) : padding réduit, pas de centrage max-width.
    paddingHorizontal: tokens.space.md,
    alignItems: 'center',
    zIndex: 30,
  },
  inner: {
    width: '100%',
    maxWidth: tokens.layout.wide,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.space.sm,
    gap: tokens.space.md,
  },
  brandRow: {
    minHeight: tokens.size.controlMd,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
  },
  link: {
    minHeight: tokens.size.controlMd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.sm,
    ...tokens.motion.transitionWeb,
  },
  linkHovered: { backgroundColor: tokens.colors.accentSurface },
  linkFocused: tokens.focus.ring,
  linkLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: tokens.space.xs,
    minWidth: 230,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.space.xs,
    zIndex: 40,
    ...tokens.elevation.md,
  },
  dropdownRow: {
    minHeight: tokens.size.controlMd,
    justifyContent: 'center',
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm + 2,
    ...tokens.motion.transitionWeb,
  },
  dropdownText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
});
