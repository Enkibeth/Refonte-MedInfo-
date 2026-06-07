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
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: tokens.space.sm },
  title: {
    fontFamily: tokens.font.sans,
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
  scrollContent: { padding: tokens.space.lg, gap: tokens.space.md },
  textArea: {
    minHeight: 160,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.md,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
    lineHeight: tokens.type.body.lineHeight,
  },
  button: {
    height: 48,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  errorBox: {
    borderRadius: tokens.radius.md,
    borderLeftWidth: 4,
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
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    overflow: 'hidden',
    ...tokens.elevation.sm,
  },
  resultHeader: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.accentSurface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.accentSurfaceStrong,
  },
  resultTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  resultBody: { padding: tokens.space.lg },
  disclaimer: {
    padding: tokens.space.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.warningBackground,
  },
  disclaimerText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.warningText,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
  },
  gateContainer: { flex: 1, justifyContent: 'center', padding: tokens.space.xl, backgroundColor: tokens.colors.background },
  gateCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.xl,
    alignItems: 'center',
    gap: tokens.space.md,
    ...tokens.elevation.md,
  },
  gateEmoji: { fontSize: 40 },
  gateTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.type.h3.letterSpacing,
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
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.lg,
    overflow: 'hidden',
    marginTop: tokens.space.sm,
  },
});
