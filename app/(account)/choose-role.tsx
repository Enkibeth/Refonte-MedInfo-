import { useRouter } from 'expo-router';
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
import { ROLES } from '@/auth/roles';
import type { Persona } from '@/ai/prompts/_schema';
import { tokens } from '@/ui/tokens';

/**
 * Sélection de rôle (ADR-0011). Le rôle vérifié est attribué côté serveur (/api/role) :
 * le client ne fixe jamais persona/status. Aucune donnée de santé.
 *   - Public : immédiat.
 *   - Étudiant : email de domaine académique.
 *   - Professionnel : numéro RPPS (vérif ANS à venir → état « en attente »).
 */
export default function ChooseRoleScreen() {
  const { persona, requestRole } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<Persona | null>(null);
  const [email, setEmail] = useState('');
  const [rpps, setRpps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function choose(target: Persona, proof?: { email?: string; rpps?: string }) {
    setBusy(target);
    setError(null);
    setInfo(null);
    const res = await requestRole(target, proof);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.pending) {
      setInfo(res.message ?? 'Vérification en attente.');
      return;
    }
    router.replace('/(chat)/chat');
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Profil</Text>
        <Text style={styles.title}>Choisis ton rôle</Text>
        <Text style={styles.body}>
          Le rôle adapte ton expérience. {persona ? `Rôle actuel : ${ROLES[persona].label}.` : ''}
        </Text>

        {/* Public */}
        <View style={styles.roleBox}>
          <Text style={styles.roleTitle}>{ROLES.public.label}</Text>
          <Text style={styles.roleDesc}>{ROLES.public.description}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={() => choose('public')}
            style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
          >
            {busy === 'public' ? <ActivityIndicator color={tokens.colors.background} /> : null}
            <Text style={styles.buttonText}>Continuer en grand public</Text>
          </Pressable>
        </View>

        {/* Étudiant */}
        <View style={styles.roleBox}>
          <Text style={styles.roleTitle}>{ROLES.student.label}</Text>
          <Text style={styles.roleDesc}>{ROLES.student.description}</Text>
          <TextInput
            accessibilityLabel="Email étudiant"
            autoCapitalize="none"
            inputMode="email"
            keyboardType="email-address"
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
            placeholder="prenom@etu.univ-...fr"
            placeholderTextColor={tokens.colors.textMuted}
            style={styles.input}
            value={email}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null || email.trim().length === 0}
            onPress={() => choose('student', { email })}
            style={({ pressed }) => [
              styles.buttonAlt,
              busy !== null || email.trim().length === 0 ? styles.disabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            {busy === 'student' ? <ActivityIndicator color={tokens.colors.accent} /> : null}
            <Text style={styles.buttonAltText}>Vérifier mon statut étudiant</Text>
          </Pressable>
        </View>

        {/* Professionnel */}
        <View style={styles.roleBox}>
          <Text style={styles.roleTitle}>{ROLES.professional.label}</Text>
          <Text style={styles.roleDesc}>{ROLES.professional.description}</Text>
          <TextInput
            accessibilityLabel="Numéro RPPS"
            autoCapitalize="none"
            inputMode="numeric"
            keyboardType="number-pad"
            onChangeText={(v) => {
              setRpps(v.replace(/\D/g, ''));
              setError(null);
            }}
            placeholder="Numéro RPPS (11 chiffres)"
            placeholderTextColor={tokens.colors.textMuted}
            style={styles.input}
            value={rpps}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null || rpps.length === 0}
            onPress={() => choose('professional', { rpps })}
            style={({ pressed }) => [
              styles.buttonAlt,
              busy !== null || rpps.length === 0 ? styles.disabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            {busy === 'professional' ? <ActivityIndicator color={tokens.colors.accent} /> : null}
            <Text style={styles.buttonAltText}>Vérifier mon RPPS</Text>
          </Pressable>
        </View>

        {info ? (
          <View style={styles.infoBox} accessibilityLiveRegion="polite">
            <Text style={styles.infoText}>{info}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
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
  title: { color: tokens.colors.text, fontSize: 30, fontWeight: '800', marginBottom: 12 },
  body: { color: tokens.colors.textMuted, fontSize: 16, lineHeight: 24, marginBottom: 12 },
  roleBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    gap: 10,
  },
  roleTitle: { color: tokens.colors.text, fontSize: 18, fontWeight: '800' },
  roleDesc: { color: tokens.colors.textMuted, fontSize: 14, lineHeight: 20 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    color: tokens.colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: tokens.colors.accent,
  },
  buttonText: { color: tokens.colors.background, fontSize: 15, fontWeight: '800' },
  buttonAlt: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.surface,
  },
  buttonAltText: { color: tokens.colors.accent, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.86 },
  infoBox: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    padding: 14,
  },
  infoText: { color: tokens.colors.text, fontSize: 14, lineHeight: 20 },
  errorBox: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: tokens.colors.warningBackground,
    padding: 14,
  },
  errorText: { color: tokens.colors.warningText, fontSize: 14, lineHeight: 20 },
});
