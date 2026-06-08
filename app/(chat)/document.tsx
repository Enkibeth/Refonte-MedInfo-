/**
 * Analyse de document médical — version premium.
 * L'utilisateur colle/saisit un compte rendu ou une ordonnance, et obtient :
 *  - un résumé patient clair
 *  - les termes médicaux expliqués
 *  - des questions à poser au médecin
 */
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/tokens';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { RoleGate } from '@/ui/RoleGate';
import { ToolsMenu } from '@/ui/ToolsMenu';

interface Analysis {
  text: string;
}

export default function DocumentScreen() {
  return (
    <RoleGate feature="document">
      <DocumentScreenInner />
    </RoleGate>
  );
}

function DocumentScreenInner() {
  const { session } = useSession();
  const [documentText, setDocumentText] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaid = Boolean(session); // simplified — replace with actual entitlement check

  async function handleAnalyze() {
    const text = documentText.trim();
    if (!text || loading) return;
    setError(null);
    setAnalysis(null);
    setLoading(true);

    try {
      const token = session?.access_token;
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ documentText: text }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? 'Erreur lors de l\'analyse. Réessayez.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Flux de réponse indisponible.');

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        // Show progressive result
        if (fullText.length > 20) setAnalysis({ text: fullText });
      }

      if (!fullText) throw new Error('Aucune réponse reçue. Réessayez.');
      setAnalysis({ text: fullText });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  if (!isPaid) {
    return <PremiumGate feature="Analyse de document" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ToolsMenu />
        </View>
        <Text style={styles.kicker}>/ OUTIL — DOCUMENT</Text>
        <Text style={styles.title}>Analyse de document</Text>
        <Text style={styles.subtitle}>
          Collez un compte rendu, une ordonnance ou des résultats pour obtenir un résumé patient.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <TextInput
          style={styles.textArea}
          value={documentText}
          onChangeText={setDocumentText}
          placeholder="Collez ici le texte de votre document médical…"
          placeholderTextColor={tokens.colors.textMuted}
          multiline
          editable={!loading}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[
            styles.button,
            (loading || documentText.trim().length < 20) && styles.buttonDisabled,
          ]}
          onPress={handleAnalyze}
          disabled={loading || documentText.trim().length < 20}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={tokens.colors.onAccent} size="small" />
          ) : (
            <Text style={styles.buttonText}>Analyser le document</Text>
          )}
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {analysis ? (
          <View style={styles.result}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Résumé patient</Text>
            </View>
            <View style={styles.resultBody}>
              <MarkdownRenderer text={analysis.text} />
            </View>
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                Ce résumé est informatif et ne remplace pas une consultation médicale.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PremiumGate({ feature }: { feature: string }) {
  return (
    <View style={styles.gateContainer}>
      <View style={styles.gateCard}>
        <Text style={styles.gateEmoji}>🔒</Text>
        <Text style={styles.gateTitle}>{feature}</Text>
        <Text style={styles.gateText}>
          Cette fonctionnalité est réservée aux abonnés MedInfo Premium. Elle vous permet
          d'obtenir un résumé patient clair de vos documents médicaux avec les termes expliqués
          et des questions à poser à votre médecin.
        </Text>
        <Link href="/(billing)/pricing" style={styles.gateLink}>
          Voir les offres Premium
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.xl,
    paddingBottom: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: tokens.space.sm },
  kicker: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accent,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
    textTransform: 'uppercase',
    marginBottom: tokens.space.sm,
  },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
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
  scrollContent: { padding: tokens.space.lg, gap: tokens.space.md },
  textArea: {
    minHeight: 160,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfacePure,
    padding: tokens.space.md,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
    lineHeight: tokens.type.body.lineHeight,
  },
  button: {
    height: tokens.size.controlLg,
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.accent,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.md,
  },
  buttonDisabled: {
    backgroundColor: tokens.colors.surfaceSunken,
    borderColor: tokens.colors.borderSoft,
    ...(Platform.select({ web: { boxShadow: 'none' } as object, default: {} })),
  },
  buttonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: tokens.type.label.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorBox: {
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    borderLeftWidth: tokens.space.sm,
    borderLeftColor: tokens.colors.danger,
    backgroundColor: tokens.colors.dangerBackground,
    padding: tokens.space.lg,
  },
  errorText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
  },
  result: {
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfacePure,
    overflow: 'hidden',
    ...tokens.elevation.md,
  },
  resultHeader: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.accent,
    borderBottomWidth: tokens.border.bold,
    borderBottomColor: tokens.colors.border,
  },
  resultTitle: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
    textTransform: 'uppercase',
    fontWeight: tokens.weight.bold,
  },
  resultBody: { padding: tokens.space.lg },
  disclaimer: {
    padding: tokens.space.md,
    borderTopWidth: tokens.border.bold,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.warningBackground,
  },
  disclaimerText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.warningText,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    lineHeight: 18,
  },
  gateContainer: { flex: 1, justifyContent: 'center', padding: tokens.space.xl, backgroundColor: tokens.colors.background },
  gateCard: {
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfacePure,
    padding: tokens.space.xl,
    alignItems: 'center',
    gap: tokens.space.md,
    ...tokens.elevation.md,
  },
  gateEmoji: { fontSize: 40 },
  gateTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.type.h2.letterSpacing,
    textAlign: 'center',
  },
  gateText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    textAlign: 'center',
    maxWidth: 340,
  },
  gateLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: tokens.type.label.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
    marginTop: tokens.space.sm,
  },
});
