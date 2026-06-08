import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { Persona } from '@/ai/prompts/_schema';
import { useSession } from '@/auth/AuthProvider';
import { getSupabaseClient } from '@/db/supabase';
import { INTENDED_PURPOSE } from '@/compliance/disclosures';
import { isAdminUserId } from '@/admin/index';
import { visibleFeatures } from '@/ai/routing/featureVisibility';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PersonalInfoForm } from '@/ui/PersonalInfoForm';
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

const VERIFIABLE_PERSONAS: Persona[] = ['public', 'student', 'professional'];

export default function AccountScreen() {
  const { loading, persona, status, verifiedPersonas, requestRole, signOut, user } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [switching, setSwitching] = useState<Persona | null>(null);
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

  // Bascule du rôle ACTIF vers un rôle déjà validé (sans re-vérification) → ouvre son chat.
  async function switchTo(target: Persona) {
    if (switching || target === persona) return;
    setSwitching(target);
    setErrorMessage(null);
    const res = await requestRole(target);
    setSwitching(null);
    if (res.error) {
      setErrorMessage(res.error);
      return;
    }
    router.push('/(chat)/chat');
  }

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
      <Text style={styles.sectionIndex}>/ MON COMPTE</Text>
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
          <Text style={styles.sectionTitle}>Mes informations</Text>
          <Text style={styles.sectionText}>
            Optionnel. Personnalise l'information générale du chat (registre, dépistages selon
            l'âge/le sexe). Jamais utilisé pour un diagnostic ni un avis médical individuel.
          </Text>
          <PersonalInfoForm />
        </Card>
      ) : null}

      {user ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Mes outils</Text>
          <Text style={styles.sectionText}>
            Les fonctionnalités disponibles dépendent de ton rôle.
          </Text>
          <View style={styles.toolList}>
            {visibleFeatures(persona, { isAdmin }).map((f) => (
              <Link key={f.id} href={f.route as never} style={styles.toolItem}>
                {f.emoji} {f.label}
              </Link>
            ))}
          </View>
        </Card>
      ) : null}

      {user ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Rôles vérifiés</Text>
          <Text style={styles.sectionText}>
            Bascule librement entre les chats de tes rôles validés. Le rôle actif détermine le
            chat ouvert.
          </Text>
          <View style={styles.roleStatusList}>
            {VERIFIABLE_PERSONAS.map((p) => {
              const validated = verifiedPersonas.includes(p);
              const active = persona === p;
              const pending = p === 'professional' && status === 'pending' && persona === p;
              return (
                <View key={p} style={styles.roleStatusRow}>
                  <Text style={styles.roleStatusLabel}>{personaLabels[p]}</Text>
                  {validated ? (
                    <View style={[styles.statusBadge, active && styles.statusBadgeActive]}>
                      <Text style={[styles.statusBadgeText, active && styles.statusBadgeTextActive]}>
                        {active ? '● Actif' : '✓ Validé'}
                      </Text>
                    </View>
                  ) : pending ? (
                    <View style={styles.statusBadgePending}>
                      <Text style={styles.statusBadgePendingText}>En attente</Text>
                    </View>
                  ) : (
                    <Text style={styles.statusMuted}>Non validé</Text>
                  )}
                </View>
              );
            })}
          </View>

          {verifiedPersonas.filter((p) => p !== persona).length > 0 ? (
            <View style={styles.switchActions}>
              {verifiedPersonas
                .filter((p) => p !== persona)
                .map((p) => (
                  <Button
                    key={p}
                    label={`Passer en ${personaLabels[p]}`}
                    variant="secondary"
                    fullWidth={false}
                    loading={switching === p}
                    disabled={switching !== null}
                    onPress={() => switchTo(p)}
                  />
                ))}
            </View>
          ) : null}

          <Link href="/(account)/choose-role" style={styles.inlineLink}>
            Valider un nouveau rôle
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
  sectionIndex: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accent,
    fontSize: tokens.type.mono.fontSize,
    lineHeight: tokens.type.mono.lineHeight,
    letterSpacing: tokens.type.mono.letterSpacing,
    textTransform: 'uppercase',
    marginBottom: tokens.space.sm,
  },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
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
  divider: {
    height: tokens.border.hairline,
    backgroundColor: tokens.colors.border,
    marginVertical: tokens.space.md,
  },
  detailLabel: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
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
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.accent,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  badgeText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    fontWeight: tokens.weight.bold,
  },
  sectionTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.xs,
  },
  roleStatusList: { gap: tokens.space.sm, marginBottom: tokens.space.md },
  roleStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleStatusLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  statusBadge: {
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.surfacePure,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  statusBadgeActive: {
    backgroundColor: tokens.colors.accent,
    borderColor: tokens.colors.border,
  },
  statusBadgeText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.text,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    fontWeight: tokens.weight.bold,
  },
  statusBadgeTextActive: { color: tokens.colors.onAccent },
  statusBadgePending: {
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.warningBackground,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  statusBadgePendingText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.warningText,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    fontWeight: tokens.weight.bold,
  },
  statusMuted: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
  },
  switchActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
    marginBottom: tokens.space.md,
  },
  sectionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    marginBottom: tokens.space.md,
  },
  toolList: { gap: tokens.space.sm },
  toolItem: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    backgroundColor: tokens.colors.surfacePure,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.none,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm + 2,
    overflow: 'hidden',
  },
  signOut: { marginTop: tokens.space.xl },
  errorBox: {
    marginTop: tokens.space.lg,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    borderLeftWidth: tokens.border.heavy,
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
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
    backgroundColor: tokens.colors.warningBackground,
  },
  purposeAccent: { width: tokens.border.heavy, backgroundColor: tokens.colors.warningText },
  purposeContent: { flex: 1, padding: tokens.space.lg },
  purposeTitle: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.warningText,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
    textTransform: 'uppercase',
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
    color: tokens.colors.onInk,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: tokens.type.label.fontSize,
    backgroundColor: tokens.colors.ink,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm + 2,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
});
