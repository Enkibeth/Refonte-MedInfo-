import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSession, toFriendlyAuthError, type OAuthProvider } from '@/auth/AuthProvider';
import { getAiDisclosure } from '@/compliance/disclosures';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { GoogleIcon, AppleIcon } from '@/ui/icons';
import { Logo } from '@/ui/Logo';
import { Screen } from '@/ui/Screen';
import { tokens } from '@/ui/tokens';

/**
 * Connexion MedInfo AI (ADR-0010) : email + mot de passe (connexion / inscription),
 * mot de passe oublié, et OAuth Google / Apple. Aucune mention de symptôme/triage/diagnostic.
 */
type Mode = 'signin' | 'signup' | 'forgot';

/** Lit un éventuel message d'erreur renvoyé dans l'URL après un retour OAuth (web). */
function readOAuthErrorFromUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const { search, hash } = window.location;
  const params = new URLSearchParams(search || (hash ? hash.replace(/^#/, '') : ''));
  const desc = params.get('error_description') || params.get('error');
  if (!desc) return null;
  // Nettoie l'URL pour ne pas réafficher l'erreur au rechargement.
  try {
    window.history.replaceState({}, '', window.location.pathname);
  } catch {
    /* no-op */
  }
  return toFriendlyAuthError(decodeURIComponent(desc.replace(/\+/g, ' ')));
}

export default function SignInScreen() {
  const {
    loading,
    user,
    signInWithPassword,
    signUpWithPassword,
    resendSignupConfirmation,
    sendPasswordReset,
    signInWithOAuth,
  } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);

  useEffect(() => {
    const oauthError = readOAuthErrorFromUrl();
    if (oauthError) setErrorMessage(oauthError);
  }, []);

  const emailEmpty = email.trim().length === 0;
  const isDisabled =
    loading || busy || emailEmpty || (mode !== 'forgot' && password.length < 6);

  function reset() {
    setErrorMessage(null);
    setInfo(null);
    setCanResendConfirmation(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    reset();
  }

  async function handleSubmit() {
    if (isDisabled) return;
    setBusy(true);
    reset();

    if (mode === 'forgot') {
      const { error } = await sendPasswordReset(email);
      setBusy(false);
      if (error) setErrorMessage(error);
      else
        setInfo(
          'Si un compte existe pour cet email, un lien de réinitialisation vient d’être envoyé. Vérifie ta boîte mail et tes spams.',
        );
      return;
    }

    if (mode === 'signin') {
      const { error } = await signInWithPassword(email, password);
      setBusy(false);
      if (error) {
        setErrorMessage(error);
        if (error.toLowerCase().includes('confirm')) setCanResendConfirmation(true);
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
    if (busy || loading || emailEmpty) return;
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

  const title =
    mode === 'signin' ? 'Connexion' : mode === 'signup' ? 'Créer un compte' : 'Mot de passe oublié';
  const submitLabel =
    mode === 'signin' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien';

  return (
    <Screen maxWidth={460} center>
      <View style={styles.logoWrap}>
        <Logo size="md" />
      </View>

      <Card>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>
          {mode === 'signin'
            ? 'Connecte-toi avec ton email, ou via Google / Apple.'
            : mode === 'signup'
              ? 'Choisis un email et un mot de passe (6 caractères min.), ou utilise Google / Apple.'
              : 'Saisis ton email : nous t’enverrons un lien pour définir un nouveau mot de passe.'}
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

        {mode !== 'forgot' ? (
          <>
            {/* OAuth */}
            <View style={styles.oauthRow}>
              <Button
                label="Continuer avec Google"
                variant="secondary"
                leftIcon={<GoogleIcon size={18} />}
                disabled={busy || loading}
                onPress={() => handleOAuth('google')}
              />
              <Button
                label="Continuer avec Apple"
                variant="secondary"
                leftIcon={<AppleIcon size={18} />}
                disabled={busy || loading}
                onPress={() => handleOAuth('apple')}
              />
            </View>

            <View style={styles.separatorRow}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>ou par email</Text>
              <View style={styles.separatorLine} />
            </View>
          </>
        ) : null}

        {/* Email (+ mot de passe hors mode oublié) */}
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

          {mode !== 'forgot' ? (
            <>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.label}>Mot de passe</Text>
                {mode === 'signin' ? (
                  <Text
                    accessibilityRole="button"
                    onPress={() => switchMode('forgot')}
                    style={styles.forgotLink}
                  >
                    Mot de passe oublié ?
                  </Text>
                ) : null}
              </View>
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
            </>
          ) : null}

          <Button
            label={submitLabel}
            disabled={isDisabled}
            loading={busy}
            onPress={handleSubmit}
            style={styles.submit}
          />
        </View>

        <View style={styles.toggle}>
          {mode === 'forgot' ? (
            <Text accessibilityRole="button" onPress={() => switchMode('signin')} style={styles.toggleText}>
              ← Retour à la connexion
            </Text>
          ) : (
            <Text
              accessibilityRole="button"
              onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              style={styles.toggleText}
            >
              {mode === 'signin'
                ? 'Pas encore de compte ? Créer un compte'
                : 'Déjà un compte ? Se connecter'}
            </Text>
          )}
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
            disabled={busy || loading || emailEmpty}
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
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h1.fontSize,
    lineHeight: tokens.type.h1.lineHeight,
    letterSpacing: tokens.type.h1.letterSpacing,
    fontWeight: tokens.weight.semibold,
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
  form: { gap: tokens.space.sm, marginTop: tokens.space.xs },
  label: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  passwordLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  forgotLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.caption.fontSize,
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
