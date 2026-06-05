import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useSession, type OAuthProvider } from '@/auth/AuthProvider';
import { getAiDisclosure } from '@/compliance/disclosures';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Logo } from '@/ui/Logo';
import { Screen } from '@/ui/Screen';
import { tokens } from '@/ui/tokens';

/**
 * Connexion MedInfo AI (ADR-0010) : email + mot de passe (connexion / inscription)
 * et OAuth Google / Apple. Aucune mention de symptôme/triage/diagnostic.
 * Le persona public n'a PAS besoin de se connecter (01_REGULATION §5) : cet écran
 * sert les comptes (étudiant/pro/réglages).
 */
type Mode = 'signin' | 'signup';

export default function SignInScreen() {
  const {
    loading,
    user,
    signInWithPassword,
    signUpWithPassword,
    resendSignupConfirmation,
    signInWithOAuth,
  } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);

  const isDisabled = loading || busy || email.trim().length === 0 || password.length < 6;

  function reset() {
    setErrorMessage(null);
    setInfo(null);
    setCanResendConfirmation(false);
  }

  async function handleSubmit() {
    if (isDisabled) return;
    setBusy(true);
    reset();

    if (mode === 'signin') {
      const { error } = await signInWithPassword(email, password);
      setBusy(false);
      if (error) {
        setErrorMessage(error);
        if (error.toLowerCase().includes('email not confirmed')) setCanResendConfirmation(true);
      }
    } else {
      const { error, needsConfirmation } = await signUpWithPassword(email, password);
      setBusy(false);
      if (error) setErrorMessage(error);
      else if (needsConfirmation) {
        setCanResendConfirmation(true);
        setInfo(
          'Compte créé. Vérifie ta boîte mail et tes spams pour confirmer ton adresse. Tu peux renvoyer le mail si besoin.',
        );
      } else setInfo('Compte créé et connecté.');
    }
  }

  async function handleResendConfirmation() {
    if (busy || loading || email.trim().length === 0) return;
    setBusy(true);
    setErrorMessage(null);
    const { error } = await resendSignupConfirmation(email);
    setBusy(false);
    if (error) setErrorMessage(error);
    else setInfo('Email de confirmation renvoyé. Vérifie ta boîte mail et tes spams.');
  }

  async function handleOAuth(provider: OAuthProvider) {
    if (busy || loading) return;
    setBusy(true);
    reset();
    const { error } = await signInWithOAuth(provider);
    setBusy(false);
    if (error) setErrorMessage(error);
  }

  return (
    <Screen maxWidth={460} center>
      <View style={styles.logoWrap}>
        <Logo size="md" />
      </View>

      <Card>
        <Text style={styles.title}>
          {mode === 'signin' ? 'Connexion' : 'Créer un compte'}
        </Text>
        <Text style={styles.body}>
          {mode === 'signin'
            ? 'Connecte-toi avec ton email, ou via Google / Apple.'
            : 'Choisis un email et un mot de passe (6 caractères min.), ou utilise Google / Apple.'}
        </Text>

        {user ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Session active</Text>
            <Text style={styles.statusValue}>{user.email}</Text>
            <Link href="/(account)/account" style={styles.inlineLink}>
              Voir mon compte
            </Link>
          </View>
        ) : null}

        {/* OAuth */}
        <View style={styles.oauthRow}>
          <Button
            label="Continuer avec Google"
            variant="secondary"
            disabled={busy || loading}
            onPress={() => handleOAuth('google')}
          />
          <Button
            label="Continuer avec Apple"
            variant="secondary"
            disabled={busy || loading}
            onPress={() => handleOAuth('apple')}
          />
        </View>

        <View style={styles.separatorRow}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>ou par email</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Email + mot de passe */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            accessibilityLabel="Adresse email"
            autoCapitalize="none"
            autoComplete="email"
            editable={!busy && !loading}
            inputMode="email"
            keyboardType="email-address"
            onChangeText={(value) => {
              setEmail(value);
              reset();
            }}
            placeholder="nom@example.com"
            placeholderTextColor={tokens.colors.textMuted}
            style={styles.input}
            textContentType="emailAddress"
            value={email}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            accessibilityLabel="Mot de passe"
            autoCapitalize="none"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            editable={!busy && !loading}
            onChangeText={(value) => {
              setPassword(value);
              reset();
            }}
            placeholder="6 caractères minimum"
            placeholderTextColor={tokens.colors.textMuted}
            secureTextEntry
            style={styles.input}
            textContentType="password"
            value={password}
          />

          <Button
            label={mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
            disabled={isDisabled}
            loading={busy}
            onPress={handleSubmit}
            style={styles.submit}
          />
        </View>

        <View style={styles.toggle}>
          <Text
            accessibilityRole="button"
            onPress={() => {
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
              reset();
            }}
            style={styles.toggleText}
          >
            {mode === 'signin'
              ? 'Pas encore de compte ? Créer un compte'
              : 'Déjà un compte ? Se connecter'}
          </Text>
        </View>

        {info ? (
          <View style={styles.infoBox} accessibilityLiveRegion="polite">
            <Text style={styles.infoText}>{info}</Text>
          </View>
        ) : null}

        {canResendConfirmation ? (
          <Button
            label="Renvoyer l'email de confirmation"
            variant="ghost"
            disabled={busy || loading || email.trim().length === 0}
            onPress={handleResendConfirmation}
            style={styles.resend}
          />
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorTitle}>Erreur</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Link href="/" style={styles.inlineLink}>
            Retour à l'accueil
          </Link>
        </View>
      </Card>

      <View style={styles.notice}>
        <View style={styles.noticeAccent} />
        <Text style={styles.noticeText}>{getAiDisclosure()}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoWrap: { alignItems: 'center', marginBottom: tokens.space.xl },
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
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  oauthRow: { gap: tokens.space.sm, marginTop: tokens.space.xl },
  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md, marginVertical: tokens.space.lg },
  separatorLine: { flex: 1, height: 1, backgroundColor: tokens.colors.border },
  separatorText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  form: { gap: tokens.space.sm },
  label: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  input: {
    width: '100%',
    minHeight: 50,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    color: tokens.colors.text,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    paddingHorizontal: tokens.space.lg,
    marginBottom: tokens.space.xs,
  },
  submit: { marginTop: tokens.space.sm },
  toggle: { marginTop: tokens.space.lg, alignItems: 'center' },
  toggleText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  resend: { marginTop: tokens.space.md },
  statusBox: {
    marginTop: tokens.space.lg,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    padding: tokens.space.lg,
    gap: tokens.space.xs,
  },
  statusLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  statusValue: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.body.fontSize },
  infoBox: {
    marginTop: tokens.space.lg,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    padding: tokens.space.lg,
  },
  infoText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
  },
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
  footer: { marginTop: tokens.space.xl },
  inlineLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  notice: {
    flexDirection: 'row',
    width: '100%',
    marginTop: tokens.space.lg,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.warningBackground,
  },
  noticeAccent: { width: 4, backgroundColor: tokens.colors.warningText },
  noticeText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.warningText,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 19,
    padding: tokens.space.lg,
  },
});
