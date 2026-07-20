/**
 * Bibliothèque des transcriptions / comptes rendus audio (ADR-0022).
 * Liste les documents de l'utilisateur (RLS own-row), groupés par dossier, avec :
 * renommer, classer (dossier), supprimer, exporter en PDF, et réécouter l'audio
 * tant qu'il n'est pas purgé (≤ 24h).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { tokens } from '@/ui/tokens';
import {
  deleteAudioDocument,
  getAudioSignedUrl,
  isAudioAvailable,
  listAudioDocuments,
  updateAudioDocument,
  type AudioDocument,
} from '@/audio/audioLibrary';
import { exportDocumentToPdf } from '@/audio/exportPdf';

function groupByFolder(docs: AudioDocument[]): { folder: string; items: AudioDocument[] }[] {
  const map = new Map<string, AudioDocument[]>();
  for (const d of docs) {
    const key = d.folder?.trim() || 'Sans dossier';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] === 'Sans dossier' ? 1 : b[0] === 'Sans dossier' ? -1 : a[0].localeCompare(b[0])))
    .map(([folder, items]) => ({ folder, items }));
}

export function AudioLibrary({ refreshToken }: { refreshToken: number }) {
  const [docs, setDocs] = useState<AudioDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFolder, setEditFolder] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDocs(await listAudioDocuments());
    } catch {
      setError('Impossible de charger la bibliothèque.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  function startEdit(doc: AudioDocument) {
    setEditingId(doc.id);
    setEditTitle(doc.title);
    setEditFolder(doc.folder ?? '');
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      await updateAudioDocument(id, { title: editTitle.trim() || 'Compte rendu', folder: editFolder.trim() || null });
      setEditingId(null);
      await load();
    } catch {
      setError('Échec de l\'enregistrement.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(doc: AudioDocument) {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm(`Supprimer « ${doc.title} » ?`)) return;
    setBusyId(doc.id);
    try {
      await deleteAudioDocument(doc);
      await load();
    } catch {
      setError('Échec de la suppression.');
    } finally {
      setBusyId(null);
    }
  }

  // Une seule lecture à la fois : l'instance courante est arrêtée avant d'en
  // lancer une autre (et à l'unmount) — sinon les clics superposaient les audios.
  const playerRef = useRef<HTMLAudioElement | null>(null);
  useEffect(
    () => () => {
      playerRef.current?.pause();
      playerRef.current = null;
    },
    [],
  );

  async function play(doc: AudioDocument) {
    if (!doc.audio_path) return;
    try {
      const url = await getAudioSignedUrl(doc.audio_path);
      if (!url) throw new Error('URL indisponible');
      if (typeof window !== 'undefined' && 'Audio' in window) {
        playerRef.current?.pause();
        const audio = new window.Audio(url);
        playerRef.current = audio;
        await audio.play();
      }
    } catch {
      // L'audio est purgé au bout de 24 h : on l'explique au lieu d'échouer en silence.
      setError("Lecture impossible : l'audio a peut-être expiré (conservation 24 h).");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.colors.accent} />
        <Text style={styles.muted}>Chargement…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (docs.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Aucun document enregistré pour l'instant.</Text>
        <Text style={styles.mutedSmall}>
          Génère une transcription ou un compte rendu, puis enregistre-le dans ta bibliothèque.
        </Text>
      </View>
    );
  }

  const groups = groupByFolder(docs);

  return (
    <ScrollView contentContainerStyle={styles.list}>
      {groups.map((group) => (
        <View key={group.folder} style={styles.group}>
          <Text style={styles.groupTitle}>{group.folder}</Text>
          {group.items.map((doc) => {
            const expanded = expandedId === doc.id;
            const editing = editingId === doc.id;
            const audioOk = isAudioAvailable(doc);
            return (
              <View key={doc.id} style={styles.card}>
                {editing ? (
                  <View style={styles.editBox}>
                    <Text style={styles.fieldLabel}>Titre</Text>
                    <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} />
                    <Text style={styles.fieldLabel}>Dossier</Text>
                    <TextInput
                      style={styles.input}
                      value={editFolder}
                      onChangeText={setEditFolder}
                      placeholder="Ex. Cardiologie, Janvier 2026…"
                      placeholderTextColor={tokens.colors.textMuted}
                    />
                    <View style={styles.row}>
                      <TouchableOpacity style={styles.ghostBtn} onPress={() => setEditingId(null)}>
                        <Text style={styles.ghostBtnText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.primaryBtn} onPress={() => saveEdit(doc.id)} disabled={busyId === doc.id}>
                        <Text style={styles.primaryBtnText}>{busyId === doc.id ? '…' : 'Enregistrer'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => setExpandedId(expanded ? null : doc.id)}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{doc.title}</Text>
                        <View style={[styles.kindBadge, doc.kind === 'report' ? styles.kindReport : styles.kindTrans]}>
                          <Text style={styles.kindBadgeText}>{doc.kind === 'report' ? 'Compte rendu' : 'Transcription'}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardMeta}>
                        {new Date(doc.created_at).toLocaleDateString('fr-FR')} ·{' '}
                        {audioOk ? 'audio dispo' : 'audio expiré'}
                      </Text>
                    </TouchableOpacity>

                    {expanded ? (
                      <View style={styles.body}>
                        {doc.report ? (
                          <MarkdownRenderer text={doc.report} />
                        ) : (
                          <Text style={styles.transcriptionText}>{doc.transcription}</Text>
                        )}
                      </View>
                    ) : null}

                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() =>
                          exportDocumentToPdf({
                            title: doc.title,
                            createdAt: doc.created_at,
                            report: doc.report,
                            transcription: doc.transcription,
                          })
                        }
                      >
                        <Text style={styles.actionText}>PDF</Text>
                      </TouchableOpacity>
                      {audioOk ? (
                        <TouchableOpacity style={styles.actionBtn} onPress={() => void play(doc)}>
                          <Text style={styles.actionText}>▶ Écouter</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity style={styles.actionBtn} onPress={() => startEdit(doc)}>
                        <Text style={styles.actionText}>Renommer / classer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => remove(doc)} disabled={busyId === doc.id}>
                        <Text style={[styles.actionText, styles.deleteText]}>Supprimer</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: tokens.space.sm, padding: tokens.space.xl },
  muted: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.body.fontSize },
  mutedSmall: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize, textAlign: 'center', maxWidth: 320 },
  errorText: { fontFamily: tokens.font.sans, color: tokens.colors.danger, fontSize: tokens.type.label.fontSize },
  retry: { paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.sm, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.accent },
  retryText: { fontFamily: tokens.font.sans, color: tokens.colors.onAccent, fontWeight: tokens.weight.semibold },
  list: { padding: tokens.space.lg, gap: tokens.space.lg },
  group: { gap: tokens.space.sm },
  groupTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  card: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.md,
    gap: tokens.space.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.sm },
  cardTitle: { flex: 1, fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold },
  cardMeta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize, marginTop: 2 },
  kindBadge: { borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.sm, paddingVertical: 2 },
  kindReport: { backgroundColor: tokens.colors.accentSurface },
  kindTrans: { backgroundColor: tokens.colors.surfaceSunken },
  kindBadgeText: { fontFamily: tokens.font.sans, color: tokens.colors.accentDeep, fontSize: tokens.type.micro.fontSize, fontWeight: tokens.weight.semibold },
  body: { borderTopWidth: 1, borderTopColor: tokens.colors.border, paddingTop: tokens.space.sm },
  transcriptionText: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.body.fontSize, lineHeight: tokens.type.body.lineHeight },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm, borderTopWidth: 1, borderTopColor: tokens.colors.border, paddingTop: tokens.space.sm },
  actionBtn: { paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.xs + 2, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.surfaceAlt, borderWidth: 1, borderColor: tokens.colors.border },
  actionText: { fontFamily: tokens.font.sans, color: tokens.colors.accentDeep, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.medium },
  deleteText: { color: tokens.colors.danger },
  editBox: { gap: tokens.space.xs },
  fieldLabel: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.medium },
  input: {
    minHeight: 40,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    color: tokens.colors.text,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
  },
  row: { flexDirection: 'row', gap: tokens.space.sm, marginTop: tokens.space.xs },
  ghostBtn: { flex: 1, height: 40, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.colors.borderStrong, justifyContent: 'center', alignItems: 'center' },
  ghostBtnText: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontWeight: tokens.weight.medium, fontSize: tokens.type.label.fontSize },
  primaryBtn: { flex: 2, height: 40, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.accent, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { fontFamily: tokens.font.sans, color: tokens.colors.onAccent, fontWeight: tokens.weight.semibold, fontSize: tokens.type.label.fontSize },
});
