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
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import {
  getFeatureMeta,
  isFeatureVisible,
  type AppFeatureId,
} from '@/ai/routing/featureVisibility';
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
  const { persona, user, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.colors.accent} />
      </View>
    );
  }

  const isAdmin = user ? isAdminUserId(user.id) : false;
  if (isFeatureVisible(feature, persona, { isAdmin })) {
    return <>{children}</>;
  }

  return <RoleUnavailable feature={feature} persona={persona} />;
}

function RoleUnavailable({
  feature,
  persona,
}: {
  feature: AppFeatureId;
  persona: string | null | undefined;
}) {
  const meta = getFeatureMeta(feature);
  const roleLabel = persona ? PERSONA_LABELS[persona] ?? persona : 'ton rôle';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.emoji}>{meta?.emoji ?? '🔒'}</Text>
        <Text style={styles.title}>{meta?.label ?? 'Fonctionnalité'}</Text>
        <Text style={styles.text}>
          Cet outil n’est pas disponible pour ton rôle actuel ({roleLabel}).
          {meta ? ` ${meta.description}` : ''}
        </Text>
        <Link href="/(account)/choose-role" style={styles.primaryLink}>
          Changer de rôle
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
  emoji: { fontSize: 40 },
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
});
