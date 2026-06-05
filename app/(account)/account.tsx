import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { getSupabaseClient } from '@/db/supabase';
import { INTENDED_PURPOSE } from '@/compliance/disclosures';
import { tokens } from '@/ui/tokens';

/**
 * Compte — email + persona (lue depuis profiles via RLS). UI polie (scaffold Codex
 * intégré à l'étape 3). `professional` : encart neutre « reporté » (ADR-0006), aucune
 * fonctionnalité pro servie. Aucun profil santé ni wizard (01_REGULATION §5).
 */
const personaLabels = {
  public: 'public',
  student: 'student',
  professional: 'professional',
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

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setErrorMessage(null);

    try {
      await signOut();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de fermer la session pour le moment.',
      );
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Compte</Text>
        <Text style={styles.title}>Paramètres de session</Text>
        <Text style={styles.body}>
          Retrouve les informations de connexion associées à ta session MedInfo AI.
        </Text>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email</Text>
            {loading ? (
              <ActivityIndicator color={tokens.colors.accent} />
            ) : (
              <Text style={styles.detailValue}>{user?.email ?? 'Non connecté'}</Text>
            )}
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Persona</Text>
            <Text style={styles.badge}>{persona ? personaLabels[persona] : '—'}</Text>
          </View>
        </View>

        {user ? (
          <View style={styles.professionalBox}>
            <Text style={styles.professionalTitle}>Abonnement</Text>
            <Text style={styles.professionalText}>
              {isPaid
                ? `Offre active : ${subscription?.plan} (${subscription?.status}).`
                : 'Offre gratuite. Les sources restent gratuites pour tous.'}
            </Text>
            <Link href="/(billing)/pricing" style={styles.inlineLink}>
              Voir les offres
            </Link>
          </View>
        ) : null}

        {user ? (
          <View style={styles.professionalBox}>
            <Text style={styles.professionalTitle}>Rôle</Text>
            <Text style={styles.professionalText}>
              Choisis ou change ton rôle (public / étudiant / professionnel).
            </Text>
            <Link href="/(account)/choose-role" style={styles.inlineLink}>
              Gérer mon rôle
            </Link>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={loading || signingOut || !user}
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.button,
            loading || signingOut || !user ? styles.buttonDisabled : null,
            pressed && !loading && !signingOut && user ? styles.buttonPressed : null,
          ]}
        >
          {signingOut ? <ActivityIndicator color={tokens.colors.surface} /> : null}
          <Text style={styles.buttonText}>
            {signingOut ? 'Déconnexion…' : 'Se déconnecter'}
          </Text>
        </Pressable>

        {errorMessage ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorTitle}>Erreur</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {!loading && !user ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>Aucune session active.</Text>
            <Link href="/(auth)/sign-in" style={styles.inlineLink}>
              Se connecter
            </Link>
          </View>
        ) : null}

        <View style={styles.purposeBox}>
          <Text style={styles.purposeTitle}>Finalité prévue</Text>
          <Text style={styles.purposeText}>{INTENDED_PURPOSE}</Text>
        </View>

        <View style={styles.footer}>
          <Link href="/" style={styles.inlineLink}>
            Retour accueil
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: tokens.colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 760,
    borderRadius: 28,
    padding: 28,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  eyebrow: {
    color: tokens.colors.accent,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  title: {
    color: tokens.colors.text,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 14,
  },
  body: {
    color: tokens.colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  details: {
    gap: 12,
    marginTop: 28,
  },
  detailRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    padding: 16,
    gap: 8,
  },
  detailLabel: {
    color: tokens.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailValue: {
    color: tokens.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    color: tokens.colors.accent,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: '800',
  },
  professionalBox: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: 16,
  },
  professionalTitle: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  professionalText: {
    color: tokens.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    minHeight: 52,
    marginTop: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: 18,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.86,
  },
  buttonText: {
    color: tokens.colors.surface,
    fontSize: 16,
    fontWeight: '800',
  },
  errorBox: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: tokens.colors.warningBackground,
    padding: 16,
  },
  errorTitle: {
    color: tokens.colors.warningText,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  errorText: {
    color: tokens.colors.warningText,
    fontSize: 15,
    lineHeight: 22,
  },
  statusBox: {
    gap: 10,
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    padding: 16,
  },
  statusText: {
    color: tokens.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  purposeBox: {
    marginTop: 24,
    borderRadius: 18,
    backgroundColor: tokens.colors.warningBackground,
    padding: 16,
  },
  purposeTitle: {
    color: tokens.colors.warningText,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  purposeText: {
    color: tokens.colors.warningText,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    marginTop: 22,
  },
  inlineLink: {
    color: tokens.colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
});
