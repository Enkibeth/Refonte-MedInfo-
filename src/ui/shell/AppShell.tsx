/**
 * Shell applicatif (refonte design 2026-07, principe « dashboard » validé par Hugo) :
 * sidebar bleu nuit persistante + barre supérieure (fil d'Ariane, aide) autour des
 * écrans applicatifs sur DESKTOP WEB uniquement (≥ 1024 px, session ouverte).
 *
 * Partout ailleurs (mobile, natif, visiteur non connecté, pages publiques), le shell
 * est transparent : il rend ses enfants tels quels — la tab bar mobile
 * (src/ui/AppTabBar.tsx) et les en-têtes d'écran existants restent la navigation.
 *
 * Couche d'ERGONOMIE uniquement : la sidebar consomme `visibleFeatures` (matrice
 * role-aware existante) et n'est jamais une barrière — l'autorisation réelle reste
 * côté serveur (serverPersona.ts) et <RoleGate> en défense en profondeur.
 */
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, Platform } from 'react-native';
import { useRouter, usePathname, useSegments } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import type { Persona } from '@/ai/prompts/_schema';
import { APP_FEATURES, visibleFeatures } from '@/ai/routing/featureVisibility';
import { Icon, type IconName } from '@/ui/icons';
import { Logo } from '@/ui/Logo';
import { tokens } from '@/ui/tokens';

/** Largeur minimale (px) à partir de laquelle la sidebar remplace la tab bar. */
export const SHELL_BREAKPOINT = 1024;

const SIDEBAR_WIDTH = 264;

/** Groupes de routes qui vivent DANS le shell (espace connecté). */
const SHELL_GROUPS = new Set(['(chat)', '(account)', '(billing)', '(admin)']);

const PERSONA_LABEL: Record<Persona, string> = {
  public: 'Grand public',
  student: 'Étudiant en médecine',
  professional: 'Professionnel de santé',
};

/** Libellés des pages hors registre d'outils (fil d'Ariane). */
const STATIC_LABELS: Record<string, string> = {
  '/dashboard': "Vue d’ensemble",
  '/account': 'Mon compte',
  '/choose-role': 'Choix du rôle',
  '/pricing': 'Tarifs',
};

/** Libellé de la page courante pour le fil d'Ariane (null → racine seule). */
export function shellPageLabel(pathname: string, adminGroup: boolean): string | null {
  if (adminGroup) return 'Panel admin IA';
  const path = pathname.replace(/\/+$/, '') || '/';
  if (STATIC_LABELS[path]) return STATIC_LABELS[path];
  const feature = APP_FEATURES.find((f) => f.route.replace(/^\/\(chat\)/, '') === path);
  return feature ? feature.label : null;
}

function initialsOf(firstName: string | null, lastName: string | null, email: string | null): string {
  const a = firstName?.trim()?.[0] ?? '';
  const b = lastName?.trim()?.[0] ?? '';
  if (a || b) return `${a}${b}`.toUpperCase() || a.toUpperCase();
  return (email?.trim()?.[0] ?? '?').toUpperCase();
}

interface NavEntry {
  key: string;
  label: string;
  icon: IconName;
  route: string;
  /** Chemin (pathname) qui marque l'entrée comme active. */
  match: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const { session, user, persona, personalInfo } = useSession();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = user ? isAdminUserId(user.id) : false;
  const inShellGroup = SHELL_GROUPS.has(segments[0] ?? '');
  const desktop = Platform.OS === 'web' && width >= SHELL_BREAKPOINT;

  if (!desktop || !session || !inShellGroup) return <>{children}</>;

  const tools = visibleFeatures(persona, { isAdmin });
  const spaceEntries: NavEntry[] = [
    {
      key: 'dashboard',
      label: "Vue d’ensemble",
      icon: 'home',
      route: '/(chat)/dashboard',
      match: '/dashboard',
    },
    ...tools.map((f) => ({
      key: f.id,
      label: f.label,
      icon: f.icon,
      route: f.route,
      match: f.route.replace(/^\/\(chat\)/, ''),
    })),
  ];
  const accountEntries: NavEntry[] = [
    {
      key: 'account',
      label: 'Profil & abonnement',
      icon: 'userRound',
      route: '/(account)/account',
      match: '/account',
    },
  ];
  if (isAdmin) {
    accountEntries.push({
      key: 'admin',
      label: 'Panel admin IA',
      icon: 'settings',
      route: '/(admin)',
      match: '__admin__', // géré via le groupe de segments, pas le pathname
    });
  }

  const adminGroup = segments[0] === '(admin)';
  const isActive = (entry: NavEntry) =>
    entry.match === '__admin__' ? adminGroup : !adminGroup && pathname === entry.match;

