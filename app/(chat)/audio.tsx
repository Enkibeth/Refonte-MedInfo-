/**
 * Fonctionnalités audio + compte rendu — version premium (professionnel).
 * Mode 1 : Transcription d'un enregistrement audio (consultation, dictée).
 * Mode 2 : Rédaction d'un compte rendu médical structuré, depuis :
 *            • une dictée AUDIO (Whisper → diarisation → CR), ou
 *            • des NOTES TEXTE (collées / dictées) via /api/report,
 *          avec choix d'un MODÈLE de CR, édition, export/copie et historique LOCAL.
 *
 * Privacy-first (inspiré de QCM-quizz) : l'historique des CR reste sur l'appareil
 * (localStorage web, src/lib/reportHistory.ts) et n'est jamais envoyé à nos serveurs.
 */
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/tokens';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { RoleGate } from '@/ui/RoleGate';
import { ToolsMenu } from '@/ui/ToolsMenu';
import { DictationButton } from '@/ui/DictationButton';
import { REPORT_TEMPLATES, getReportTemplate, DEFAULT_TEMPLATE_ID } from '@/lib/reportTemplates';
import {
  loadReports,
  saveReport,
  deleteReport,
  clearReports,
  type SavedReport,
} from '@/lib/reportHistory';

type Mode = 'transcription' | 'report';
type ReportSource = 'audio' | 'text';
type RecordState = 'idle' | 'recording' | 'have-audio' | 'processing' | 'done';

export default function AudioScreen() {
  return (
    <RoleGate feature="audio">
      <AudioScreenInner />
    </RoleGate>
  );
}

function AudioScreenInner() {
  const { session } = useSession();
  const isPaid = Boolean(session); // simplified

  if (!isPaid) return <PremiumGate />;

  return <AudioFeature />;
}

