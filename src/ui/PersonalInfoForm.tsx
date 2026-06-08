/**
 * Formulaire « Mes informations » (prénom/nom/âge/sexe), persisté en profil via own-row RLS.
 * Réutilisé dans le panneau de réglages du chat ET l'écran Compte (ADR-0021).
 *
 * Ces champs personnalisent l'information générale (registre, dépistages selon âge/sexe) ;
 * ils n'ouvrent jamais diagnostic, anamnèse, triage ou avis médical individuel.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { SEX_OPTIONS, type PersonalInfo, type Sex } from '@/profile/personalInfo';
import { Button } from '@/ui/Button';
import { tokens } from '@/ui/tokens';

export function PersonalInfoForm() {
  const { user, personalInfo, updatePersonalInfo } = useSession();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(personalInfo?.firstName ?? '');
    setLastName(personalInfo?.lastName ?? '');
    setAge(personalInfo?.age != null ? String(personalInfo.age) : '');
    setSex(personalInfo?.sex ?? null);
  }, [personalInfo]);

  if (!user) {
    return <Text style={styles.help}>Connecte-toi pour enregistrer tes informations.</Text>;
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSavedMessage(null);
    setError(null);

    const parsedAge = age.trim() === '' ? null : Number(age.trim());
    if (parsedAge != null && (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 130)) {
      setError('Âge invalide (0 à 130).');
      setSaving(false);
      return;
    }

    const info: PersonalInfo = {
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      age: parsedAge != null ? Math.floor(parsedAge) : null,
      sex,
    };
    const res = await updatePersonalInfo(info);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSavedMessage('Informations enregistrées.');
  }

  return (
    <View style={styles.container}>
      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Prénom</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Prénom"
            placeholderTextColor={tokens.colors.textMuted}
            maxLength={60}
          />
        </View>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Nom</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Nom"
            placeholderTextColor={tokens.colors.textMuted}
            maxLength={60}
          />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Âge</Text>
      <TextInput
        style={styles.input}
        value={age}
        onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
        placeholder="Ex. 34"
        placeholderTextColor={tokens.colors.textMuted}
        keyboardType="number-pad"
        maxLength={3}
      />

      <Text style={styles.fieldLabel}>Sexe</Text>
      <View style={styles.sexRow}>
        {SEX_OPTIONS.map((o) => {
          const active = sex === o.value;
          return (
            <TouchableOpacity
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.sexChip, active && styles.sexChipActive]}
              onPress={() => setSex(active ? null : o.value)}
            >
              <Text style={[styles.sexChipText, active && styles.sexChipTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {savedMessage ? <Text style={styles.saved}>{savedMessage}</Text> : null}

      <Button
        label={saving ? 'Enregistrement…' : 'Enregistrer'}
        onPress={handleSave}
        loading={saving}
        disabled={saving}
        style={styles.saveButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.space.sm },
  help: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  fieldRow: { flexDirection: 'row', gap: tokens.space.md },
  fieldHalf: { flex: 1, gap: tokens.space.xs },
  fieldLabel: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    fontWeight: tokens.weight.bold,
  },
  input: {
    minHeight: 44,
    borderRadius: tokens.radius.none,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.surfacePure,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    color: tokens.colors.text,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
  },
  sexRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  sexChip: {
    borderRadius: tokens.radius.none,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.surfacePure,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
  },
  sexChipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.border },
  sexChipText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  sexChipTextActive: { color: tokens.colors.onAccent, fontWeight: tokens.weight.bold },
  error: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.caption.fontSize,
  },
  saved: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.success,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  saveButton: { marginTop: tokens.space.sm },
});
