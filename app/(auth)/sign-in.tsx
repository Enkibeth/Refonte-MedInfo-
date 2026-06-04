import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSession, type OAuthProvider } from '@/auth/AuthProvider';
import { getAiDisclosure } from '@/compliance/disclosures';
import { Logo } from '@/ui/Logo';
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

  const isDisabled =
    loading || busy || email.trim().length === 0 || password.length < 6;

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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.logoWrap}>
          <Logo size="md" />
        </View>
        <Text style={styles.eyebrow}>Accès sécurisé</Text>
        <Text style={styles.title}>
          {mode === 'signin' ? 'Connexion à MedInfo AI' : 'Créer un compte'}
        </Text>
        <Text style={styles.body}>
          {mode === 'signin'
            ? 'Connecte-toi avec ton email et ton mot de passe, ou via Google / Apple.'
            : 'Choisis un email et un mot de passe (6 caractères minimum), ou utilise Google / Apple.'}
        </Text>

        {user ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Session active</Text>
            <Text style={styles.successText}>{user.email}</Text>
            <Link href="/(account)/account" style={styles.inlineLink}>
              Voir mon compte
            </Link>
          </View>
        ) : null}

        {/* OAuth */}
        <View style={styles.oauthRow}>
          <Pressable
            accessibilityRole="button"
            disabled={busy || loading}
            onPress={() => handleOAuth('google')}
            style={({ pressed }) => [styles.oauthButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.oauthText}>Continuer avec Google</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || loading}
            onPress={() => handleOAuth('apple')}
            style={({ pressed }) => [styles.oauthButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.oauthText}>Continuer avec Apple</Text>
          </Pressable>
        </View>

        <View style={styles.separatorRow}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>ou</Text>
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

          <Pressable
            accessibilityRole="button"
            disabled={isDisabled}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.button,
              isDisabled ? styles.buttonDisabled : null,
              pressed && !isDisabled ? styles.pressed : null,
            ]}
          >
            {busy ? <ActivityIndicator color={tokens.colors.background} /> : null}
            <Text style={styles.buttonText}>
              {busy
                ? 'Veuillez patienter…'
                : mode === 'signin'
                  ? 'Se connecter'
                  : 'Créer mon compte'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
            reset();
          }}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>
            {mode === 'signin'
              ? "Pas encore de compte ? Créer un compte"
              : 'Déjà un compte ? Se connecter'}
          </Text>
        </Pressable>

        {info ? (
          <View style={styles.statusBox} accessibilityLiveRegion="polite">
            <Text style={styles.statusText}>{info}</Text>
          </View>
        ) : null}

        {canResendConfirmation ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || loading || email.trim().length === 0}
            onPress={handleResendConfirmation}
            style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.secondaryButtonText}>Renvoyer l’email de confirmation</Text>
          </Pressable>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorTitle}>Erreur</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Link href="/" style={styles.inlineLink}>
            Retour accueil
          </Link>
        </View>
      </View>

      <Text style={styles.notice}>{getAiDisclosure()}</Text>
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
    maxWidth: 640,
    borderRadius: 28,
    padding: 28,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  logoWrap: { marginBottom: 18 },
  eyebrow: {
    color: tokens.colors.accent,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  title: { color: tokens.colors.text, fontSize: 30, fontWeight: '800', marginBottom: 12 },
  body: { color: tokens.colors.textMuted, fontSize: 16, lineHeight: 24 },
  oauthRow: { gap: 10, marginTop: 24 },
  oauthButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
  },
  oauthText: { color: tokens.colors.text, fontSize: 15, fontWeight: '700' },
  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  separatorLine: { flex: 1, height: 1, backgroundColor: tokens.colors.border },
  separatorText: { color: tokens.colors.textMuted, fontSize: 13, fontWeight: '600' },
  form: { gap: 10 },
  label: { color: tokens.colors.text, fontSize: 14, fontWeight: '700' },
  input: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    color: tokens.colors.text,
    fontSize: 16,
    paddingHorizontal: 16,
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: 18,
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.86 },
  buttonText: { color: tokens.colors.background, fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.accent,
    marginTop: 12,
  },
  secondaryButtonText: { color: tokens.colors.accent, fontSize: 15, fontWeight: '800' },
  toggle: { marginTop: 16, alignItems: 'center' },
  toggleText: { color: tokens.colors.accent, fontSize: 14, fontWeight: '700' },
  statusBox: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    padding: 16,
  },
  statusText: { color: tokens.colors.text, fontSize: 15, lineHeight: 22 },
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
  errorText: { color: tokens.colors.warningText, fontSize: 15, lineHeight: 22 },
  successBox: {
    marginTop: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    padding: 16,
  },
  successTitle: { color: tokens.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  successText: {
    color: tokens.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  footer: { marginTop: 22 },
  inlineLink: { color: tokens.colors.accent, fontSize: 15, fontWeight: '800' },
  notice: {
    width: '100%',
    maxWidth: 640,
    marginTop: 18,
    color: tokens.colors.warningText,
    backgroundColor: tokens.colors.warningBackground,
    borderRadius: 16,
    padding: 16,
    lineHeight: 22,
  },
});
