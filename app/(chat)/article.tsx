/**
 * Module Rédaction d'article médical — outil étudiant + professionnel (ADR-0031).
 *
 * L'outil complet vit dans la page autonome `public/article.html` (éditeur IMRaD par
 * type de document, compteurs de caractères/mots avec limites, bibliographie
 * Vancouver/APA avec import DOI/PMID, aides IA, contrôle d'originalité, exports Word/
 * Markdown, historique cloud), embarquée ici en iframe.
 *  - Rédaction / compteurs / bibliographie / exports : 100 % côté client.
 *  - Aides IA (rédaction, réduction, originalité) : POST /api/article (compte vérifié
 *    étudiant/pro/admin) — contexte minimisé (une section + plan, jamais les auteurs).
 *  - Sauvegarde cloud : /api/article-docs (own-row RLS).
 *
 * Le token de session est transmis à l'iframe (même origine) par postMessage : la page
 * autonome l'ajoute en `Authorization: Bearer …`. RoleGate conservé en défense en
 * profondeur (l'autorisation réelle reste serveur — serverPersona).
 */
import { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/tokens';
import { RoleGate } from '@/ui/RoleGate';
import { ToolsMenu } from '@/ui/ToolsMenu';

function ArticleWriterInner() {
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
        <Text style={styles.title}>Rédaction d'article</Text>
        <Text style={styles.subtitle}>
          Structure ton article, ta thèse ou ton abstract : compteurs de caractères,
          bibliographie Vancouver, aides IA à la rédaction et contrôle d'originalité —
          l'écriture, les compteurs et les exports sont gratuits.
        </Text>
      </View>

      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          src="/article.html"
          title="Rédaction d'article médical"
          onLoad={postToken}
          style={{ flex: 1, width: '100%', border: 'none', backgroundColor: tokens.colors.surface }}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            L'outil de rédaction d'article (éditeur, compteurs, bibliographie, exports) est
            disponible sur la version web de MedInfo.
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ArticleWriterScreen() {
  return (
    <RoleGate feature="article">
      <ArticleWriterInner />
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
