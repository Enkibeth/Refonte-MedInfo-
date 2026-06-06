import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Logo } from '@/ui/Logo';
import { Screen } from '@/ui/Screen';
import { tokens } from '@/ui/tokens';

/**
 * Réinitialisation du mot de passe (ADR-0010). Atteint après ouverture du lien email :
 * l'événement PASSWORD_RECOVERY (AuthProvider) route ici avec une session de récupération.
 * On définit le nouveau mot de passe via updateUser, puis on quitte le mode récupération.
 */
export default function ResetPasswordScreen() {
  const { updatePassword, clearPasswordRecovery, passwordRecovery, user } = useSession();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = password.length < 6;
  const mismatch = confirm.length > 0 && confirm !== password;
  const disabled = busy || tooShort || mismatch || confirm.length === 0;

  async function handleSubmit() {
    if (disabled) return;
    setBusy(true);
    setError(null);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
  }

  function finish() {
    clearPasswordRecovery();
    router.replace('/(chat)/chat');
  }

  return (
    <Screen maxWidth={460} center>
      <View style={styles.logoWrap}>
        <Logo size="md" />
      </View>

      <Card>
        <Text style={styles.title}>Nouveau mot de passe</Text>

        {done ? (
          <>
            <Text style={styles.body}>
              Ton mot de passe a été mis à jour. Tu es connecté·e.
            </Text>
            <Button label="Continuer" onPress={finish} style={styles.submit} />
          </>
        ) : (
          <>
            <Text style={styles.body}>
              {passwordRecovery || user
                ? 'Choisis un nouveau mot de passe (6 caractères minimum).'
                : "Ouvre cette page depuis le lien reçu par email pour réinitialiser ton mot de passe."}
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>Nouveau mot de passe</Text>
              <TextInput
                accessibilityLabel="Nouveau mot de passe"
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={(v) => {
                  setPassword(v);
                  setError(null);
                }}
                placeholder="6 caractères minimum"
                placeholderTextColor={tokens.colors.textMuted}
                secureTextEntry
                style={styles.input}
                value={password}
              />

              <Text style={styles.label}>Confirmer</Text>
              <TextInput
                accessibilityLabel="Confirmer le mot de passe"
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={(v) => {
                  setConfirm(v);
                  setError(null);
                }}
                placeholder="Retape le mot de passe"
                placeholderTextColor={tokens.colors.textMuted}
                secureTextEntry
                style={[styles.input, mismatch && styles.inputError]}
                value={confirm}
              />
              {mismatch ? (
                <Text style={styles.hint}>Les mots de passe ne correspondent pas.</Text>
              ) : null}

              <Button
                label="Mettre à jour"
                disabled={disabled}
                loading={busy}
                onPress={handleSubmit}
                style={styles.submit}
              />
            </View>
          </>
        )}

        {error ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorTitle}>Erreur</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </Card>
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
  form: { gap: tokens.space.sm, marginTop: tokens.space.lg },
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
  inputError: { borderColor: tokens.colors.danger },
  hint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.caption.fontSize,
  },
  submit: { marginTop: tokens.space.sm },
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
});
