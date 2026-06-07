/**
 * Analyseur de partiel — outil étudiant (persona student).
 * L'étudiant colle ses résultats de partiel / session de QCM (questions + sa réponse +
 * la bonne réponse, ou un score par matière) et obtient :
 *  - une synthèse de performance
 *  - une analyse par item EDN / thème
 *  - les erreurs typiques à corriger
 *  - un plan de révision priorisé
 *
 * Strictement pédagogique (annales/QCM fictifs) — jamais un cas patient réel.
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

import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/tokens';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { RoleGate } from '@/ui/RoleGate';

const PLACEHOLDER = `Colle ici tes résultats. Exemples acceptés :
• Liste : "Q1 item 224 HTA — ma réponse B / correct C ; Q2 item 330 AINS — ma réponse A / correct A …"
• Score par matière : "Cardio 12/20, Pneumo 8/20, Infectio 15/20 …"
• Items ratés : "Items 224, 330, 91 non maîtrisés"`;

function PartielInner() {
  const { session } = useSession();
  const [resultsText, setResultsText] = useState('');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    const text = resultsText.trim();
    if (text.length < 20 || loading) return;
    setError(null);
    setAnalysis(null);
    setLoading(true);

    try {
      const token = session?.access_token;
      const response = await fetch('/api/partiel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ results: text }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Erreur lors de l'analyse. Réessaie.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Flux de réponse indisponible.');

      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        if (fullText.length > 20) setAnalysis(fullText);
      }

      if (!fullText) throw new Error('Aucune réponse reçue. Réessaie.');
      setAnalysis(fullText);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Analyseur de partiel</Text>
        <Text style={styles.subtitle}>
          Colle tes résultats de QCM / partiel : l’IA repère tes items EDN faibles et te propose un
          plan de révision.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <TextInput
          style={styles.textArea}
          value={resultsText}
          onChangeText={setResultsText}
          placeholder={PLACEHOLDER}
          placeholderTextColor={tokens.colors.textMuted}
          multiline
          editable={!loading}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.button, (loading || resultsText.trim().length < 20) && styles.buttonDisabled]}
          onPress={handleAnalyze}
          disabled={loading || resultsText.trim().length < 20}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={tokens.colors.onAccent} size="small" />
          ) : (
            <Text style={styles.buttonText}>Analyser mes résultats</Text>
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
              <Text style={styles.resultTitle}>Analyse & plan de révision</Text>
            </View>
            <View style={styles.resultBody}>
              <MarkdownRenderer text={analysis} />
            </View>
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                Outil pédagogique d’entraînement aux examens — ne constitue pas un avis médical.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingTop: tokens.space.xl,
    paddingBottom: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
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
});
