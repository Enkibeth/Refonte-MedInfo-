/**
 * Fonctionnalités audio — version premium.
 * Mode 1 : Transcription d'un enregistrement audio (consultation, dictée).
 * Mode 2 : Rédaction d'un compte rendu médical structuré depuis une dictée audio.
 *
 * Utilise l'API MediaRecorder (web) pour l'enregistrement côté client.
 * Transcription via /api/transcribe (Whisper).
 */
import { useRef, useState } from 'react';
import {
  View,
  Text,
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
import { AudioLibrary } from '@/ui/AudioLibrary';
import { saveAudioDocument } from '@/audio/audioLibrary';

type Mode = 'transcription' | 'report';
type Tab = 'transcription' | 'report' | 'library';
type RecordState = 'idle' | 'recording' | 'have-audio' | 'processing' | 'done';

const REPORT_PROMPT = `Tu es un assistant médical expert en rédaction. À partir de la transcription audio ci-dessous (dictée médicale ou consultation), génère un compte rendu médical structuré en français en markdown, avec les sections adaptées au contexte (ex. Motif de consultation, Anamnèse, Examen clinique, Conclusion, Conduite à tenir, Prescription le cas échéant).

Adapte les sections au contenu réel de la transcription. Le compte rendu doit être professionnel, factuel et complet.`;

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

function AudioFeature() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>('transcription');
  const mode: Mode = tab === 'report' ? 'report' : 'transcription';
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [transcription, setTranscription] = useState('');
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [libraryRefresh, setLibraryRefresh] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      mimeTypeRef.current = mimeType;

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

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('mode', mode);

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

  function reset() {
    audioBlobRef.current = null;
    setRecordState('idle');
    setTranscription('');
    setReport('');
    setDuration(0);
    setError(null);
    setSaved(false);
  }

  function switchTab(next: Tab) {
    setTab(next);
    if (next !== 'library') reset();
  }

  async function saveToLibrary() {
    const userId = session?.user?.id;
    if (!userId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const defaultTitle =
        (mode === 'report' ? 'Compte rendu' : 'Transcription') +
        ' du ' +
        now.toLocaleDateString('fr-FR');
      await saveAudioDocument({
        userId,
        title: defaultTitle,
        kind: mode,
        transcription,
        report: mode === 'report' ? report : null,
        audioBlob: audioBlobRef.current,
        audioMimeType: mimeTypeRef.current,
        durationSeconds: duration,
      });
      setSaved(true);
      setLibraryRefresh((n) => n + 1);
    } catch {
      setError('Échec de l\'enregistrement dans la bibliothèque.');
    } finally {
      setSaving(false);
    }
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ToolsMenu />
        </View>
        <Text style={styles.title}>Audio médical</Text>
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeTab, tab === 'transcription' && styles.modeTabActive]}
            onPress={() => switchTab('transcription')}
          >
            <Text style={[styles.modeLabel, tab === 'transcription' && styles.modeLabelActive]}>
              Transcription
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, tab === 'report' && styles.modeTabActive]}
            onPress={() => switchTab('report')}
          >
            <Text style={[styles.modeLabel, tab === 'report' && styles.modeLabelActive]}>
              Compte rendu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, tab === 'library' && styles.modeTabActive]}
            onPress={() => switchTab('library')}
          >
            <Text style={[styles.modeLabel, tab === 'library' && styles.modeLabelActive]}>
              Mes documents
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === 'library' ? (
        <AudioLibrary refreshToken={libraryRefresh} />
      ) : (

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            {mode === 'transcription'
              ? 'Enregistrez une consultation, une dictée ou une note vocale. Obtenez la transcription écrite complète.'
              : 'Dictez vos observations cliniques. L\'IA génère un compte rendu médical structuré et professionnel.'}
          </Text>
        </View>

        {/* Recorder */}
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

        {report && mode === 'report' && recordState === 'done' ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultCardTitle}>Compte rendu généré</Text>
            <MarkdownRenderer text={report} />
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                À vérifier et valider par le professionnel de santé avant tout usage clinique.
              </Text>
            </View>
          </View>
        ) : null}

        {transcription && recordState === 'done' ? (
          saved ? (
            <View style={styles.savedBox}>
              <Text style={styles.savedText}>✓ Enregistré dans « Mes documents ».</Text>
              <TouchableOpacity onPress={() => switchTab('library')}>
                <Text style={styles.savedLink}>Voir ma bibliothèque</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveToLibrary}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Enregistrement…' : '💾 Enregistrer dans ma bibliothèque'}
              </Text>
            </TouchableOpacity>
          )
        ) : null}

        <Text style={styles.retentionNote}>
          L'audio est conservé 24h (réécoute) puis supprimé automatiquement. Vos transcriptions et
          comptes rendus restent enregistrés tant que vous ne les supprimez pas.
        </Text>
      </ScrollView>
      )}
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
  transcriptionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    padding: tokens.space.lg,
  },
  saveButton: {
    height: 48,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
  },
  saveButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  savedBox: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.success,
    backgroundColor: tokens.colors.successBackground,
    padding: tokens.space.md,
    gap: tokens.space.xs,
    alignItems: 'center',
  },
  savedText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.success,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  savedLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  retentionNote: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: tokens.space.md,
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
