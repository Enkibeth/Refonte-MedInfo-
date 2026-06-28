import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { ROLES } from '@/auth/roles';
import type { Persona } from '@/ai/prompts/_schema';
import { Button } from '@/ui/primitives/Button';
import { Card } from '@/ui/primitives/Card';
import { Screen } from '@/ui/primitives/Screen';
import { tokens } from '@/ui/theme/tokens';

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
    <Screen maxWidth={560}>
      <Text style={styles.title}>Choisis ton rôle</Text>
      <Text style={styles.body}>
        Le rôle adapte ton expérience.{persona ? ` Rôle actuel : ${ROLES[persona].label}.` : ''}
      </Text>

      {/* Public */}
      <Card style={[styles.roleCard, { borderLeftWidth: 3, borderLeftColor: tokens.colors.personas.public.accent }]}>
        <Text style={styles.roleTitle}>{ROLES.public.label}</Text>
        <Text style={styles.roleDesc}>{ROLES.public.description}</Text>
        <Button
          label="Continuer en grand public"
          loading={busy === 'public'}
          disabled={busy !== null}
          onPress={() => choose('public')}
          style={styles.roleAction}
        />
      </Card>

      {/* Étudiant */}
      <Card style={[styles.roleCard, { borderLeftWidth: 3, borderLeftColor: tokens.colors.personas.student.accent }]}>
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
        <Button
          label="Vérifier mon statut étudiant"
          variant="secondary"
          loading={busy === 'student'}
          disabled={busy !== null || email.trim().length === 0}
          onPress={() => choose('student', { email })}
          style={styles.roleAction}
        />
      </Card>

      {/* Professionnel */}
      <Card style={[styles.roleCard, { borderLeftWidth: 3, borderLeftColor: tokens.colors.personas.pro.accent }]}>
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
        <Button
          label="Vérifier mon RPPS"
          variant="secondary"
          loading={busy === 'professional'}
          disabled={busy !== null || rpps.length === 0}
          onPress={() => choose('professional', { rpps })}
          style={styles.roleAction}
        />
      </Card>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
    marginBottom: tokens.space.sm,
  },
  roleCard: { marginTop: tokens.space.lg, gap: tokens.space.md },
  roleTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  roleDesc: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  input: {
    minHeight: 48,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    color: tokens.colors.text,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    paddingHorizontal: tokens.space.lg,
  },
  roleAction: { marginTop: tokens.space.xs },
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
  errorText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
  },
});
