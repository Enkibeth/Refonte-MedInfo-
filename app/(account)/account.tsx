import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { getSupabaseClient } from '@/db/supabase';
import { INTENDED_PURPOSE } from '@/compliance/disclosures';
import { isAdminUserId } from '@/admin/index';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Logo } from '@/ui/Logo';
import { Screen } from '@/ui/Screen';
import { tokens } from '@/ui/tokens';

/**
 * Compte — email + persona (lue depuis profiles via RLS). UI polie (scaffold Codex
 * intégré à l'étape 3). `professional` : encart neutre « reporté » (ADR-0006), aucune
 * fonctionnalité pro servie. Aucun profil santé ni wizard (01_REGULATION §5).
 */
const personaLabels = {
  public: 'Grand public',
  student: 'Étudiant en santé',
  professional: 'Professionnel de santé',
} as const;

export default function AccountScreen() {
  const { loading, persona, signOut, user } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Abonnement lu via RLS own-row (06_BILLING §6). Aucune donnée de santé.
  const [subscription, setSubscription] = useState<{ plan: string; status: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data } = await getSupabaseClient()
          .from('subscriptions')
          .select('plan, status')
          .eq('user_id', user.id)
          .maybeSingle();
        if (active) setSubscription(data ? { plan: data.plan, status: data.status } : null);
      } catch {
        if (active) setSubscription(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const isPaid = subscription?.status === 'active' || subscription?.status === 'trialing';
  const isAdmin = user ? isAdminUserId(user.id) : false;

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setErrorMessage(null);

    try {
      await signOut();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Impossible de fermer la session pour le moment.',
      );
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen maxWidth={640}>
      <View style={styles.brandHeader}>
        <Logo size="sm" />
      </View>
      <Text style={styles.title}>Mon compte</Text>
      <Text style={styles.body}>
        Informations de connexion et préférences associées à ta session MedInfo AI.
      </Text>

      <Card style={styles.section}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email</Text>
          {loading ? (
            <ActivityIndicator color={tokens.colors.accent} />
          ) : (
            <Text style={styles.detailValue}>{user?.email ?? 'Non connecté'}</Text>
          )}
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Rôle</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{persona ? personaLabels[persona] : '—'}</Text>
          </View>
        </View>
      </Card>

      {user ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Abonnement</Text>
          <Text style={styles.sectionText}>
            {isPaid
              ? `Offre active : ${subscription?.plan} (${subscription?.status}).`
              : 'Offre gratuite. Les sources restent gratuites pour tous.'}
          </Text>
          <Link href="/(billing)/pricing" style={styles.inlineLink}>
            Voir les offres
          </Link>
        </Card>
      ) : null}

      {user ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Rôle</Text>
          <Text style={styles.sectionText}>
            Choisis ou change ton rôle (public / étudiant / professionnel).
          </Text>
          <Link href="/(account)/choose-role" style={styles.inlineLink}>
            Gérer mon rôle
          </Link>
        </Card>
      ) : null}

      {user ? (
        <Button
          label={signingOut ? 'Déconnexion…' : 'Se déconnecter'}
          variant="secondary"
          disabled={loading || signingOut}
          loading={signingOut}
          onPress={handleSignOut}
          style={styles.signOut}
        />
      ) : null}

      {errorMessage ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={styles.errorTitle}>Erreur</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {!loading && !user ? (
        <Card style={styles.section}>
          <Text style={styles.sectionText}>Aucune session active.</Text>
          <Link href="/(auth)/sign-in" style={styles.inlineLink}>
            Se connecter
          </Link>
        </Card>
      ) : null}

      <View style={styles.purposeBox}>
        <View style={styles.purposeAccent} />
        <View style={styles.purposeContent}>
          <Text style={styles.purposeTitle}>Finalité prévue</Text>
          <Text style={styles.purposeText}>{INTENDED_PURPOSE}</Text>
        </View>
      </View>

      {isAdmin ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Administration</Text>
          <Text style={styles.sectionText}>
            Configurer les modèles IA et éditer les prompts système.
          </Text>
          <Link href="/(admin)" style={styles.adminLink}>
            Ouvrir le panel admin IA
          </Link>
        </Card>
      ) : null}

      <View style={styles.footer}>
        <Link href="/" style={styles.inlineLink}>
          Retour à l'accueil
        </Link>
        <Link href="/(legal)/legal" style={styles.inlineLink}>
          Informations légales
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandHeader: { marginBottom: tokens.space.lg },
  title: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h1.fontSize,
    lineHeight: tokens.type.h1.lineHeight,
    letterSpacing: tokens.type.h1.letterSpacing,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.sm,
  },
  body: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  section: { marginTop: tokens.space.lg },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.space.xs,
  },
  divider: { height: 1, backgroundColor: tokens.colors.border, marginVertical: tokens.space.md },
  detailLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  detailValue: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    fontWeight: tokens.weight.semibold,
    flexShrink: 1,
    textAlign: 'right',
  },
  badge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  badgeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  sectionTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.xs,
  },
  sectionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    marginBottom: tokens.space.md,
  },
  signOut: { marginTop: tokens.space.xl },
  errorBox: {
    marginTop: tokens.space.lg,
    borderRadius: tokens.radius.md,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.danger,
    backgroundColor: tokens.colors.dangerBackground,
    padding: tokens.space.lg,
  },
  errorTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    marginBottom: 2,
  },
  errorText: { fontFamily: tokens.font.sans, color: tokens.colors.danger, fontSize: tokens.type.label.fontSize, lineHeight: 21 },
  purposeBox: {
    flexDirection: 'row',
    marginTop: tokens.space.xl,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.warningBackground,
  },
  purposeAccent: { width: 4, backgroundColor: tokens.colors.warningText },
  purposeContent: { flex: 1, padding: tokens.space.lg },
  purposeTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.warningText,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.xs,
  },
  purposeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.warningText,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
  },
  footer: {
    marginTop: tokens.space.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.lg,
  },
  inlineLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  adminLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
    backgroundColor: tokens.colors.accentDarker,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm + 2,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
});
