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
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Démontage pendant une dictée (ex. : chrono ECOS qui expire) : libérer le micro
  // et le timer d'erreur, et empêcher les setState après unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (errorTimer.current) clearTimeout(errorTimer.current);
      const mr = recorderRef.current;
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
        recorderRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  if (!SUPPORTED) return null;

  // Message transitoire au-dessus du bouton (le repli reste la saisie clavier).
  function flashError(msg: string) {
    if (!mountedRef.current) return;
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => {
      if (mountedRef.current) setError(null);
    }, 3500);
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
        streamRef.current = null;
        await transcribe(new Blob(chunksRef.current, { type: mimeType }));
      };
      mr.start(250);
      setState('recording');
      setError(null);
    } catch {
      setState('idle');
      flashError('Micro indisponible : vérifie les autorisations du navigateur.');
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
        if (text) {
          if (mountedRef.current) onTranscript(text);
        } else flashError('Aucune parole détectée.');
      } else {
        flashError('Dictée indisponible, réessaie.');
      }
    } catch {
      // dictée indisponible → l'utilisateur peut taper au clavier
      flashError('Dictée indisponible, réessaie.');
    } finally {
      if (mountedRef.current) setState('idle');
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
    <View style={styles.wrap}>
      {error ? (
        <View style={styles.errorBubble} pointerEvents="none" accessibilityRole="alert">
          <Text style={styles.errorBubbleText}>{error}</Text>
        </View>
      ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  errorBubble: {
    position: 'absolute',
    bottom: 52,
    right: 0,
    maxWidth: 220,
    backgroundColor: tokens.colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radius.sm,
    zIndex: 10,
    ...tokens.elevation.sm,
  },
  errorBubbleText: {
    color: tokens.colors.onAccent,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 16,
  },
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
