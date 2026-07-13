/**
 * Module CV Builder — outil étudiant + professionnel (personas student/professional).
 *
 * L'outil complet vit dans la page autonome `public/cv-builder.html` (éditeur structuré,
 * aperçu A4 live, export PDF par impression vectorielle, relecture IA, historique cloud),
 * embarquée ici en iframe.
 *  - Édition / aperçu / export PDF : 100 % côté client (aucune donnée envoyée).
 *  - Relecture IA : POST /api/cv (compte vérifié étudiant/pro/admin) — CV minimisé (RGPD).
 *  - Sauvegarde cloud : /api/cv-docs (own-row RLS).
 *
 * Le token de session est transmis à l'iframe (même origine) par postMessage : la page
 * autonome l'ajoute en `Authorization: Bearer …`. RoleGate conservé en défense en
 * profondeur (l'autorisation réelle reste serveur — serverPersona).
 */
import { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/tokens';
import { PAGE_SEO, breadcrumbJsonLd, webApplicationJsonLd } from '@/seo/meta';
import { SeoHead } from '@/ui/SeoHead';
import { RoleGate } from '@/ui/RoleGate';
import { ToolsMenu } from '@/ui/ToolsMenu';

function CvBuilderInner() {
  const { session } = useSession();
  const token = session?.access_token ?? null;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const postToken = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: 'medinfo:auth', token }, window.location.origin);
  }, [token]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    postToken();
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type === 'medinfo:auth-request') postToken();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [postToken]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ToolsMenu />
        </View>
        <Text style={styles.title}>Créateur de CV</Text>
        <Text style={styles.subtitle}>
          Construis ton CV médical, fais-le relire par l'IA (suggestions à valider) et exporte
          un PDF propre — la création, l'édition et l'export sont gratuits.
        </Text>
      </View>

      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          src="/cv-builder.html"
          title="Créateur de CV"
          onLoad={postToken}
          style={{ flex: 1, width: '100%', border: 'none', backgroundColor: tokens.colors.surface }}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            Le créateur de CV (éditeur, aperçu, export PDF) est disponible sur la version web de
            MedInfo.
          </Text>
        </View>
      )}
    </View>
  );
}

export default function CvBuilderScreen() {
  return (
    <>
      {/* SEO par feature (2026-07) : titre/description/canonical + fiche WebApplication,
          rendus pour tous (y compris visiteurs) — RoleGate ne gate que le contenu. */}
      <SeoHead
        title={PAGE_SEO.cvBuilder.title}
        description={PAGE_SEO.cvBuilder.description}
        path={PAGE_SEO.cvBuilder.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Créateur de CV médical', path: PAGE_SEO.cvBuilder.path },
          ]),
          webApplicationJsonLd({
            name: 'Créateur de CV médical — MedInfo AI',
            description: PAGE_SEO.cvBuilder.description,
            path: PAGE_SEO.cvBuilder.path,
          }),
        ]}
      />
      <RoleGate feature="cv-builder">
        <CvBuilderInner />
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
