/**
 * Garde de fonctionnalité par rôle (côté écran).
 *
 * Affiche `children` uniquement si la fonctionnalité est visible pour la persona
 * courante (cf featureVisibility.ts). Sinon, écran neutre « non disponible pour
 * ton rôle » avec lien vers le changement de rôle.
 *
 * Défense en profondeur : c'est un garde d'ERGONOMIE (déep-link / accès direct).
 * L'autorisation réelle des routes IA reste dérivée du profil vérifié côté serveur.
 */
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import {
  getFeatureMeta,
  isFeatureVisible,
  type AppFeatureId,
} from '@/ai/routing/featureVisibility';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

const PERSONA_LABELS: Record<string, string> = {
  public: 'Grand public',
  student: 'Étudiant en santé',
  professional: 'Professionnel de santé',
};

export function RoleGate({
  feature,
  children,
}: {
  feature: AppFeatureId;
  children: ReactNode;
}) {
  const { persona, user, session, loading, bootDegraded } = useSession();

  // État d'authentification incomplet : amorçage en cours, ou session connue dont le
  // profil (persona) n'est pas encore appliqué — sans cette seconde condition, un étudiant
  // voyait brièvement « pas disponible pour ton rôle ». Borné : le profil est plafonné dans
  // le temps et retombe sur un profil neutre, la persona ne reste jamais nulle.
  if (loading || (session && !persona)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.colors.accent} />
      </View>
    );
  }

  // Session pas encore récupérée alors que ce navigateur en avait une (cf. bootGuard) :
  // on ne prétend PAS que l'outil est réservé aux comptes — on dit la vérité et on offre
  // la sortie (réessayer, ou réinitialiser la session, ce que l'utilisateur faisait en
  // vidant les cookies à la main).
  if (bootDegraded && !session) {
    return <SessionRecovery />;
  }

  const isAdmin = user ? isAdminUserId(user.id) : false;
  // Visiteur non connecté : seul le chat lui est ouvert (essai sans inscription).
  const isGuest = !session;
  if (isFeatureVisible(feature, persona, { isAdmin, isGuest })) {
    return <>{children}</>;
  }

  return <RoleUnavailable feature={feature} persona={persona} guest={isGuest} />;
}

/**
 * Session en cours de récupération (amorçage dégradé) : message honnête + deux sorties.
 * Réutilisable par tout écran gardé — c'est ce qui remplace le « chargement infini ».
 */
export function SessionRecovery() {
  const { retryAuthBoot, resetLocalSession } = useSession();
  const [busy, setBusy] = useState<'retry' | 'reset' | null>(null);

  const run = async (kind: 'retry' | 'reset') => {
    setBusy(kind);
    try {
      if (kind === 'retry') await retryAuthBoot();
      else await resetLocalSession();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <Icon name="refresh" size={26} color={tokens.colors.accentDeep} />
        </View>
        <Text style={styles.title}>Session en cours de récupération</Text>
        <Text style={styles.text}>
          Ta session n’a pas pu être rétablie (connexion instable ou session expirée).
          Réessaie, ou réinitialise la session pour te reconnecter proprement.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void run('retry')}
          disabled={busy !== null}
          accessibilityRole="button"
        >
          {busy === 'retry' ? (
            <ActivityIndicator color={tokens.colors.onAccent} size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Réessayer</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => void run('reset')}
          disabled={busy !== null}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryLink}>
            {busy === 'reset' ? 'Réinitialisation…' : 'Réinitialiser la session'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RoleUnavailable({
  feature,
  persona,
  guest,
}: {
  feature: AppFeatureId;
  persona: string | null | undefined;
  guest?: boolean;
}) {
  const meta = getFeatureMeta(feature);
  const roleLabel = persona ? PERSONA_LABELS[persona] ?? persona : 'ton rôle';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <Icon name={meta?.icon ?? 'lock'} size={26} color={tokens.colors.accentDeep} />
        </View>
        <Text style={styles.title}>{meta?.label ?? 'Fonctionnalité'}</Text>
        <Text style={styles.text}>
          {guest
            ? `Cet outil est réservé aux comptes MedInfo AI. Créez un compte gratuit pour y accéder.${meta ? ` ${meta.description}` : ''}`
            : `Cet outil n’est pas disponible pour ton rôle actuel (${roleLabel}).${meta ? ` ${meta.description}` : ''}`}
        </Text>
        <Link
          href={guest ? '/(auth)/sign-in?mode=signup' : '/(account)/choose-role'}
          style={styles.primaryLink}
        >
          {guest ? 'Créer un compte' : 'Changer de rôle'}
        </Link>
        <Link href="/(chat)/chat" style={styles.secondaryLink}>
          Retour au chat
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.background },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: tokens.space.xl,
    backgroundColor: tokens.colors.background,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.xl,
    alignItems: 'center',
    gap: tokens.space.md,
    ...tokens.elevation.md,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.type.h3.letterSpacing,
    textAlign: 'center',
  },
  text: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    textAlign: 'center',
    maxWidth: 360,
  },
  primaryLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.lg,
    overflow: 'hidden',
    marginTop: tokens.space.sm,
  },
  secondaryLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  primaryButton: {
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.lg,
    marginTop: tokens.space.sm,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
});