  const pageLabel = shellPageLabel(pathname, adminGroup);
  const displayName =
    [personalInfo?.firstName, personalInfo?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    'Mon compte';

  const renderEntry = (entry: NavEntry) => {
    const active = isActive(entry);
    return (
      <Pressable
        key={entry.key}
        onPress={() => router.push(entry.route as never)}
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        style={({ hovered }: { hovered?: boolean }) => [
          styles.navItem,
          hovered && !active && styles.navItemHovered,
          active && styles.navItemActive,
        ]}
      >
        <View style={[styles.navIcon, active && styles.navIconActive]}>
          <Icon
            name={entry.icon}
            size={17}
            color={active ? tokens.colors.accentDeep : 'rgba(255,255,255,0.75)'}
          />
        </View>
        <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
          {entry.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.frame}>
      {/* ── Sidebar bleu nuit ── */}
      <View style={styles.sidebar}>
        <Pressable
          onPress={() => router.push('/')}
          accessibilityRole="link"
          accessibilityLabel="MedInfo AI — accueil"
          style={styles.logoRow}
        >
          <Logo size="sm" tone="light" />
        </Pressable>

        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initialsOf(personalInfo?.firstName ?? null, personalInfo?.lastName ?? null, user?.email ?? null)}
            </Text>
          </View>
          <View style={styles.userText}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.userRole} numberOfLines={1}>
              {isAdmin ? 'Administrateur' : PERSONA_LABEL[persona ?? 'public']}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.navScroll} contentContainerStyle={styles.navContent}>
          <Text style={styles.sectionLabel}>Mon espace</Text>
          {spaceEntries.map(renderEntry)}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Compte</Text>
          {accountEntries.map(renderEntry)}
        </ScrollView>

        {/* Rappel confidentialité (véridique : RLS own-row + sources gratuites). */}
        <View style={styles.privacyCard}>
          <View style={styles.privacyTitleRow}>
            <Icon name="shieldCheck" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.privacyTitle}>Données protégées</Text>
          </View>
          <Text style={styles.privacyText}>
            Tes contenus sont privés et isolés par compte. Les sources médicales restent
            accessibles à tous.
          </Text>
        </View>
      </View>

      {/* ── Colonne principale : top bar + écran ── */}
      <View style={styles.main}>
        <View style={styles.topBar}>
          <View style={styles.breadcrumb}>
            <Text style={styles.breadcrumbRoot}>MedInfo AI</Text>
            {pageLabel ? (
              <>
                <Text style={styles.breadcrumbSeparator}>/</Text>
                <Text style={styles.breadcrumbCurrent}>{pageLabel}</Text>
              </>
            ) : null}
          </View>
          <View style={styles.topBarRight}>
            <View style={styles.disclosurePill}>
              <Icon name="sparkles" size={13} color={tokens.colors.accentDeep} />
              <Text style={styles.disclosurePillText}>IA — information générale</Text>
            </View>
            <Pressable
              onPress={() => router.push('/(marketing)/contact' as never)}
              accessibilityRole="link"
              style={({ hovered }: { hovered?: boolean }) => [
                styles.helpButton,
                hovered && styles.helpButtonHovered,
              ]}
            >
              <Text style={styles.helpButtonText}>Aide</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: tokens.colors.background,
  },

  // ── Sidebar ──
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: tokens.colors.accentDarker,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.xl,
    paddingBottom: tokens.space.lg,
    gap: tokens.space.lg,
  },
  logoRow: { alignSelf: 'flex-start' },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: tokens.radius.lg,
    padding: tokens.space.md,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: tokens.radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
  },
  userText: { flex: 1, gap: 1 },
  userName: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  userRole: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.62)',
    fontSize: tokens.type.caption.fontSize,
  },
  navScroll: { flex: 1 },
  navContent: { gap: 2, paddingBottom: tokens.space.md },
  sectionLabel: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.48)',
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
    marginBottom: tokens.space.sm,
    marginTop: 2,
  },
  sectionLabelSpaced: { marginTop: tokens.space.xl },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.md,
    ...tokens.motion.transitionWeb,
  },
  navItemHovered: { backgroundColor: 'rgba(255,255,255,0.08)' },
  navItemActive: { backgroundColor: tokens.colors.surface, ...tokens.elevation.sm },
  navIcon: {
    width: 30,
    height: 30,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  navIconActive: { backgroundColor: tokens.colors.accentSurface },
  navLabel: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.85)',
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  navLabelActive: {
    color: tokens.colors.accentDeep,
    fontWeight: tokens.weight.semibold,
  },
  privacyCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: tokens.radius.lg,
    padding: tokens.space.md,
    gap: tokens.space.xs,
  },
  privacyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  privacyTitle: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.9)',
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  privacyText: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.62)',
    fontSize: tokens.type.micro.fontSize,
    lineHeight: tokens.type.micro.lineHeight + 2,
  },

  // ── Colonne principale ──
  main: { flex: 1, minWidth: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.lg,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  breadcrumbRoot: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  breadcrumbSeparator: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.borderStrong,
    fontSize: tokens.type.caption.fontSize,
  },
  breadcrumbCurrent: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  disclosurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
    backgroundColor: tokens.colors.accentSurface,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  disclosurePillText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  helpButton: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.xs + 2,
    ...tokens.motion.transitionWeb,
  },
  helpButtonHovered: { backgroundColor: tokens.colors.surfaceHover },
  helpButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  content: { flex: 1, minHeight: 0 },
});
