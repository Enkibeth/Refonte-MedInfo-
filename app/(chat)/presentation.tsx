/**
 * Générateur de présentations — outil étudiant + professionnel (personas student/professional).
 *
 * L'outil complet vit dans la page autonome `public/presentation.html` (mode manuel +
 * mode IA, aperçu, export PPTX compatible Keynote), embarquée ici en iframe.
 *  - Mode MANUEL : 100 % côté client (export PPTX dans le navigateur, aucune donnée envoyée).
 *  - Mode IA : appelle POST /api/presentation, qui exige un compte vérifié étudiant/pro/admin.
 *
 * Le token de session est transmis à l'iframe (même origine) par postMessage : la page
 * autonome l'ajoute en `Authorization: Bearer …` pour le mode IA. RoleGate conservé en
 * défense en profondeur (l'autorisation réelle reste serveur — serverPersona).
 */
import { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/theme/tokens';
import { RoleGate } from '@/ui/components/RoleGate';
import { ToolsMenu } from '@/ui/components/ToolsMenu';

function PresentationInner() {
  const { session } = useSession();
  const token = session?.access_token ?? null;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Transmet le token à l'iframe (même origine). La page autonome s'en sert pour
  // authentifier le mode IA ; elle peut aussi le redemander au chargement.
  const postToken = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: 'medinfo:auth', token }, window.location.origin);
  }, [token]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    postToken();
    // La page autonome demande le token dès qu'elle est prête (course de chargement).
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
        <Text style={styles.title}>Générateur de présentations</Text>
        <Text style={styles.subtitle}>
          Construis tes slides médicales à la main ou avec un « médecin senior » IA, puis
          exporte en PPTX prêt pour Keynote.
        </Text>
      </View>

      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          src="/presentation.html"
          title="Générateur de présentations"
          onLoad={postToken}
          style={{ flex: 1, width: '100%', border: 'none', backgroundColor: tokens.colors.surface }}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            Le générateur de présentations (éditeur, aperçu, export PPTX) est disponible sur la
            version web de MedInfo.
          </Text>
        </View>
      )}
    </View>
  );
}

export default function PresentationScreen() {
  return (
    <RoleGate feature="presentation">
      <PresentationInner />
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