function deriveTitle(markdown: string): string {
  const heading = markdown.split('\n').find((l) => l.trim().startsWith('#'));
  const base = (heading ?? markdown).replace(/^#+\s*/, '').trim();
  return base.slice(0, 70) || 'Compte rendu';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function AudioFeature() {
  const { session } = useSession();
  const [mode, setMode] = useState<Mode>('transcription');
  const [reportSource, setReportSource] = useState<ReportSource>('audio');
  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);

  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [transcription, setTranscription] = useState('');
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  // Saisie texte (compte rendu depuis des notes).
  const [noteText, setNoteText] = useState('');
  const [genLoading, setGenLoading] = useState(false);

  // Sortie : édition + export + historique local.
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setReports(loadReports());
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.centeredBox}>
          <Text style={styles.emoji}>📱</Text>
          <Text style={styles.infoTitle}>Disponible sur le web</Text>
          <Text style={styles.infoText}>
            L'enregistrement audio est actuellement disponible sur la version web de MedInfo.
            Connectez-vous sur n-med-info.vercel.app pour utiliser cette fonctionnalité.
          </Text>
        </View>
      </View>
    );
  }

  async function startRecording() {
    setError(null);
    setTranscription('');
    setReport('');
    chunksRef.current = [];
    setDuration(0);

    try {
      const stream = await (navigator as any).mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        audioBlobRef.current = new Blob(chunksRef.current, { type: mimeType });
        setRecordState('have-audio');
      };

      mr.start(250);
      setRecordState('recording');

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setError('Impossible d\'accéder au microphone. Vérifiez les permissions.');
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  async function processAudio() {
    const blob = audioBlobRef.current;
    if (!blob) return;
    setError(null);
    setRecordState('processing');
    resetOutputFlags();

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('mode', mode);
      if (mode === 'report') formData.append('template', templateId);

      const token = session?.access_token;
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(err.error ?? 'Transcription échouée.');
      }

      const data = await res.json() as { transcription: string; report?: string };
      setTranscription(data.transcription);
      if (mode === 'report' && data.report) setReport(data.report);
      setRecordState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setRecordState('have-audio');
    }
  }

  async function generateFromText() {
    const text = noteText.trim();
    if (text.length < 20 || genLoading) return;
    setError(null);
    setGenLoading(true);
    setReport('');
    resetOutputFlags();

    try {
      const token = session?.access_token;
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, template: templateId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(err.error ?? 'Génération échouée.');
      }

      const data = await res.json() as { report?: string };
      if (!data.report) throw new Error('Aucun compte rendu généré.');
      setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setGenLoading(false);
    }
  }

  function resetOutputFlags() {
    setEditing(false);
    setCopied(false);
    setSaved(false);
  }

  function reset() {
    audioBlobRef.current = null;
    setRecordState('idle');
    setTranscription('');
    setReport('');
    setNoteText('');
    setDuration(0);
    setError(null);
    resetOutputFlags();
  }

  function switchMode(next: Mode) {
    setMode(next);
    reset();
  }

  // ── Export / historique ────────────────────────────────────────────────────
  function copyReport() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(report).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        },
        () => setError('Copie impossible.'),
      );
    }
  }

  function downloadReport() {
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compte-rendu-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function saveToHistory() {
    if (!report.trim()) return;
    const next = saveReport({
      id: `cr-${Date.now()}`,
      title: deriveTitle(report),
      templateId,
      content: report,
      source: reportSource,
      date: new Date().toISOString(),
    });
    setReports(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function openSaved(r: SavedReport) {
    setReport(r.content);
    setTemplateId(r.templateId);
    setEditing(false);
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const showReportCard = mode === 'report' && Boolean(report);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ToolsMenu />
        </View>
        <Text style={styles.title}>Audio médical</Text>
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'transcription' && styles.modeTabActive]}
            onPress={() => switchMode('transcription')}
          >
            <Text style={[styles.modeLabel, mode === 'transcription' && styles.modeLabelActive]}>
              Transcription
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'report' && styles.modeTabActive]}
            onPress={() => switchMode('report')}
          >
            <Text style={[styles.modeLabel, mode === 'report' && styles.modeLabelActive]}>
              Compte rendu
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            {mode === 'transcription'
              ? 'Enregistrez une consultation, une dictée ou une note vocale. Obtenez la transcription écrite complète.'
              : 'Dictez ou collez vos observations, choisissez un modèle, et l\'IA rédige un compte rendu structuré — modifiable, exportable.'}
          </Text>
        </View>

        {/* Compte rendu : source + modèle */}
        {mode === 'report' ? (
          <>
            <View style={styles.segment}>
              {(['audio', 'text'] as ReportSource[]).map((src) => (
                <TouchableOpacity
                  key={src}
                  style={[styles.segmentTab, reportSource === src && styles.segmentTabActive]}
                  onPress={() => { setReportSource(src); reset(); }}
                >
                  <Text style={[styles.segmentText, reportSource === src && styles.segmentTextActive]}>
                    {src === 'audio' ? '🎤 Dicter' : '⌨️ Coller un texte'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Modèle de compte rendu</Text>
            <View style={styles.chips}>
              {REPORT_TEMPLATES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, templateId === t.id && styles.chipActive]}
                  onPress={() => setTemplateId(t.id)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, templateId === t.id && styles.chipTextActive]}>
                    {t.emoji} {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.templateHint}>{getReportTemplate(templateId).description}</Text>
          </>
        ) : null}

        {/* Saisie texte (compte rendu depuis notes) */}
        {mode === 'report' && reportSource === 'text' ? (
          <>
            <View style={styles.textInputRow}>
              <DictationButton
                onTranscript={(t) =>
                  setNoteText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))
                }
                disabled={genLoading}
              />
              <TextInput
                style={styles.noteArea}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Collez ou dictez vos notes de consultation…"
                placeholderTextColor={tokens.colors.textMuted}
                multiline
                editable={!genLoading}
                textAlignVertical="top"
              />
            </View>
            <TouchableOpacity
              style={[styles.processButtonFull, (genLoading || noteText.trim().length < 20) && styles.buttonDisabled]}
              onPress={generateFromText}
              disabled={genLoading || noteText.trim().length < 20}
            >
              {genLoading ? (
                <ActivityIndicator color={tokens.colors.onAccent} size="small" />
              ) : (
                <Text style={styles.processText}>Générer le compte rendu</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        {/* Recorder (transcription, ou compte rendu source audio) */}
        {mode === 'transcription' || reportSource === 'audio' ? (
          <View style={styles.recorder}>
            {recordState === 'idle' && (
              <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
                <Text style={styles.recordEmoji}>🎤</Text>
                <Text style={styles.recordLabel}>Démarrer l'enregistrement</Text>
              </TouchableOpacity>
            )}

            {recordState === 'recording' && (
              <View style={styles.recordingActive}>
                <View style={styles.recordingIndicator} />
                <Text style={styles.recordingTime}>{formatTime(duration)}</Text>
                <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                  <Text style={styles.stopEmoji}>⏹</Text>
                  <Text style={styles.stopLabel}>Arrêter</Text>
                </TouchableOpacity>
              </View>
            )}

            {recordState === 'have-audio' && (
              <View style={styles.haveAudio}>
                <Text style={styles.haveAudioText}>
                  Enregistrement prêt ({formatTime(duration)})
                </Text>
                <View style={styles.haveAudioButtons}>
                  <TouchableOpacity style={styles.retryButton} onPress={reset}>
                    <Text style={styles.retryText}>Recommencer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.processButton} onPress={processAudio}>
                    <Text style={styles.processText}>
                      {mode === 'transcription' ? 'Transcrire' : 'Générer le compte rendu'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {recordState === 'processing' && (
              <View style={styles.processingState}>
                <ActivityIndicator color={tokens.colors.accent} size="large" />
                <Text style={styles.processingText}>
                  {mode === 'transcription' ? 'Transcription en cours…' : 'Rédaction du compte rendu…'}
                </Text>
              </View>
            )}

            {recordState === 'done' && (
              <TouchableOpacity style={styles.newRecordingButton} onPress={reset}>
                <Text style={styles.newRecordingText}>Nouvel enregistrement</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {transcription && recordState === 'done' ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultCardTitle}>Transcription</Text>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </View>
        ) : null}

        {/* Compte rendu : édition + export + sauvegarde */}
        {showReportCard ? (
          <View style={styles.resultCard}>
            <View style={styles.reportHeaderRow}>
              <Text style={styles.resultCardTitle}>Compte rendu</Text>
              <TouchableOpacity onPress={() => setEditing((v) => !v)}>
                <Text style={styles.editToggle}>{editing ? '👁 Aperçu' : '✏️ Éditer'}</Text>
              </TouchableOpacity>
            </View>

            {editing ? (
              <TextInput
                style={styles.reportEditor}
                value={report}
                onChangeText={setReport}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <View style={styles.reportBody}>
                <MarkdownRenderer text={report} />
              </View>
            )}

            <View style={styles.exportRow}>
              <TouchableOpacity style={styles.exportBtn} onPress={copyReport}>
                <Text style={styles.exportBtnText}>{copied ? '✓ Copié' : 'Copier'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportBtn} onPress={downloadReport}>
                <Text style={styles.exportBtnText}>Télécharger .md</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportBtn, styles.exportBtnPrimary]} onPress={saveToHistory}>
                <Text style={styles.exportBtnPrimaryText}>{saved ? '✓ Enregistré' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                À vérifier et valider par le professionnel de santé avant tout usage clinique.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Historique local des comptes rendus */}
        {reports.length > 0 ? (
          <View style={styles.historyCard}>
            <TouchableOpacity
              style={styles.historyHeader}
              onPress={() => setHistoryOpen((v) => !v)}
              accessibilityRole="button"
            >
              <Text style={styles.historyTitle}>
                Historique local ({reports.length})
              </Text>
              <Text style={styles.historyChevron}>{historyOpen ? '▾' : '▸'}</Text>
            </TouchableOpacity>

            {historyOpen ? (
              <>
                {reports.map((r) => (
                  <View key={r.id} style={styles.historyItem}>
                    <TouchableOpacity style={styles.historyItemMain} onPress={() => openSaved(r)}>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>{r.title}</Text>
                      <Text style={styles.historyItemMeta}>
                        {getReportTemplate(r.templateId).label} · {formatDate(r.date)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setReports(deleteReport(r.id))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.historyDelete}>Suppr.</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity onPress={() => setReports(clearReports())}>
                  <Text style={styles.historyClear}>Tout effacer</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <Text style={styles.historyNote}>
              Stocké uniquement sur cet appareil (navigateur). Rien n'est envoyé à nos serveurs.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function PremiumGate() {
  return (
    <View style={styles.gateContainer}>
      <View style={styles.gateCard}>
        <Text style={styles.emoji}>🎤</Text>
        <Text style={styles.gateTitle}>Fonctions audio</Text>
        <Text style={styles.gateText}>
          Transcription d'enregistrements et rédaction de comptes rendus médicaux automatisée.
          Réservé aux abonnés MedInfo Premium.
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
    paddingTop: tokens.space.xl,
    paddingHorizontal: tokens.space.lg,
    paddingBottom: 0,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: tokens.space.sm },
  title: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.md,
  },
  modeSwitcher: {
    flexDirection: 'row',
    borderBottomWidth: 0,
    gap: 0,
  },
  modeTab: {
    flex: 1,
    paddingVertical: tokens.space.sm + 2,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modeTabActive: { borderBottomColor: tokens.colors.accent },
  modeLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  modeLabelActive: { color: tokens.colors.accent, fontWeight: tokens.weight.semibold },
  scroll: { flex: 1 },
  scrollContent: { padding: tokens.space.lg, gap: tokens.space.md },
  infoBox: {
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accentSurface,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.accent,
    padding: tokens.space.md,
  },
  infoBoxText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
  },

  // Segment (source audio / texte)
  segment: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceSunken,
    borderRadius: tokens.radius.md,
    padding: 3,
    gap: 3,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: tokens.space.sm,
    alignItems: 'center',
    borderRadius: tokens.radius.sm,
  },
  segmentTabActive: { backgroundColor: tokens.colors.surface, ...tokens.elevation.sm },
  segmentText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  segmentTextActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },

  // Template chips
  fieldLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  chip: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 2,
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  chipActive: { backgroundColor: tokens.colors.accentSurface, borderColor: tokens.colors.accentSurfaceStrong },
  chipText: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  chipTextActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  templateHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontStyle: 'italic',
  },

  // Saisie texte
  textInputRow: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'flex-start' },
  noteArea: {
    flex: 1,
    minHeight: 140,
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
  processButtonFull: {
    height: 48,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
  },
  buttonDisabled: { opacity: 0.45 },

  recorder: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.xl,
    alignItems: 'center',
    gap: tokens.space.md,
    ...tokens.elevation.sm,
  },
  recordButton: {
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.lg,
  },
  recordEmoji: { fontSize: 48 },
  recordLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  recordingActive: { alignItems: 'center', gap: tokens.space.md },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.colors.danger,
  },
  recordingTime: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.text,
    fontSize: 32,
    fontWeight: tokens.weight.bold,
  },
  stopButton: {
    alignItems: 'center',
    gap: 4,
    padding: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.dangerBackground,
    borderWidth: 1,
    borderColor: tokens.colors.danger,
  },
  stopEmoji: { fontSize: 24 },
  stopLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  haveAudio: { alignItems: 'center', gap: tokens.space.md, width: '100%' },
  haveAudioText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.body.fontSize,
  },
  haveAudioButtons: { flexDirection: 'row', gap: tokens.space.md, width: '100%' },
  retryButton: {
    flex: 1,
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontWeight: tokens.weight.medium,
    fontSize: tokens.type.label.fontSize,
  },
  processButton: {
    flex: 2,
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
  },
  processText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  processingState: { alignItems: 'center', gap: tokens.space.lg, padding: tokens.space.xl },
  processingText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
  },
  newRecordingButton: {
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newRecordingText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
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
  resultCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    overflow: 'hidden',
    ...tokens.elevation.sm,
  },
  resultCardTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    padding: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    backgroundColor: tokens.colors.accentSurface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.accentSurfaceStrong,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.accentSurface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.accentSurfaceStrong,
    paddingRight: tokens.space.lg,
  },
  editToggle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  reportBody: { padding: tokens.space.lg },
  reportEditor: {
    minHeight: 240,
    margin: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    padding: tokens.space.md,
    fontFamily: tokens.font.mono,
    fontSize: tokens.type.label.fontSize,
    color: tokens.colors.text,
    lineHeight: 21,
  },
  exportRow: {
    flexDirection: 'row',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.md,
    flexWrap: 'wrap',
  },
  exportBtn: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surface,
  },
  exportBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  exportBtnPrimary: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  exportBtnPrimaryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  transcriptionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    padding: tokens.space.lg,
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

  // Historique
  historyCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.md,
    gap: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  historyChevron: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: 16 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.space.sm,
  },
  historyItemMain: { flex: 1, gap: 2 },
  historyItemTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  historyItemMeta: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: 11,
  },
  historyDelete: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  historyClear: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
    marginTop: tokens.space.xs,
  },
  historyNote: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // Gate styles
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
  emoji: { fontSize: 40 },
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
  centeredBox: { alignItems: 'center', gap: tokens.space.lg, padding: tokens.space.xl },
  infoTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    textAlign: 'center',
  },
  infoText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    textAlign: 'center',
    maxWidth: 340,
  },
});
