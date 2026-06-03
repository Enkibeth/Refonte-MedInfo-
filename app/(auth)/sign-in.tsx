import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AI_DISCLOSURE } from '@/compliance/disclosures';
import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/tokens';

/**
 * Connexion par magic link OTP (ADR-0007). Version minimale fonctionnelle :
 * le scaffolding UI poli est délégué à Codex (états, accessibilité, design).
 * Aucune mention de symptôme / triage / diagnostic (gate compliance-grep).
 */
export default function SignInScreen() {
  const { signInWithEmail } = useSession();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setPending(true);
    setError(null);
    const { error: err } = await signInWithEmail(email.trim());
    setPending(false);
    if (err) setError(err);
    else setSent(true);
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Connexion</Text>
        {sent ? (
          <Text style={styles.body}>
            Un lien de connexion a été envoyé à {email}. Ouvrez-le pour vous connecter.
          </Text>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Adresse email"
              placeholderTextColor={tokens.colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Pressable style={styles.button} onPress={onSubmit} disabled={pending || !email}>
              <Text style={styles.buttonText}>
                {pending ? 'Envoi…' : 'Recevoir le lien de connexion'}
              </Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
        <Text style={styles.notice}>{AI_DISCLOSURE}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: tokens.colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    padding: 24,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 16,
  },
  title: { color: tokens.colors.text, fontSize: 28, fontWeight: '800' },
  body: { color: tokens.colors.textMuted, fontSize: 16, lineHeight: 24 },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    padding: 14,
    color: tokens.colors.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: tokens.colors.background, fontSize: 16, fontWeight: '700' },
  error: { color: tokens.colors.warningText },
  notice: {
    marginTop: 8,
    color: tokens.colors.warningText,
    backgroundColor: tokens.colors.warningBackground,
    borderRadius: 12,
    padding: 12,
    lineHeight: 20,
  },
});
