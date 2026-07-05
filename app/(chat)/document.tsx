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
import { useSession } from '@/auth/AuthProvider';
import { Icon } from '@/ui/icons';
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
import { exportAnalysisToPdf } from '@/document/exportAnalysisPdf';
import {
  citationPagesLabel,
  splitAnalysisResult,
  visibleAnalysisText,
  type DocumentCitation,
} from '@/document/citations';

interface Analysis {
  text: string;
  /** Passages exacts du document cités par le modèle (citations ancrées, modèle Claude). */
  citations: DocumentCitation[];
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
  const [copied, setCopied] = useState(false);

  const userId = session?.user?.id ?? null;

  const refreshHistory = useCallback(async () => {
    if (!userId) return;
    setHistory(await listAnalyses(userId));
  }, [userId]);

  // L'archivage serveur (onFinish) suit la fin du stream mais peut prendre plus d'une
  // seconde : on ré-interroge l'historique quelques fois jusqu'à voir apparaître la
  // nouvelle analyse, au lieu d'un unique setTimeout qui la manquait souvent.
  const pollHistoryUntilNew = useCallback(
    async (beforeCount: number) => {
      for (const delay of [1200, 2500, 4000]) {
        await new Promise((r) => setTimeout(r, delay));
        if (!userId) return;
        const list = await listAnalyses(userId);
        setHistory(list);
        if (list.length > beforeCount) return;
      }
    },
    [userId],
  );

  const handleCopy = useCallback(async () => {
    if (!analysis?.text) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(analysis.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* presse-papiers indisponible — l'utilisateur peut sélectionner le texte */
    }
  }, [analysis]);

  const handleExportPdf = useCallback(() => {
    if (!analysis?.text) return;
    exportAnalysisToPdf({ title: resultLabel, markdown: analysis.text, citations: analysis.citations });
  }, [analysis, resultLabel]);

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
        // Show progressive result (le pied CITATIONS, même partiel, n'est jamais affiché)
        if (fullText.length > 20) setAnalysis({ text: visibleAnalysisText(fullText), citations: [] });
      }

      if (!fullText) throw new Error('Aucune réponse reçue. Réessayez.');
      const { text: finalText, citations } = splitAnalysisResult(fullText);
      setAnalysis({ text: finalText, citations });
      // Rafraîchit l'historique jusqu'à voir apparaître la nouvelle analyse archivée.
      void pollHistoryUntilNew(history.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  function openHistoryItem(item: DocumentAnalysis) {
    const { text, citations } = splitAnalysisResult(item.result);
    setAnalysis({ text, citations });
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
                    <Icon name="x" size={15} color={tokens.colors.textMuted} />
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
              <Icon name="fileText" size={16} color={tokens.colors.accentDeep} />
              <Text style={styles.fileChipName} numberOfLines={1}>
                {pickedFile.name}
              </Text>
              <Text style={styles.fileChipSize}>{formatSize(pickedFile.size)}</Text>
              <TouchableOpacity
                onPress={() => setPickedFile(null)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Retirer le fichier"
                style={styles.fileChipRemove}
              >
                <Icon name="x" size={15} color={tokens.colors.textMuted} />
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
              {!loading && analysis.text ? (
                <View style={styles.resultActions}>
                  <TouchableOpacity
                    onPress={handleCopy}
                    accessibilityRole="button"
                    accessibilityLabel="Copier le résultat"
                    style={styles.resultAction}
                  >
                    <Text style={styles.resultActionText}>{copied ? 'Copié ✓' : 'Copier'}</Text>
                  </TouchableOpacity>
                  {Platform.OS === 'web' ? (
                    <TouchableOpacity
                      onPress={handleExportPdf}
                      accessibilityRole="button"
                      accessibilityLabel="Exporter le résultat en PDF"
                      style={styles.resultAction}
                    >
                      <Text style={styles.resultActionText}>Export PDF</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View style={styles.resultBody}>
              <MarkdownRenderer text={analysis.text} />
            </View>
            {analysis.citations.length > 0 ? (
              <View style={styles.citations}>
                <Text style={styles.citationsTitle}>Passages du document cités</Text>
                <Text style={styles.citationsHint}>
                  Chaque extrait ci-dessous provient mot pour mot de votre document : vous pouvez
                  vérifier sur quoi s'appuie l'analyse.
                </Text>
                {analysis.citations.map((c, i) => {
                  const pages = citationPagesLabel(c);
                  return (
                    <View key={i} style={styles.citationCard}>
                      <Text style={styles.citationText}>« {c.text} »</Text>
                      {pages ? <Text style={styles.citationPages}>{pages}</Text> : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
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
  fileChipRemove: { padding: 4 },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.accentSurface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.accentSurfaceStrong,
  },
  resultTitle: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  resultActions: { flexDirection: 'row', gap: tokens.space.xs },
  resultAction: {
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 6,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.surface,
  },
  resultActionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  resultBody: { padding: tokens.space.lg },
  citations: {
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.lg,
    gap: tokens.space.sm,
  },
  citationsTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  citationsHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginBottom: tokens.space.xs,
  },
  citationCard: {
    backgroundColor: tokens.colors.accentSurface,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.accent,
    borderRadius: tokens.radius.sm,
    padding: tokens.space.md,
    gap: 4,
  },
  citationText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.caption.fontSize,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  citationPages: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
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
