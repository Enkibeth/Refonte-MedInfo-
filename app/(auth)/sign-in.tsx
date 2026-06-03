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

import { useSession } from '@/auth/AuthProvider';
import { AI_DISCLOSURE } from '@/compliance/disclosures';
import { tokens } from '@/ui/tokens';

export default function SignInScreen() {
  const { loading, signInWithEmail, user } = useSession();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDisabled = loading || sending || email.trim().length === 0;

  async function handleSubmit() {
    if (isDisabled) return;

    setSending(true);
    setSent(false);
    setErrorMessage(null);

    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer le lien de connexion pour le moment.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Accès sécurisé</Text>
        <Text style={styles.title}>Connexion à MedInfo AI</Text>
        <Text style={styles.body}>
          Indique ton adresse email pour recevoir un lien de connexion à usage unique.
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

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            accessibilityLabel="Adresse email"
            autoCapitalize="none"
            autoComplete="email"
            editable={!sending && !loading}
            inputMode="email"
            keyboardType="email-address"
            onChangeText={(value) => {
              setEmail(value);
              setErrorMessage(null);
              setSent(false);
            }}
            placeholder="nom@example.com"
            placeholderTextColor={tokens.colors.textMuted}
            style={styles.input}
            textContentType="emailAddress"
            value={email}
          />

          <Pressable
            accessibilityRole="button"
            disabled={isDisabled}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.button,
              isDisabled ? styles.buttonDisabled : null,
              pressed && !isDisabled ? styles.buttonPressed : null,
            ]}
          >
            {sending ? <ActivityIndicator color={tokens.colors.surface} /> : null}
            <Text style={styles.buttonText}>
              {sending ? 'Envoi en cours…' : 'Recevoir le lien de connexion'}
            </Text>
          </Pressable>
        </View>

        {sent ? (
          <View style={styles.statusBox} accessibilityLiveRegion="polite">
            <Text style={styles.statusTitle}>Lien envoyé</Text>
            <Text style={styles.statusText}>Vérifie ta boîte mail.</Text>
          </View>
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

      <Text style={styles.notice}>{AI_DISCLOSURE}</Text>
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
  form: {
    gap: 12,
    marginTop: 28,
  },
  label: {
    color: tokens.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
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
  statusBox: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    padding: 16,
  },
  statusTitle: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  statusText: {
    color: tokens.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
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
  successBox: {
    marginTop: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    padding: 16,
  },
  successTitle: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  successText: {
    color: tokens.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  footer: {
    marginTop: 22,
  },
  inlineLink: {
    color: tokens.colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
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
