/**
 * Formulaire « Mes informations » (prénom/nom/âge/sexe), persisté en profil via own-row RLS.
 * Réutilisé dans le panneau de réglages du chat ET l'écran Compte (ADR-0021).
 *
 * Ces champs personnalisent l'information générale (registre, dépistages selon âge/sexe) ;
 * ils n'ouvrent jamais diagnostic, anamnèse, triage ou avis médical individuel.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { SEX_OPTIONS, type PersonalInfo, type Sex } from '@/profile/personalInfo';
import { FieldInput } from '@/ui/FieldInput';
import { Button, ButtonRow } from '@/ui/Button';
import { tokens } from '@/ui/tokens';
import { Chip, ChipRow } from '@/ui/Chip';

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
          <FieldInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            accessibilityLabel="Prénom"
            placeholder="Prénom"
            placeholderTextColor={tokens.colors.textMuted}
            maxLength={60}
          />
        </View>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Nom</Text>
          <FieldInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            accessibilityLabel="Nom"
            placeholder="Nom"
            placeholderTextColor={tokens.colors.textMuted}
            maxLength={60}
          />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Âge</Text>
      <FieldInput
        style={styles.input}
        value={age}
        onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
        accessibilityLabel="Âge"
        placeholder="Ex. 34"
        placeholderTextColor={tokens.colors.textMuted}
        keyboardType="number-pad"
        maxLength={3}
      />

      <Text style={styles.fieldLabel}>Sexe</Text>
      <ChipRow label="Sexe">
        {SEX_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            role="radio"
            label={o.label}
            selected={sex === o.value}
            onPress={() => setSex(sex === o.value ? null : o.value)}
          />
        ))}
      </ChipRow>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {savedMessage ? <Text style={styles.saved}>{savedMessage}</Text> : null}

      <ButtonRow>
        <Button
          label={saving ? 'Enregistrement…' : 'Enregistrer'}
          onPress={handleSave}
          loading={saving}
          fullWidth={false}
          style={styles.saveButton}
        />
      </ButtonRow>
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
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  input: {
    minHeight: 42,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    color: tokens.colors.text,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
  },
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
