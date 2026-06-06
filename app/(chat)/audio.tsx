/**
 * Écran d'enregistrement vocal pour transcription.
 * - Web : conserve le chemin MediaRecorder navigateur.
 * - iOS/Android : enregistrement natif via expo-audio (Expo SDK 56).
 * L'upload reste inchangé : multipart/form-data vers /api/transcribe avec le champ `file`.
 */
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { tokens } from '@/ui/tokens';

type RecordingStatus = 'idle' | 'recording' | 'uploading';

type WebRecorder = {
  start: () => void;
  stop: () => void;
  state: string;
  ondataavailable: ((event: { data?: Blob }) => void) | null;
  onstop: (() => void | Promise<void>) | null;
};

type WebMediaStream = {
  getTracks: () => Array<{ stop: () => void }>;
};

const isWeb = Platform.OS === 'web';

function getTranscriptFromResponse(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';

  const record = payload as Record<string, unknown>;
  const candidates = [record.text, record.transcript, record.transcription];
  const transcript = candidates.find((value): value is string => typeof value === 'string');
  return transcript ?? '';
}

function getAudioFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return isWeb ? `recording-${timestamp}.webm` : `recording-${timestamp}.m4a`;
}

async function uploadRecording(part: Blob | { uri: string; name: string; type: string }): Promise<string> {
  const formData = new FormData();

  if (typeof Blob !== 'undefined' && part instanceof Blob) {
    formData.append('file', part, getAudioFilename());
  } else {
    formData.append('file', part as unknown as Blob);
  }

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return getTranscriptFromResponse(await response.json());
  }

  return getTranscriptFromResponse(await response.text());
}

function showError(message: string) {
  if (Platform.OS === 'web') {
    // `alert` est disponible dans les navigateurs ; Alert.alert garde le même rendu natif.
    globalThis.alert?.(message);
    return;
  }
  Alert.alert('Enregistrement audio', message);
}

export default function AudioScreen() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastError, setLastError] = useState('');
  const webRecorderRef = useRef<WebRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webStreamRef = useRef<WebMediaStream | null>(null);

  const isRecording = status === 'recording';
  const isUploading = status === 'uploading';
  const durationMs = isWeb ? 0 : recorderState.durationMillis;

  const resetWebStream = () => {
    webStreamRef.current?.getTracks().forEach((track) => track.stop());
    webStreamRef.current = null;
  };

  const startWebRecording = async () => {
    const mediaDevices = globalThis.navigator?.mediaDevices;
    if (!mediaDevices?.getUserMedia || typeof globalThis.MediaRecorder === 'undefined') {
      throw new Error('Enregistrement audio indisponible sur ce navigateur.');
    }

    const stream = (await mediaDevices.getUserMedia({ audio: true })) as WebMediaStream;
    webStreamRef.current = stream;
    webChunksRef.current = [];

    const RecorderCtor = globalThis.MediaRecorder;
    const preferredMime = 'audio/webm';
    const recorder = new RecorderCtor(
      stream as unknown as MediaStream,
      RecorderCtor.isTypeSupported?.(preferredMime) ? { mimeType: preferredMime } : undefined,
    ) as WebRecorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) webChunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(webChunksRef.current, { type: preferredMime });
      resetWebStream();
      webRecorderRef.current = null;
      await uploadBlob(blob);
    };

    webRecorderRef.current = recorder;
    recorder.start();
    setStatus('recording');
  };

  const startNativeRecording = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Permission micro refusée. Activez le microphone dans les réglages de l’appareil.');
    }

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    setStatus('recording');
  };

  const handleStart = async () => {
    if (status !== 'idle') return;
    setLastError('');
    setTranscript('');

    try {
      if (isWeb) {
        await startWebRecording();
      } else {
        await startNativeRecording();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de démarrer l’enregistrement.';
      setStatus('idle');
      setLastError(message);
      resetWebStream();
      showError(message);
    }
  };

  const uploadBlob = async (blob: Blob) => {
    try {
      setStatus('uploading');
      const text = await uploadRecording(blob);
      setTranscript(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'La transcription a échoué.';
      setLastError(message);
      showError(message);
    } finally {
      setStatus('idle');
    }
  };

  const stopWebRecording = () => {
    const recorder = webRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
  };

  const stopNativeRecording = async () => {
    await audioRecorder.stop();
    const uri = audioRecorder.uri ?? recorderState.url;
    if (!uri) throw new Error('Aucun fichier audio natif à envoyer.');

    setStatus('uploading');
    try {
      const text = await uploadRecording({
        uri,
        name: getAudioFilename(),
        type: 'audio/mp4',
      });
      setTranscript(text);
    } finally {
      await setAudioModeAsync({ allowsRecording: false });
    }
  };

  const handleStop = async () => {
    if (!isRecording) return;
    setLastError('');

    try {
      if (isWeb) {
        stopWebRecording();
      } else {
        await stopNativeRecording();
        setStatus('idle');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de terminer l’enregistrement.';
      setLastError(message);
      showError(message);
      setStatus('idle');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Dictée vocale</Text>
        <Text style={styles.description}>
          Enregistrez une question générale de santé. Le fichier audio est envoyé tel quel vers /api/transcribe.
        </Text>

        <View style={styles.statusPill}>
          <Text style={styles.statusText}>
            {isRecording ? '● Enregistrement en cours' : isUploading ? 'Transcription en cours…' : 'Prêt'}
          </Text>
        </View>

        {!isWeb && isRecording ? (
          <Text style={styles.duration}>{Math.round(durationMs / 1000)} s</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.stopButton, isUploading && styles.disabledButton]}
          onPress={isRecording ? handleStop : handleStart}
          disabled={isUploading}
        >
          {isUploading ? <ActivityIndicator color="#fff" /> : null}
          <Text style={styles.recordButtonText}>{isRecording ? 'Arrêter et transcrire' : 'Démarrer'}</Text>
        </TouchableOpacity>

        {transcript ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>Transcription</Text>
            <Text style={styles.resultText}>{transcript}</Text>
          </View>
        ) : null}

        {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: 16 },
  card: {
    gap: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  title: { color: tokens.colors.text, fontSize: 22, fontWeight: '800' },
  description: { color: tokens.colors.textMuted, fontSize: 14, lineHeight: 21 },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  statusText: { color: tokens.colors.text, fontSize: 13, fontWeight: '700' },
  duration: { color: tokens.colors.textMuted, fontSize: 13, fontWeight: '600' },
  recordButton: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 18,
    backgroundColor: tokens.colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stopButton: { backgroundColor: tokens.colors.warningText },
  disabledButton: { opacity: 0.6 },
  recordButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  resultBox: {
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  resultLabel: { color: tokens.colors.textMuted, fontSize: 12, fontWeight: '800' },
  resultText: { color: tokens.colors.text, fontSize: 15, lineHeight: 22 },
  errorText: { color: tokens.colors.warningText, fontSize: 13, lineHeight: 19, fontWeight: '700' },
});
