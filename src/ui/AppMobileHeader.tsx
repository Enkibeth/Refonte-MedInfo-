/**
 * Barre mobile des écrans de l'espace (outils, Vue d'ensemble) — même modèle que le chat.
 *
 *   [☰]          [icône Titre]          [action ou vide]
 *
 * ☰ ouvre la feuille de navigation (outils du rôle, espace, compte, ressources) : elle
 * remplace la barre d'onglets du bas, retirée sur demande de Hugo (2026-10) pour rendre
 * toute la hauteur de l'écran à l'outil. Visibilité des outils : featureVisibility.ts ;
 * l'autorisation réelle reste serveur.
 */
import { useState, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isAdminUserId } from '@/admin/index';
import { useSession } from '@/auth/AuthProvider';
import { visibleFeatures } from '@/ai/routing/featureVisibility';
import { featureTint } from '@/ui/featureChips';
import { Icon, type IconName } from '@/ui/icons';
import { HeaderIconButton, MenuRow, MenuSection, MobileSheet, sheetStyles } from '@/ui/MobileSheet';
import { mi } from '@/ui/responsive';
import { tokens } from '@/ui/tokens';
import { useWindowWidth } from '@/ui/useWindowWidth';

export function AppMobileHeader({
  title,
  icon,
  heading = true,
  right,
}: {
  title: string;
  icon?: IconName;
  /** Le titre est-il le titre de niveau 1 de l'écran ? (non pour la Vue d'ensemble, qui a le sien) */
  heading?: boolean;
  /** Action à droite (sinon un espace qui garde le titre centré). */
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <View style={[sheetStyles.bar, { paddingTop: tokens.space.xs + insets.top }]}>
      <HeaderIconButton icon="menu" label="Menu de navigation" expanded={open} onPress={() => setOpen(true)} />
      <View style={sheetStyles.title}>
        {icon ? <Icon name={icon} size={17} color={tokens.colors.accentDeep} /> : null}
        <Text
          style={sheetStyles.titleText}
          numberOfLines={1}
          {...(heading ? { accessibilityRole: 'header' as const, 'aria-level': 1 } : {})}
        >
          {title}
        </Text>
      </View>
      {right ?? <View style={sheetStyles.iconSlot} />}
      <NavigationSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/**
 * Barre de navigation des écrans qui portent déjà leur propre titre de niveau 1 (Vue
 * d'ensemble, ECOS) : affichée sous `below` px (le shell desktop prend le relais au-delà).
 * Web : rendue dans le DOM et masquée par le CSS au-delà du seuil (pré-rendu sans largeur).
 */
export function ScreenNavBar({ title, icon, below = tokens.layout.shell }: { title: string; icon?: IconName; below?: 640 | 920 | 1024 }) {
  const width = useWindowWidth();
  const bar = <AppMobileHeader title={title} icon={icon} heading={false} />;
  if (Platform.OS !== 'web') return width < below ? bar : null;
  return <View {...mi(`lt${below}`)}>{bar}</View>;
}

/** Feuille de navigation de l'espace (aussi ouverte depuis le menu du chat). */
export function NavigationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const segments = useSegments();
  const { persona, user, session, loading, bootDegraded } = useSession();
  const isAdmin = user ? isAdminUserId(user.id) : false;
  // Session en chargement ou en récupération : jamais traitée comme un visiteur (CLAUDE.md).
  const isGuest = !session && !loading && !bootDegraded;
  const current = (segments as string[])[segments.length - 1];
  const tools = visibleFeatures(persona, { isAdmin, isGuest });

  const go = (route: string) => {
    onClose();
    router.push(route as never);
  };

  return (
    <MobileSheet visible={visible} onClose={onClose} label="Menu de navigation">
      <MenuSection title={isGuest ? 'Essai sans inscription' : 'Outils'}>
        {tools.map((tool) => {
          const tint = featureTint(tool.id);
          return (
            <MenuRow
              key={tool.id}
              icon={tool.icon}
              iconColor={tint.fg}
              iconBackground={tint.bg}
              label={tool.label}
              current={tool.id === current}
              onPress={() => go(tool.route)}
            />
          );
        })}
      </MenuSection>
      {isGuest ? (
        <MenuSection title="Compte">
          <MenuRow icon="userRound" label="Se connecter ou créer un compte" chevron onPress={() => go('/(auth)/sign-in')} />
          <MenuRow icon="home" label="Accueil du site" chevron onPress={() => go('/')} />
        </MenuSection>
      ) : (
        <>
          <MenuSection title="Mon espace">
            <MenuRow icon="home" label="Vue d’ensemble" current={current === 'dashboard'} onPress={() => go('/(chat)/dashboard')} />
            <MenuRow icon="userRound" label="Mon compte" chevron onPress={() => go('/(account)/account')} />
            {isAdmin ? <MenuRow icon="settings" label="Administration IA" chevron onPress={() => go('/admin')} /> : null}
          </MenuSection>
          <MenuSection title="Ressources">
            <MenuRow icon="bookOpen" label="Blog santé" chevron onPress={() => go('/(marketing)/blog')} />
            <MenuRow icon="scale" label="Tarifs" chevron onPress={() => go('/(billing)/pricing')} />
            <MenuRow icon="globe" label="Accueil du site" chevron onPress={() => go('/')} />
          </MenuSection>
        </>
      )}
    </MobileSheet>
  );
}
