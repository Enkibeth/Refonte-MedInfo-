/**
 * Analyseur de classement de promo — outil étudiant (persona student).
 *
 * Concept (medoutils) : l'étudiant importe le fichier des notes de toute sa promo et
 * obtient son classement, des statistiques, et peut comparer avec un autre numéro
 * étudiant. Traitement 100 % CÔTÉ CLIENT (les notes des autres étudiants ne quittent
 * jamais l'appareil) — aucune IA, aucune donnée envoyée.
 *
 * ⏳ Implémentation en attente de la spécification exacte (format de fichier, colonnes,
 * « petites fonctionnalités ») du projet medoutils. Écran de cadrage en attendant.
 */
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { tokens } from '@/ui/tokens';
import { RoleGate } from '@/ui/RoleGate';
import { ToolsMenu } from '@/ui/ToolsMenu';

const PLANNED = [
  'Importer un fichier (CSV/Excel) avec les notes de toute la promo.',
  'Voir mon classement (rang, moyenne, médiane, percentile).',
  'Comparer avec un autre numéro étudiant (ex. ma copine).',
  'Classement par matière + petites statistiques.',
];

function PartielInner() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ToolsMenu />
        </View>
        <Text style={styles.title}>Analyseur de classement</Text>
        <Text style={styles.subtitle}>
          Importe les notes de ta promo et situe-toi — calcul privé, sur ton appareil.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.badge}>🛠️ En cours de conception</Text>
          <Text style={styles.cardText}>
            Cet outil reprendra l’analyseur de classement de medoutils. Je finalise sa mise en place
            dès que j’ai la spécification (format du fichier, colonnes, fonctionnalités).
          </Text>
          <Text style={styles.listTitle}>Ce qu’il fera :</Text>
          {PLANNED.map((p) => (
            <View key={p} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{p}</Text>
            </View>
          ))}
          <Text style={styles.note}>
            Confidentialité : les notes des autres étudiants seront traitées localement et ne seront
            jamais envoyées à un serveur ni à une IA.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

export default function PartielScreen() {
  return (
    <RoleGate feature="partiel">
      <PartielInner />
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.md,
    paddingBottom: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: tokens.space.sm },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  subtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
    marginTop: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: tokens.space.lg },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
    overflow: 'hidden',
  },
  cardText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  listTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    marginTop: tokens.space.sm,
  },
  listItem: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'flex-start' },
  bullet: { color: tokens.colors.accent, fontSize: tokens.type.body.fontSize, lineHeight: 22 },
  listText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
  },
  note: {
    marginTop: tokens.space.sm,
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
