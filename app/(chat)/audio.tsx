/**
 * Fonctionnalités audio — version premium.
 * Mode 1 : Transcription d'un enregistrement audio (consultation, dictée).
 * Mode 2 : Rédaction d'un compte rendu médical structuré depuis une dictée audio.
 *
 * Utilise l'API MediaRecorder (web) pour l'enregistrement côté client.
 * Transcription via /api/transcribe (Whisper).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSession } from '@/auth/AuthProvider';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { PAGE_SEO, breadcrumbJsonLd, webApplicationJsonLd } from '@/seo/meta';
import { SeoHead } from '@/ui/SeoHead';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { RoleGate } from '@/ui/RoleGate';
import { ToolsMenu } from '@/ui/ToolsMenu';
import { AudioLibrary } from '@/ui/AudioLibrary';
import { saveAudioDocument } from '@/audio/audioLibrary';

type Mode = 'transcription' | 'report';
type Tab = 'transcription' | 'report' | 'library';
type RecordState = 'idle' | 'recording' | 'have-audio' | 'processing' | 'done';

/** Limite serveur de /api/transcribe (Whisper) — garde-fou client pour un message clair. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const REPORT_PROMPT = `Tu es un assistant médical expert en rédaction. À partir de la transcription audio ci-dessous (dictée médicale ou consultation), génère un compte rendu médical structuré en français en markdown, avec les sections adaptées au contexte (ex. Motif de consultation, Anamnèse, Examen clinique, Conclusion, Conduite à tenir, Prescription le cas échéant).

Adapte les sections au contenu réel de la transcription. Le compte rendu doit être professionnel, factuel et complet.`;

export default function AudioScreen() {
  return (
    <>
      {/* SEO par feature (2026-07) : titre/description/canonical + fiche WebApplication,
          rendus pour tous (y compris visiteurs) — RoleGate ne gate que le contenu. */}
      <SeoHead
        title={PAGE_SEO.audio.title}
        description={PAGE_SEO.audio.description}
        path={PAGE_SEO.audio.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Compte rendu de consultation', path: PAGE_SEO.audio.path },
          ]),
          webApplicationJsonLd({
            name: 'Compte rendu de consultation — MedInfo AI',
            description: PAGE_SEO.audio.description,
            path: PAGE_SEO.audio.path,
          }),
        ]}
      />
      <RoleGate feature="audio">
        <AudioFeature />
      </RoleGate>
    </>
  );
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyText(text: string, key: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1800);
      }
    } catch {
      /* presse-papiers indisponible — le texte reste sélectionnable */
    }
  }

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Coupe TOUT le matériel d'enregistrement (voyant micro compris) sans passer par
  // les callbacks : utilisé quand on abandonne (changement d'onglet, unmount) —
  // sinon le micro restait ouvert et l'interval tournait en fond.
  const releaseRecordingHardware = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr) {
      mr.ondataavailable = null;
      mr.onstop = null;
      if (mr.state !== 'inactive') {
        try {
          mr.stop();
        } catch {
          /* déjà arrêté */
        }
      }
      mediaRecorderRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => releaseRecordingHardware, [releaseRecordingHardware]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.centeredBox}>
          <View style={styles.iconBadge}>
            <Icon name="monitor" size={26} color={tokens.colors.accentDeep} />
          </View>
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
      streamRef.current = stream;
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
    // Le serveur refuse au-delà de 25 Mo : on l'annonce ici plutôt que d'envoyer
    // un fichier trop lourd pour recevoir une erreur 413 générique après l'upload.
    if (blob.size > MAX_AUDIO_BYTES) {
      setError(
        `Enregistrement trop volumineux (${(blob.size / 1024 / 1024).toFixed(0)} Mo, maximum 25 Mo). Enregistrez des segments plus courts.`,
      );
      return;
    }
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
      if (mode === 'report') {
        if (data.report) setReport(data.report);
        // Le serveur renvoie report:null si l'étape de rédaction échoue (la transcription,
        // elle, a réussi) : on le dit clairement au lieu d'afficher un résultat vide.
        else
          setError(
            "Le compte rendu n'a pas pu être généré cette fois — la transcription ci-dessous reste disponible. Relance un enregistrement pour réessayer.",
          );
      }
      setRecordState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setRecordState('have-audio');
    }
  }

  function reset() {
    // Un enregistrement encore en cours est abandonné : micro et timer libérés.
    releaseRecordingHardware();
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
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'transcription' }}
          >
            <Text style={[styles.modeLabel, tab === 'transcription' && styles.modeLabelActive]}>
              Transcription
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, tab === 'report' && styles.modeTabActive]}
            onPress={() => switchTab('report')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'report' }}
          >
            <Text style={[styles.modeLabel, tab === 'report' && styles.modeLabelActive]}>
              Compte rendu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, tab === 'library' && styles.modeTabActive]}
            onPress={() => switchTab('library')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'library' }}
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
            <TouchableOpacity
              style={styles.recordButton}
              onPress={startRecording}
              accessibilityRole="button"
              accessibilityLabel="Démarrer l'enregistrement"
            >
              <View style={styles.recordCircle}>
                <Icon name="micVoice" size={36} color={tokens.colors.onAccent} />
              </View>
              <Text style={styles.recordLabel}>Démarrer l'enregistrement</Text>
            </TouchableOpacity>
          )}

          {recordState === 'recording' && (
            <View style={styles.recordingActive}>
              <View style={styles.recordingBadge}>
                <View style={styles.recordingIndicator} />
                <Text style={styles.recordingBadgeText}>Enregistrement en cours</Text>
              </View>
              <Text style={styles.recordingTime}>{formatTime(duration)}</Text>
              <TouchableOpacity
                style={styles.stopButton}
                onPress={stopRecording}
                accessibilityRole="button"
                accessibilityLabel="Arrêter l'enregistrement"
              >
                <View style={styles.stopCircle}>
                  <Icon name="stop" size={28} color={tokens.colors.onAccent} />
                </View>
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
            <View style={styles.resultCardHeader}>
              <Text style={styles.resultCardTitle}>Transcription</Text>
              <TouchableOpacity
                onPress={() => void copyText(transcription, 'tr')}
                accessibilityRole="button"
                accessibilityLabel="Copier la transcription"
                style={styles.copyBtn}
              >
                <Text style={styles.copyBtnText}>{copiedKey === 'tr' ? 'Copié ✓' : 'Copier'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </View>
        ) : null}

        {report && mode === 'report' && recordState === 'done' ? (
          <View style={styles.resultCard}>
            <View style={styles.resultCardHeader}>
              <Text style={styles.resultCardTitle}>Compte rendu généré</Text>
              <TouchableOpacity
                onPress={() => void copyText(report, 'rp')}
                accessibilityRole="button"
                accessibilityLabel="Copier le compte rendu"
                style={styles.copyBtn}
              >
                <Text style={styles.copyBtnText}>{copiedKey === 'rp' ? 'Copié ✓' : 'Copier'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.reportBody}>
              <MarkdownRenderer text={report} />
            </View>
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
              <View style={styles.savedRow}>
                <Icon name="check" size={15} color={tokens.colors.success} />
                <Text style={styles.savedText}>Enregistré dans « Mes documents ».</Text>
              </View>
              <TouchableOpacity onPress={() => switchTab('library')} accessibilityRole="button">
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
              <Icon name="download" size={17} color={tokens.colors.onAccent} />
              <Text style={styles.saveButtonText}>
                {saving ? 'Enregistrement…' : 'Enregistrer dans ma bibliothèque'}
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
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
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
  // Colonne de lecture centrée : cohérente avec le chat et les autres outils.
  scrollContent: {
    padding: tokens.space.lg,
    gap: tokens.space.md,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
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
  // Bouton d'enregistrement rond (motif dictaphone) : l'action principale est
  // immédiatement identifiable, cible tactile généreuse.
  recordButton: {
    alignItems: 'center',
    gap: tokens.space.md,
    padding: tokens.space.lg,
  },
  recordCircle: {
    width: 88,
    height: 88,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentVivid,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.elevation.md,
    ...tokens.motion.transitionWeb,
  },
  recordLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  recordingActive: { alignItems: 'center', gap: tokens.space.md },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.dangerBackground,
  },
  recordingBadgeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  recordingIndicator: {
    width: 10,
    height: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.danger,
  },
  recordingTime: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.text,
    fontSize: tokens.type.h1.fontSize,
    fontWeight: tokens.weight.bold,
  },
  stopButton: {
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.sm,
  },
  stopCircle: {
    width: 72,
    height: 72,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.elevation.md,
    ...tokens.motion.transitionWeb,
  },
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
    borderRadius: tokens.radius.pill,
    // CTA principal : bleu électrique des actions primaires (convention 2026-07).
    backgroundColor: tokens.colors.accentVivid,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
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
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
    padding: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    backgroundColor: tokens.colors.accentSurface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.accentSurfaceStrong,
  },
  resultCardTitle: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  copyBtn: {
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 6,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.surface,
  },
  copyBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  reportBody: { padding: tokens.space.lg },
  transcriptionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    padding: tokens.space.lg,
  },
  saveButton: {
    height: tokens.size.controlLg,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentVivid,
    flexDirection: 'row',
    gap: tokens.space.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
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
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
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
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredBox: { alignItems: 'center', gap: tokens.space.lg, padding: tokens.space.xl },
  infoTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.semibold,
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
