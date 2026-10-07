/**
 * Analyse des partiels (v3) — outil étudiant (persona student).
 *
 * L'outil complet vit dans la page autonome `public/partiel.html` (import .xlsx/.csv/.pdf,
 * coefficients, statistiques et distribution RÉELLE par épreuve, z-scores, simulateur
 * « et si », comparaison A/B, suivi de progression local, exports CSV/PDF), embarquée ici
 * en iframe. Traitement 100 % CÔTÉ CLIENT : les notes ne quittent jamais l'appareil
 * (aucune IA, aucun réseau) — confidentialité des données de tiers. Seuls les résultats
 * DÉRIVÉS de l'étudiant lui-même peuvent être mémorisés, sur son appareil (ADR-0035).
 *
 * L'en-tête de page vit ici (côté natif) : la page embarquée n'en a plus, pour éviter
 * le double titre sous le shell applicatif.
 *
 * Relais du chat (ADR-0044) : un relevé de notes choisi dans le chat n'est pas envoyé à
 * l'IA ; il est transmis ICI, à la page embarquée (même origine, postMessage), comme un
 * fichier choisi à la main — il ne quitte toujours pas l'appareil. Dans l'autre sens, la
 * page peut préparer pour le chat un message ne contenant que les résultats de l'étudiant
 * (`chatBriefing`, bloc @partiel-logic) : il s'ouvre pré-rempli, jamais envoyé d'office.
 */
import { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { useModuleHandoff } from '@/chat/useModuleHandoff';
import { chatHandoffText, offerHandoff, type HandoffFile } from '@/chat/moduleHandoff';

import { tokens } from '@/ui/tokens';
import { PAGE_SEO, breadcrumbJsonLd, webApplicationJsonLd } from '@/seo/meta';
import { SeoHead } from '@/ui/SeoHead';
import { RoleGate } from '@/ui/RoleGate';
import { ToolScreenHeader } from '@/ui/ToolScreenHeader';

const PAGE_PATH = '/partiel.html';

function PartielInner() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const pendingFileRef = useRef<HandoffFile | null>(null);

  // La page embarquée est prête quand son script a tourné : signal explicite de sa part,
  // `load` de l'iframe, ou document déjà complet (iframe chargée avant l'hydratation).
  const frameReady = useCallback(() => {
    if (readyRef.current) return true;
    try {
      const doc = iframeRef.current?.contentDocument;
      return !!doc && doc.readyState === 'complete' && doc.location.pathname.endsWith(PAGE_PATH);
    } catch {
      return false;
    }
  }, []);

  const deliver = useCallback(() => {
    const file = pendingFileRef.current;
    const win = iframeRef.current?.contentWindow;
    if (!file || !win || !frameReady()) return;
    pendingFileRef.current = null;
    win.postMessage({ type: 'medinfo:partiel-file', file }, window.location.origin);
  }, [frameReady]);

  useModuleHandoff(
    'partiel',
    (handoff) => {
      pendingFileRef.current = handoff.file;
      deliver();
    },
    Platform.OS === 'web',
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string; text?: unknown } | null;
      if (data?.type === 'medinfo:partiel-ready') {
        readyRef.current = true;
        deliver();
      } else if (data?.type === 'medinfo:ask-chat') {
        const text = chatHandoffText(data.text);
        if (!text) return;
        offerHandoff({ tool: 'chat', text, chatbot: 'student', source: 'Partiels' });
        router.push('/(chat)/chat' as never);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [deliver, router]);

  return (
    <View style={styles.container}>
      <ToolScreenHeader feature="partiel" title="Analyse des partiels">
        Importe les notes de ta promo (.xlsx, .csv, .pdf) : rang, coefficients, points forts et
        simulateur. Calcul privé, sur ton appareil.
      </ToolScreenHeader>

      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          src={PAGE_PATH}
          title="Analyse des partiels"
          onLoad={() => {
            readyRef.current = true;
            deliver();
          }}
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
            name: 'Analyse des partiels',
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
    marginTop: tokens.space.xs,
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
