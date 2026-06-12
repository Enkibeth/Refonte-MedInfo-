/**
 * Analyse de document médical — version premium.
 * L'utilisateur colle un texte OU importe un fichier (PDF, photo JPEG/PNG/WebP, texte)
 * d'un compte rendu / ordonnance / résultats, et obtient au choix :
 *  - une analyse : résumé patient clair, termes expliqués, questions au médecin ;
 *  - une traduction fidèle dans la langue de son choix.
 * Le document n'est jamais conservé : seul le résultat IA est archivé dans
 * l'historique (`document_analyses`, archivage serveur via /api/analyze onFinish).
 */
import { useCallback, useEffect, useState } from 'react';
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
import {
  listAnalyses,
  deleteAnalysis,
  type AnalysisMode,
  type DocumentAnalysis,
} from '@/document/analysisHistory';

interface Analysis {
  text: string;
}

interface PickedFile {
  file: File;
  name: string;
  size: number;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_FILES = '.pdf,.jpg,.jpeg,.png,.webp,.txt,application/pdf,image/jpeg,image/png,image/webp,text/plain';

export default function DocumentScreen() {
  return (
    <RoleGate feature="document">
      <DocumentScreenInner />
    </RoleGate>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

function DocumentScreenInner() {
  const { session } = useSession();
  const [documentText, setDocumentText] = useState('');
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('analysis');
  const [targetLanguage, setTargetLanguage] = useState('Français');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [resultLabel, setResultLabel] = useState('Résumé patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DocumentAnalysis[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const userId = session?.user?.id ?? null;
  const isPaid = Boolean(session); // simplified — replace with actual entitlement check

  const refreshHistory = useCallback(async () => {
    if (!userId) return;
    setHistory(await listAnalyses(userId));
  }, [userId]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  function pickFile() {
    if (Platform.OS !== 'web' || loading) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_FILES;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        setError('Fichier trop volumineux (maximum 15 Mo).');
        return;
      }
      setError(null);
      setPickedFile({ file, name: file.name, size: file.size });
    };
    input.click();
  }

  const canSubmit = !loading && (pickedFile !== null || documentText.trim().length >= 20);

  async function handleAnalyze() {
    if (!canSubmit) return;
    setError(null);
    setAnalysis(null);
    setResultLabel(mode === 'translation' ? `Traduction — ${targetLanguage.trim() || 'Français'}` : 'Résumé patient');
    setLoading(true);

    try {
      const token = session?.access_token;
      const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      let response: Response;
      if (pickedFile) {
        const form = new FormData();
        form.append('file', pickedFile.file);
        form.append('mode', mode);
        form.append('targetLanguage', targetLanguage.trim());
        response = await fetch('/api/analyze', { method: 'POST', headers: authHeader, body: form });
      } else {
        response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            documentText: documentText.trim(),
            mode,
            targetLanguage: targetLanguage.trim(),
          }),
        });
      }

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
      // L'archivage serveur (onFinish) suit immédiatement la fin du stream.
      setTimeout(() => void refreshHistory(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  function openHistoryItem(item: DocumentAnalysis) {
    setAnalysis({ text: item.result });
    setResultLabel(
      item.mode === 'translation'
        ? `Traduction — ${item.target_language ?? ''} · ${item.source_name ?? 'Document'}`
        : `Résumé patient · ${item.source_name ?? 'Document'}`,
    );
    setHistoryOpen(false);
    setError(null);
  }

  async function handleDeleteHistory(id: string) {
    await deleteAnalysis(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
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
          Importez un PDF, une photo ou collez le texte d'un compte rendu, d'une ordonnance ou de
          résultats — pour un résumé patient clair ou une traduction.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {userId ? (
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setHistoryOpen((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.historyToggleText}>
              {historyOpen ? '▾' : '▸'} Mes analyses ({history.length})
            </Text>
          </TouchableOpacity>
        ) : null}

        {historyOpen ? (
          <View style={styles.historyList}>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>Aucune analyse enregistrée pour le moment.</Text>
            ) : (
              history.map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <TouchableOpacity
                    style={styles.historyItemBody}
                    onPress={() => openHistoryItem(item)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.historyItemTitle} numberOfLines={1}>
                      {item.source_name ?? 'Document'}
                    </Text>
                    <Text style={styles.historyItemMeta}>
                      {item.mode === 'translation'
                        ? `Traduction${item.target_language ? ` · ${item.target_language}` : ''}`
                        : 'Analyse'}
                      {' · '}
                      {formatDate(item.created_at)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void handleDeleteHistory(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Supprimer cette analyse"
                    style={styles.historyDelete}
                  >
                    <Text style={styles.historyDeleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            <Text style={styles.historyNote}>
              Seul le résultat de l'analyse est conservé — jamais le document importé.
            </Text>
          </View>
        ) : null}

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'analysis' && styles.modeButtonActive]}
            onPress={() => setMode('analysis')}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={[styles.modeButtonText, mode === 'analysis' && styles.modeButtonTextActive]}>
              Analyse
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'translation' && styles.modeButtonActive]}
            onPress={() => setMode('translation')}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={[styles.modeButtonText, mode === 'translation' && styles.modeButtonTextActive]}>
              Traduction
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'translation' ? (
          <View style={styles.languageRow}>
            <Text style={styles.languageLabel}>Langue cible</Text>
            <TextInput
              style={styles.languageInput}
              value={targetLanguage}
              onChangeText={setTargetLanguage}
              placeholder="Français, English, العربية…"
              placeholderTextColor={tokens.colors.textMuted}
              editable={!loading}
            />
          </View>
        ) : null}

        {Platform.OS === 'web' ? (
          pickedFile ? (
            <View style={styles.fileChip}>
              <Text style={styles.fileChipName} numberOfLines={1}>
                📎 {pickedFile.name}
              </Text>
              <Text style={styles.fileChipSize}>{formatSize(pickedFile.size)}</Text>
              <TouchableOpacity
                onPress={() => setPickedFile(null)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Retirer le fichier"
              >
                <Text style={styles.fileChipRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadButton} onPress={pickFile} accessibilityRole="button">
              <Text style={styles.uploadButtonText}>
                Importer un fichier (PDF, photo JPEG/PNG, texte)
              </Text>
              <Text style={styles.uploadButtonHint}>15 Mo maximum — ou collez le texte ci-dessous</Text>
            </TouchableOpacity>
          )
        ) : null}

        {!pickedFile ? (
          <TextInput
            style={styles.textArea}
            value={documentText}
            onChangeText={setDocumentText}
            placeholder="Ou collez ici le texte de votre document médical…"
            placeholderTextColor={tokens.colors.textMuted}
            multiline
            editable={!loading}
            textAlignVertical="top"
          />
        ) : null}

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleAnalyze}
          disabled={!canSubmit}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={tokens.colors.onAccent} size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'translation' ? 'Traduire le document' : 'Analyser le document'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.privacyNote}>
          Le document importé n'est pas conservé : il est transmis à l'IA puis oublié. Seul le
          résultat est enregistré dans votre historique.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {analysis ? (
          <View style={styles.result}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>{resultLabel}</Text>
            </View>
            <View style={styles.resultBody}>
              <MarkdownRenderer text={analysis.text} />
            </View>
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                Ce résultat est informatif et ne remplace pas une consultation médicale.
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
          d'obtenir un résumé patient clair ou une traduction de vos documents médicaux (PDF,
          photo ou texte) avec les termes expliqués et des questions à poser à votre médecin.
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
  historyToggle: { alignSelf: 'flex-start' },
  historyToggleText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  historyList: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.sm,
    gap: 2,
  },
  historyEmpty: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    padding: tokens.space.sm,
  },
  historyItem: { flexDirection: 'row', alignItems: 'center' },
  historyItemBody: {
    flex: 1,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.sm,
  },
  historyItemTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  historyItemMeta: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginTop: 2,
  },
  historyDelete: { padding: tokens.space.sm },
  historyDeleteText: { color: tokens.colors.textMuted, fontSize: 14 },
  historyNote: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    padding: tokens.space.sm,
    fontStyle: 'italic',
  },
  modeRow: { flexDirection: 'row', gap: tokens.space.sm },
  modeButton: {
    flex: 1,
    height: 40,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurface,
  },
  modeButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  modeButtonTextActive: { color: tokens.colors.accentDeep },
  languageRow: { gap: 6 },
  languageLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  languageInput: {
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
  },
  uploadButton: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurface,
    padding: tokens.space.lg,
    alignItems: 'center',
    gap: 4,
  },
  uploadButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  uploadButtonHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  fileChipName: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  fileChipSize: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  fileChipRemove: { color: tokens.colors.textMuted, fontSize: 14, padding: 4 },
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
  privacyNote: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
    textAlign: 'center',
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
