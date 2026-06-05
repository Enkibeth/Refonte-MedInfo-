import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { plansForPersona, type BillingPlanId } from '@/billing/plans';
import { shouldShowWebBilling } from '@/billing/surface';
import { tokens } from '@/ui/tokens';

/**
 * Offres (06_BILLING §1, §3, §5).
 * - Web-first / ZÉRO IAP : sur natif, AUCUN prix ni bouton d'achat (Apple 3.1.3(b)).
 * - Les sources (HAS/ANSM…) restent gratuites pour tous : le paywall ne touche que les quotas
 *   et des features avancées (06_BILLING §5, critique). Bandeau explicite ci-dessous.
 * Aucune donnée de santé.
 */
export default function PricingScreen() {
  const { session, persona } = useSession();
  const [loadingPlan, setLoadingPlan] = useState<BillingPlanId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const webBilling = shouldShowWebBilling(Platform.OS);
  const plans = plansForPersona(persona ?? 'public');

  async function handleSubscribe(plan: BillingPlanId) {
    if (loadingPlan) return;
    setErrorMessage(null);

    const token = session?.access_token;
    if (!token) {
      setErrorMessage('Connecte-toi pour gérer ton abonnement.');
      return;
    }

    setLoadingPlan(plan);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setErrorMessage(data.error ?? 'Impossible de démarrer le paiement.');
        return;
      }
      await Linking.openURL(data.url);
    } catch {
      setErrorMessage('Erreur réseau lors du démarrage du paiement.');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Offres</Text>
        <Text style={styles.title}>Choisis ton offre</Text>

        <View style={styles.sourcesBox}>
          <Text style={styles.sourcesText}>
            Les références (HAS, ANSM…) restent gratuites et visibles pour tous, abonné ou non.
            Un abonnement lève seulement la limite de messages et débloque des fonctions avancées.
          </Text>
        </View>

        {!webBilling ? (
          <View style={styles.nativeBox}>
            <Text style={styles.nativeText}>
              La gestion de l'abonnement se fait sur le site web. L'application mobile donne accès à
              ton compte déjà souscrit.
            </Text>
          </View>
        ) : (
          <View style={styles.plans}>
            {plans.map((plan) => (
              <View key={plan.id} style={styles.plan}>
                <Text style={styles.planLabel}>{plan.label}</Text>
                <Text style={styles.planPrice}>{plan.priceLabel}</Text>
                <View style={styles.perks}>
                  {plan.perks.map((perk) => (
                    <Text key={perk} style={styles.perk}>
                      • {perk}
                    </Text>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={loadingPlan !== null}
                  onPress={() => handleSubscribe(plan.id)}
                  style={({ pressed }) => [
                    styles.button,
                    loadingPlan !== null ? styles.buttonDisabled : null,
                    pressed && loadingPlan === null ? styles.buttonPressed : null,
                  ]}
                >
                  {loadingPlan === plan.id ? (
                    <ActivityIndicator color={tokens.colors.surface} />
                  ) : null}
                  <Text style={styles.buttonText}>S'abonner</Text>
                </Pressable>
              </View>
            ))}
            {plans.length === 0 ? (
              <Text style={styles.nativeText}>Aucune offre disponible pour ce profil.</Text>
            ) : null}
            <Text style={styles.vatNote}>TVA non applicable, article 293 B du CGI.</Text>
          </View>
        )}

        {errorMessage ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Link href="/(account)/account" style={styles.inlineLink}>
            Retour au compte
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
    marginBottom: 18,
  },
  sourcesBox: {
    borderRadius: 18,
    backgroundColor: tokens.colors.warningBackground,
    padding: 16,
    marginBottom: 18,
  },
  sourcesText: {
    color: tokens.colors.warningText,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  nativeBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    padding: 16,
  },
  nativeText: {
    color: tokens.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  plans: {
    gap: 16,
  },
  plan: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    padding: 18,
    gap: 8,
  },
  planLabel: {
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  planPrice: {
    color: tokens.colors.accent,
    fontSize: 22,
    fontWeight: '800',
  },
  perks: {
    gap: 4,
    marginVertical: 6,
  },
  perk: {
    color: tokens.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    minHeight: 48,
    marginTop: 8,
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
  vatNote: {
    color: tokens.colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  errorBox: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: tokens.colors.warningBackground,
    padding: 16,
  },
  errorText: {
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
