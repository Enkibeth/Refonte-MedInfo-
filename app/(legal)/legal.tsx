import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  CANONICAL_REFUSAL,
  INTENDED_PURPOSE,
  getAiDisclosure,
} from '@/compliance/disclosures';
import { Card } from '@/ui/Card';
import { Logo } from '@/ui/Logo';
import { Screen } from '@/ui/Screen';
import { tokens } from '@/ui/tokens';

/**
 * Informations légales (01_REGULATION §8 — mentions obligatoires).
 *
 * Source unique pour le texte réglementaire partagé : `src/compliance/disclosures.ts`
 * (intended purpose verbatim §1, disclosure AI Act art. 50 §6, refus canonique §4). Les
 * éléments d'identification (éditeur LCEN, hébergeur, DPO) sont à compléter par Hugo
 * AVANT le lancement public — marqués « [À compléter avant lancement] ».
 */
const PENDING = '[À compléter avant lancement]';

export default function LegalScreen() {
  return (
    <Screen maxWidth={760}>
      <View style={styles.brandHeader}>
        <Logo size="sm" />
      </View>
      <Text style={styles.title}>Informations légales</Text>
      <Text style={styles.lead}>
        Mentions légales, finalité du service, statut réglementaire, information sur l’IA et
        protection des données — conformément à la LCEN (art. 6), au RGPD et à l’EU AI Act.
      </Text>

      {/* Finalité prévue (intended purpose verbatim — 01_REGULATION §1) */}
      <Card style={styles.section}>
        <Text style={styles.h2}>Finalité du service</Text>
        <Text style={styles.body}>{INTENDED_PURPOSE}</Text>
      </Card>

      {/* Statut réglementaire — non-MDSW (01_REGULATION §2) */}
      <Card style={styles.section}>
        <Text style={styles.h2}>Statut réglementaire</Text>
        <Text style={styles.body}>
          MedInfo AI n’est pas un dispositif médical au sens de l’article 2(1) du règlement
          (UE) 2017/745 et n’est pas qualifié de logiciel-dispositif médical (MDSW). Le service
          ne fournit aucune recommandation diagnostique, pronostique ou thérapeutique
          individuelle et refuse de façon déterministe toute demande portant sur une situation
          personnelle identifiable.
        </Text>
      </Card>

      {/* Disclosure AI Act art. 50 (01_REGULATION §6) */}
      <Card style={styles.section}>
        <Text style={styles.h2}>Interaction avec une intelligence artificielle</Text>
        <Text style={styles.body}>{getAiDisclosure()}</Text>
        <Text style={[styles.body, styles.bodyMuted]}>
          Information délivrée au titre de l’article 50(1) du règlement (UE) 2024/1689 (EU AI
          Act). Le système relève du « risque limité » : il ne réalise aucun acte médical.
        </Text>
      </Card>

      {/* Disclaimer médical permanent (refus canonique — 01_REGULATION §4) */}
      <Card style={styles.section}>
        <Text style={styles.h2}>Avertissement médical</Text>
        <View style={styles.disclaimer}>
          <View style={styles.disclaimerAccent} />
          <Text style={styles.disclaimerText}>{CANONICAL_REFUSAL}</Text>
        </View>
      </Card>

      {/* Mentions légales — éditeur + hébergeur (LCEN art. 6) */}
      <Card style={styles.section}>
        <Text style={styles.h2}>Mentions légales</Text>

        <Text style={styles.h3}>Éditeur</Text>
        <Text style={styles.body}>
          Hugo Bettembourg{'\n'}
          Statut juridique : {PENDING}{'\n'}
          SIRET / RCS : {PENDING}{'\n'}
          Adresse : {PENDING}{'\n'}
          Contact : {PENDING}{'\n'}
          Directeur de la publication : Hugo Bettembourg
        </Text>

        <Text style={styles.h3}>Hébergeur</Text>
        <Text style={styles.body}>
          Application web hébergée par Vercel Inc.{'\n'}
          340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis{'\n'}
          Base de données et authentification : Supabase ({PENDING} — région UE).
        </Text>
      </Card>

      {/* Protection des données — RGPD art. 13 (01_REGULATION §5) */}
      <Card style={styles.section}>
        <Text style={styles.h2}>Données personnelles & confidentialité</Text>
        <Text style={styles.body}>
          MedInfo AI suit un principe de minimisation : aucune donnée de santé identifiable
          n’est conservée. Les échanges du chat sont traités sans profil de santé attribuable
          (mode « stateless anonyme », 01_REGULATION §5). Les seules données personnelles
          traitées concernent le compte (email, rôle) et des compteurs techniques anonymisés.
        </Text>
        <Text style={styles.body}>
          Sous-traitants : le ou les fournisseurs de modèles d’IA (Anthropic et/ou OpenAI) et
          Supabase, encadrés par un DPA et des clauses contractuelles types (art. 28 RGPD), avec
          résidence et transferts couverts par les garanties appropriées. Base légale, durées de
          conservation détaillées et coordonnées du délégué à la protection des données :{' '}
          {PENDING}.
        </Text>
        <Text style={[styles.body, styles.bodyMuted]}>
          Conformément aux articles 15 à 22 du RGPD, vous disposez de droits d’accès, de
          rectification, d’effacement et d’opposition. Vous pouvez aussi saisir la CNIL.
        </Text>
      </Card>

      <View style={styles.footer}>
        <Link href="/" style={styles.inlineLink}>
          Retour à l’accueil
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandHeader: { marginBottom: tokens.space.lg },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h1.fontSize,
    lineHeight: tokens.type.h1.lineHeight,
    letterSpacing: tokens.type.h1.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginBottom: tokens.space.sm,
  },
  lead: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  section: { marginTop: tokens.space.lg },
  h2: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginBottom: tokens.space.sm,
  },
  h3: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    marginTop: tokens.space.md,
    marginBottom: tokens.space.xs,
  },
  body: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    marginBottom: tokens.space.sm,
  },
  bodyMuted: { fontSize: tokens.type.label.fontSize, lineHeight: 21 },
  disclaimer: {
    flexDirection: 'row',
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.warningBackground,
  },
  disclaimerAccent: { width: 4, backgroundColor: tokens.colors.warningText },
  disclaimerText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.warningText,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
    padding: tokens.space.lg,
  },
  footer: { marginTop: tokens.space.xl },
  inlineLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});
