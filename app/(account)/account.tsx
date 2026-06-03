import { Pressable, StyleSheet, Text, View } from 'react-native';

import { INTENDED_PURPOSE } from '@/compliance/disclosures';
import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/tokens';

/**
 * Compte — affiche email + persona. Version minimale fonctionnelle (Codex enrichit l'UI).
 * `professional` : encart neutre « reporté » (ADR-0006), aucune fonctionnalité pro servie.
 * Aucun profil santé ni wizard (01_REGULATION §5).
 */
export default function AccountScreen() {
  const { user, persona, signOut } = useSession();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Compte</Text>
        <Text style={styles.row}>Email : {user?.email ?? '—'}</Text>
        <Text style={styles.row}>Persona : {persona ?? '—'}</Text>

        {persona === 'professional' ? (
          <Text style={styles.notice}>
            Module professionnel — disponible ultérieurement.
          </Text>
        ) : null}

        <Pressable style={styles.button} onPress={() => signOut()}>
          <Text style={styles.buttonText}>Se déconnecter</Text>
        </Pressable>

        <Text style={styles.purpose}>{INTENDED_PURPOSE}</Text>
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
    maxWidth: 560,
    borderRadius: 24,
    padding: 24,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 14,
  },
  title: { color: tokens.colors.text, fontSize: 28, fontWeight: '800' },
  row: { color: tokens.colors.text, fontSize: 16 },
  notice: {
    color: tokens.colors.warningText,
    backgroundColor: tokens.colors.warningBackground,
    borderRadius: 12,
    padding: 12,
    lineHeight: 20,
  },
  button: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: tokens.colors.background, fontSize: 16, fontWeight: '700' },
  purpose: { color: tokens.colors.textMuted, fontSize: 13, lineHeight: 20 },
});
