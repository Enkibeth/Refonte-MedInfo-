/**
 * Bouton de dictée vocale — enregistre la voix et la transcrit (Whisper) pour
 * remplir une zone de saisie au lieu de taper au clavier.
 *
 * Web (MediaRecorder) : enregistre → POST /api/transcribe (mode "raw", transcription
 * brute sans diarisation) → `onTranscript(texte)`. Sur natif/non supporté, le bouton
 * ne s'affiche pas (la saisie clavier reste disponible).
 *
 * Le texte dicté est ensuite traité par la safe-box normale de la route cible.
 */
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

type State = 'idle' | 'recording' | 'transcribing';

const SUPPORTED =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof (globalThis as any).MediaRecorder !== 'undefined';

export function DictationButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const { session } = useSession();
  const [state, setState] = useState<State>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  if (!SUPPORTED) return null;

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType });
      recorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await transcribe(new Blob(chunksRef.current, { type: mimeType }));
      };
      mr.start(250);
      setState('recording');
    } catch {
      setState('idle');
    }
  }

  function stop() {
    setState('transcribing');
    recorderRef.current?.stop();
  }

  async function transcribe(blob: Blob) {
    try {
      const form = new FormData();
      form.append('audio', blob, 'dictation.webm');
      form.append('mode', 'raw');
      const token = session?.access_token;
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (res.ok) {
        const data = (await res.json()) as { transcription?: string };
        const text = data.transcription?.trim();
        if (text) onTranscript(text);
      }
    } catch {
      /* dictée indisponible → l'utilisateur peut taper au clavier */
    } finally {
      setState('idle');
    }
  }

  const onPress = () => {
    if (disabled) return;
    if (state === 'recording') stop();
    else if (state === 'idle') start();
  };

  const recording = state === 'recording';
  const busy = state === 'transcribing';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Arrêter la dictée' : 'Dicter au micro'}
      style={[styles.button, recording && styles.buttonRecording, (disabled || busy) && styles.buttonDisabled]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={tokens.colors.accent} />
      ) : (
        <Icon
          name={recording ? 'stop' : 'micVoice'}
          size={19}
          color={recording ? tokens.colors.danger : tokens.colors.accentDeep}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRecording: {
    backgroundColor: tokens.colors.dangerBackground,
    borderColor: tokens.colors.danger,
  },
  buttonDisabled: { opacity: 0.45 },
});
