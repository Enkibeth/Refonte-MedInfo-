import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { plansForPersona, type BillingPlanId } from '@/billing/plans';
import { shouldShowWebBilling } from '@/billing/surface';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Logo } from '@/ui/Logo';
import { Screen } from '@/ui/Screen';
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
    <Screen maxWidth={640}>
      <View style={styles.brandHeader}>
        <Logo size="sm" />
      </View>
      <Text style={styles.title}>Offres</Text>

      <View style={styles.sourcesBox}>
        <View style={styles.sourcesAccent} />
        <Text style={styles.sourcesText}>
          Les références (HAS, ANSM…) restent gratuites et visibles pour tous, abonné ou non.
          Un abonnement lève seulement la limite de messages et débloque des fonctions avancées.
        </Text>
      </View>

      {!webBilling ? (
        <Card style={styles.section}>
          <Text style={styles.nativeText}>
            La gestion de l'abonnement se fait sur le site web. L'application mobile donne accès à
            ton compte déjà souscrit.
          </Text>
        </Card>
      ) : (
        <View style={styles.plans}>
          {plans.map((plan) => (
            <Card key={plan.id} style={styles.plan}>
              <Text style={styles.planLabel}>{plan.label}</Text>
              <Text style={styles.planPrice}>{plan.priceLabel}</Text>
              <View style={styles.perks}>
                {plan.perks.map((perk) => (
                  <View key={perk} style={styles.perkRow}>
                    <View style={styles.perkDot} />
                    <Text style={styles.perk}>{perk}</Text>
                  </View>
                ))}
              </View>
              <Button
                label="S'abonner"
                loading={loadingPlan === plan.id}
                disabled={loadingPlan !== null}
                onPress={() => handleSubscribe(plan.id)}
                style={styles.planAction}
              />
            </Card>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandHeader: { marginBottom: tokens.space.lg },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h1.fontSize,
    lineHeight: tokens.type.h1.lineHeight,
    letterSpacing: tokens.type.h1.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginBottom: tokens.space.lg,
  },
  sourcesBox: {
    flexDirection: 'row',
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.accentSurface,
    marginBottom: tokens.space.lg,
  },
  sourcesAccent: { width: 4, backgroundColor: tokens.colors.accent },
  sourcesText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
    fontWeight: tokens.weight.medium,
    padding: tokens.space.lg,
  },
  section: { marginTop: tokens.space.sm },
  nativeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  plans: { gap: tokens.space.lg },
  plan: { gap: tokens.space.xs },
  planLabel: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  planPrice: {
    fontFamily: tokens.font.display,
    color: tokens.colors.accent,
    fontSize: tokens.type.h1.fontSize,
    letterSpacing: tokens.type.h1.letterSpacing,
    fontWeight: tokens.weight.bold,
    marginTop: tokens.space.xs,
  },
  perks: { gap: tokens.space.sm, marginVertical: tokens.space.md },
  perkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.sm },
  perkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.accent,
    marginTop: 8,
  },
  perk: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  planAction: { marginTop: tokens.space.sm },
  vatNote: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginTop: tokens.space.xs,
  },
  errorBox: {
    marginTop: tokens.space.lg,
    borderRadius: tokens.radius.md,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.danger,
    backgroundColor: tokens.colors.dangerBackground,
    padding: tokens.space.lg,
  },
  errorText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
  },
  footer: { marginTop: tokens.space.xl },
  inlineLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});
