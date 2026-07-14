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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
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
/** Largeur du rail replié : icônes seules, l'écran (chat, outils) récupère la place. */
const SIDEBAR_WIDTH_COLLAPSED = 72;

/** Préférence de repli persistée (web only — le shell n'existe que sur desktop web). */
const SIDEBAR_COLLAPSED_KEY = 'medinfo.shell.sidebarCollapsed';

function readCollapsedPref(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function storeCollapsedPref(collapsed: boolean) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Stockage indisponible (navigation privée…) : préférence non persistée, sans gravité.
  }
}

/**
 * Indice « une session existait ici » : pendant l'hydratation de la session au
 * rechargement, on réserve la place de la sidebar (squelette) au lieu de rendre
 * le contenu pleine largeur puis de le décaler d'un coup. Auto-réparé : posé
 * quand une session est confirmée, retiré dès qu'une absence de session est
 * confirmée (déconnexion, autre navigateur…).
 */
const SHELL_SEEN_KEY = 'medinfo.shell.hadSession';

function readHadSession(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SHELL_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

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
  const { session, user, persona, personalInfo, loading } = useSession();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const router = useRouter();
  // Sidebar repliable (demande Hugo) : le chat et les outils récupèrent la largeur.
  const [collapsed, setCollapsed] = useState(readCollapsedPref);
  // Tooltip du rail replié : libellé + position verticale (mesurée en fenêtre).
  const [railTip, setRailTip] = useState<{ label: string; y: number } | null>(null);
  const entryRefs = useRef(new Map<string, View | null>());

  const isAdmin = user ? isAdminUserId(user.id) : false;
  const inShellGroup = SHELL_GROUPS.has(segments[0] ?? '');
  const desktop = Platform.OS === 'web' && width >= SHELL_BREAKPOINT;
  const shellReady = desktop && !!session && inShellGroup;
  // Hydratation au rechargement : session pas encore connue mais probable → on
  // réserve la place de la sidebar pour éviter le saut de layout à son arrivée.
  const shellPending = desktop && inShellGroup && !session && loading && readHadSession();

  const toggleCollapsed = useCallback(() => {
    setRailTip(null);
    setCollapsed((prev) => {
      storeCollapsedPref(!prev);
      return !prev;
    });
  }, []);

  // Mémorise si une session a été confirmée sur ce navigateur (cf. SHELL_SEEN_KEY).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || loading) return;
    try {
      if (session) window.localStorage.setItem(SHELL_SEEN_KEY, '1');
      else window.localStorage.removeItem(SHELL_SEEN_KEY);
    } catch {
      // Stockage indisponible : l'indice n'est simplement pas mémorisé.
    }
  }, [session, loading]);

  // Raccourci clavier Ctrl/Cmd + B : replier/déplier la sidebar (hors saisie).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !shellReady) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'b') return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) return;
      event.preventDefault();
      toggleCollapsed();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shellReady, toggleCollapsed]);

  if (shellPending) {
    // Squelette du shell : mêmes dimensions que la vraie sidebar/top bar, aucun
    // contenu dépendant du compte (persona inconnue tant que la session charge).
    return (
      <View style={styles.frame}>
        <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
          <View style={[styles.skeletonBadge, collapsed && styles.logoRowCollapsed]} />
          {!collapsed ? <View style={styles.skeletonCard} /> : null}
          <View style={styles.skeletonRows}>
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
          </View>
        </View>
        <View style={styles.main}>
          <View style={styles.topBar}>
            <View style={styles.breadcrumb}>
              <Text style={styles.breadcrumbRoot}>MedInfo AI</Text>
            </View>
          </View>
          <View style={styles.content}>{children}</View>
        </View>
      </View>
    );
  }

  if (!shellReady) return <>{children}</>;

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
        ref={(node) => {
          entryRefs.current.set(entry.key, node as unknown as View | null);
        }}
        onPress={() => router.push(entry.route as never)}
        onHoverIn={() => {
          if (!collapsed) return;
          // Tooltip rendu HORS du ScrollView (qui rognerait tout débordement) :
          // position mesurée en fenêtre — le frame couvre tout le viewport.
          const node = entryRefs.current.get(entry.key) as unknown as {
            measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
          } | null;
          node?.measureInWindow?.((_x, y, _w, h) => {
            setRailTip({ label: entry.label, y: y + h / 2 });
          });
        }}
        onHoverOut={() => setRailTip(null)}
        accessibilityRole="link"
        accessibilityLabel={entry.label}
        accessibilityState={{ selected: active }}
        style={({ hovered }: { hovered?: boolean }) => [
          styles.navItem,
          collapsed && styles.navItemCollapsed,
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
        {collapsed ? null : (
          <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
            {entry.label}
          </Text>
        )}
      </Pressable>
    );
  };

  const collapseToggle = (
    <Pressable
      onPress={toggleCollapsed}
      accessibilityRole="button"
      accessibilityLabel={collapsed ? 'Déplier le menu latéral' : 'Replier le menu latéral'}
      accessibilityHint="Raccourci : Ctrl ou Cmd + B"
      style={({ hovered }: { hovered?: boolean }) => [
        styles.collapseButton,
        hovered && styles.collapseButtonHovered,
      ]}
    >
      <Icon name="panelLeft" size={16} color="rgba(255,255,255,0.75)" />
    </Pressable>
  );

  return (
    <View style={styles.frame}>
      {/* ── Sidebar bleu nuit (repliable en rail d'icônes) ── */}
      <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
        <View style={[styles.sidebarHeader, collapsed && styles.sidebarHeaderCollapsed]}>
          <Pressable
            onPress={() => router.push('/')}
            accessibilityRole="link"
            accessibilityLabel="MedInfo AI — accueil"
            style={[styles.logoRow, collapsed && styles.logoRowCollapsed]}
          >
            {/* Illustration de l'équipe (demande Hugo) — même pastille que le header
                public (src/ui/LandingHeader.tsx). Asset relatif (piège alias @/). */}
            <Image
              source={require('../../../assets/brand/team-illustration.png')}
              style={styles.teamBadge}
              resizeMode="cover"
              accessibilityRole="image"
              accessibilityLabel="L'équipe MedInfo AI"
            />
            {collapsed ? null : <Logo size="sm" tone="light" />}
          </Pressable>
          {collapseToggle}
        </View>

        {collapsed ? (
          <View style={[styles.avatar, styles.avatarCollapsed]}>
            <Text style={styles.avatarText}>
              {initialsOf(personalInfo?.firstName ?? null, personalInfo?.lastName ?? null, user?.email ?? null)}
            </Text>
          </View>
        ) : (
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
        )}

        <ScrollView style={styles.navScroll} contentContainerStyle={styles.navContent}>
          {collapsed ? null : <Text style={styles.sectionLabel}>Mon espace</Text>}
          {spaceEntries.map(renderEntry)}
          {collapsed ? (
            <View style={styles.navDivider} />
          ) : (
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Compte</Text>
          )}
          {accountEntries.map(renderEntry)}
        </ScrollView>

        {/* Rappel confidentialité (véridique : RLS own-row + sources gratuites). */}
        {collapsed ? null : (
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
        )}
      </View>

      {/* ── Colonne principale : top bar + écran ── */}
      <View style={styles.main}>
        <View style={styles.topBar}>
          <View style={styles.breadcrumb}>
            {/* Racine cliquable : retour à la Vue d'ensemble. */}
            <Pressable
              onPress={() => router.push('/(chat)/dashboard' as never)}
              accessibilityRole="link"
              accessibilityLabel="Vue d’ensemble"
            >
              {({ hovered }: { hovered?: boolean }) => (
                <Text style={[styles.breadcrumbRoot, hovered && styles.breadcrumbRootHovered]}>
                  MedInfo AI
                </Text>
              )}
            </Pressable>
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

      {/* Tooltip du rail replié (au niveau du frame : le ScrollView de la nav
          rognerait tout débordement horizontal). */}
      {collapsed && railTip ? (
        <View pointerEvents="none" style={[styles.railTooltip, { top: railTip.y - 14 }]}>
          <Text style={styles.railTooltipText} numberOfLines={1}>
            {railTip.label}
          </Text>
        </View>
      ) : null}
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
    // Repli/dépli fluide (web only — le shell n'existe que là).
    ...(Platform.OS === 'web'
      ? {
          transitionProperty: 'width, padding',
          transitionDuration: '200ms',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }
      : null),
  },
  sidebarCollapsed: {
    width: SIDEBAR_WIDTH_COLLAPSED,
    paddingHorizontal: tokens.space.sm,
    alignItems: 'stretch',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
  },
  sidebarHeaderCollapsed: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: tokens.space.md,
  },
  collapseButton: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    ...tokens.motion.transitionWeb,
  },
  collapseButtonHovered: { backgroundColor: 'rgba(255,255,255,0.16)' },
  logoRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
  },
  logoRowCollapsed: { alignSelf: 'center' },
  teamBadge: {
    width: 46,
    height: 46,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
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
  avatarCollapsed: { alignSelf: 'center' },
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
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  navDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginVertical: tokens.space.md,
    marginHorizontal: tokens.space.sm,
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
  breadcrumbRootHovered: {
    color: tokens.colors.accentDeep,
    textDecorationLine: 'underline',
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

  // ── Tooltip du rail replié ──
  railTooltip: {
    position: 'absolute',
    left: SIDEBAR_WIDTH_COLLAPSED + 6,
    height: 28,
    justifyContent: 'center',
    backgroundColor: tokens.colors.accentDarker,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.space.md,
    zIndex: 100,
    ...tokens.elevation.md,
  },
  railTooltipText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },

  // ── Squelette du shell (hydratation de session) ──
  skeletonBadge: {
    width: 46,
    height: 46,
    borderRadius: tokens.radius.md,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  skeletonCard: {
    height: 64,
    borderRadius: tokens.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skeletonRows: { gap: tokens.space.sm },
  skeletonRow: {
    height: 38,
    borderRadius: tokens.radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
