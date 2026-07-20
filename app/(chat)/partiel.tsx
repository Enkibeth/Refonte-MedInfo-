/**
 * Analyse des partiels (v2) — outil étudiant (persona student).
 *
 * L'outil complet vit dans la page autonome `public/partiel.html` (import .xlsx/.csv/.pdf,
 * statistiques par épreuve, distributions, comparaison A/B, export PDF), embarquée ici en
 * iframe. Traitement 100 % CÔTÉ CLIENT : les notes ne quittent jamais l'appareil
 * (aucune IA, aucun réseau, aucune persistance) — confidentialité des données de tiers.
 */
import { View, Text, StyleSheet, Platform } from 'react-native';

import { tokens } from '@/ui/tokens';
import { PAGE_SEO, breadcrumbJsonLd, webApplicationJsonLd } from '@/seo/meta';
import { SeoHead } from '@/ui/SeoHead';
import { RoleGate } from '@/ui/RoleGate';
import { ToolsMenu } from '@/ui/ToolsMenu';

function PartielInner() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ToolsMenu />
        </View>
        <Text style={styles.title}>Analyse des partiels</Text>
        <Text style={styles.subtitle}>
          Importe les notes de ta promo (.xlsx, .csv, .pdf) et situe-toi : calcul privé, sur ton
          appareil.
        </Text>
      </View>

      {Platform.OS === 'web' ? (
        <iframe
          src="/partiel.html"
          title="Analyse des partiels"
          style={{ flex: 1, width: '100%', border: 'none', backgroundColor: tokens.colors.surface }}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            L’analyse des partiels (import Excel/PDF, graphiques, export) est disponible sur la
            version web de MedInfo.
          </Text>
        </View>
      )}
    </View>
  );
}

export default function PartielScreen() {
  return (
    <>
      {/* SEO par feature (2026-07) : titre/description/canonical + fiche WebApplication,
          rendus pour tous (y compris visiteurs) — RoleGate ne gate que le contenu. */}
      <SeoHead
        title={PAGE_SEO.partiel.title}
        description={PAGE_SEO.partiel.description}
        path={PAGE_SEO.partiel.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Analyse des partiels', path: PAGE_SEO.partiel.path },
          ]),
          webApplicationJsonLd({
            name: 'Analyse des partiels — MedInfo AI',
            description: PAGE_SEO.partiel.description,
            path: PAGE_SEO.partiel.path,
          }),
        ]}
      />
      <RoleGate feature="partiel">
        <PartielInner />
      </RoleGate>
    </>
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
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  subtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
    marginTop: 4,
  },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: tokens.space.lg },
  fallbackText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    textAlign: 'center',
  },
});
