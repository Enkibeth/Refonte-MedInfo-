/**
 * Éditeur d'article de blog — panel admin (ADR-0024).
 *
 * Ouvre un article (brouillon OU publié) via GET /api/admin/blog?id=… (service role,
 * la page publique ne voyant que les articles publiés). Permet de :
 *  - relire l'article complet en « Aperçu » (rendu fidèle à la page publique) ;
 *  - modifier titre, chapeau, catégorie et contenu markdown, avant comme après publication ;
 *  - mettre en forme via une barre d'outils (sections ##, gras, listes, tableau, séparateur, lien) ;
 *  - remplacer la couverture par une VRAIE photo (upload PNG/JPEG/WebP ≤ 4 Mo ou URL https),
 *    la retirer, et insérer d'autres images dans le corps de l'article (`![légende](url)`).
 *
 * L'upload de fichier passe par un <input type="file"> (web uniquement — le panel admin
 * est utilisé sur le web) ; sur natif, seule l'option « URL » est proposée.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { splitArticleSections } from '@/blog/toc';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { tokens } from '@/ui/tokens';

interface EditorPost {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  cover_image_url: string | null;
  content_md: string;
  status: 'draft' | 'published';
  published_at: string | null;
}

interface PickedImage {
  base64: string;
  contentType: string;
}

/** Sélecteur de fichier image (web uniquement) — null si annulé. */
function pickImageFile(): Promise<PickedImage | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      if (file.size > 4 * 1024 * 1024) {
        return reject(new Error('Image trop lourde (4 Mo max).'));
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
      reader.onload = () => {
        const base64 = String(reader.result).split(',')[1] ?? '';
        resolve({ base64, contentType: file.type || 'image/png' });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export function BlogEditorModal({
  postId,
  accessToken,
  onClose,
}: {
  postId: string;
  accessToken: string;
  /** changed = true si l'article a été modifié/publié (la liste doit se recharger). */
  onClose: (changed: boolean) => void;
}) {
  const [post, setPost] = useState<EditorPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [showCoverUrlInput, setShowCoverUrlInput] = useState(false);

  const [mode, setMode] = useState<'edit' | 'preview'>('preview');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const changedRef = useRef(false);
  const selectionRef = useRef({ start: 0, end: 0 });

  const headers = useCallback(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/blog?id=${encodeURIComponent(postId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Erreur de chargement.');
        if (cancelled) return;
        const p = data.post as EditorPost;
        setPost(p);
        setTitle(p.title);
        setSummary(p.summary ?? '');
        setCategory(p.category ?? '');
        setContent(p.content_md);
        setCoverUrl(p.cover_image_url);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, accessToken]);

  const markDirty = () => {
    setDirty(true);
    setNotice(null);
  };

  // ── Insertion markdown à la position du curseur ─────────────────────────────
  const insertSnippet = (snippet: string, wrap?: { prefix: string; suffix: string }) => {
    const { start, end } = selectionRef.current;
    setContent((prev) => {
      const s = Math.min(start, prev.length);
      const e = Math.min(end, prev.length);
      if (wrap && e > s) {
        return prev.slice(0, s) + wrap.prefix + prev.slice(s, e) + wrap.suffix + prev.slice(e);
      }
      return prev.slice(0, s) + snippet + prev.slice(s);
    });
    markDirty();
  };

  // ── Sauvegarde / publication ────────────────────────────────────────────────
  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          action: 'update',
          id: postId,
          title,
          summary,
          category,
          content_md: content,
          cover_image_url: coverUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Échec de la sauvegarde.');
      changedRef.current = true;
      setDirty(false);
      setNotice('Modifications enregistrées.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la sauvegarde.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    if (!post) return;
    setPublishing(true);
    setError(null);
    try {
      if (dirty && !(await save())) return;
      const publish = post.status !== 'published';
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ action: 'publish', id: postId, publish }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Échec.');
      changedRef.current = true;
      setPost({ ...post, status: publish ? 'published' : 'draft' });
      setNotice(publish ? 'Article publié — visible sur le blog public.' : 'Article dépublié (brouillon).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la publication.');
    } finally {
      setPublishing(false);
    }
  }

  // ── Images ──────────────────────────────────────────────────────────────────
  async function uploadImage(target: 'cover' | 'inline') {
    setError(null);
    let picked: PickedImage | null = null;
    try {
      picked = await pickImageFile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image illisible.');
      return;
    }
    if (!picked) {
      if (Platform.OS !== 'web') {
        setError("L'import de fichier n'est disponible que sur le web — utilise l'option URL.");
      }
      return;
    }
    setUploading(true);
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          action: 'upload_image',
          id: postId,
          dataBase64: picked.base64,
          contentType: picked.contentType,
          target,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de l'envoi.");
      changedRef.current = true;
      if (target === 'cover') {
        // L'upload de couverture est persisté immédiatement côté serveur.
        setCoverUrl(data.url as string);
        setNotice('Photo de couverture remplacée.');
      } else {
        insertSnippet(`\n\n![Légende de l'image](${data.url})\n\n`);
        setNotice("Image insérée dans l'article — pense à adapter la légende.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi de l'image.");
    } finally {
      setUploading(false);
    }
  }

  function applyCoverUrl() {
    const url = coverUrlInput.trim();
    if (!url) return;
    if (!/^https:\/\//.test(url)) {
      setError("L'URL de l'image doit commencer par https://");
      return;
    }
    setCoverUrl(url);
    setCoverUrlInput('');
    setShowCoverUrlInput(false);
    markDirty();
  }

  // ── Rendu ───────────────────────────────────────────────────────────────────
  const sections = mode === 'preview' ? splitArticleSections(content) : [];

  const toolbar: { label: string; onPress: () => void }[] = [
    { label: '## Section', onPress: () => insertSnippet('\n## Titre de section\n') },
    { label: '### Sous-titre', onPress: () => insertSnippet('\n### Sous-titre\n') },
    { label: 'B  Gras', onPress: () => insertSnippet('**texte en gras**', { prefix: '**', suffix: '**' }) },
    { label: '•  Liste', onPress: () => insertSnippet('\n- élément\n- élément\n') },
    { label: '1. Liste', onPress: () => insertSnippet('\n1. premier\n2. deuxième\n') },
    {
      label: '⊞ Tableau',
      onPress: () =>
        insertSnippet('\n| Colonne 1 | Colonne 2 |\n| --- | --- |\n| valeur | valeur |\n'),
    },
    { label: '— Séparateur', onPress: () => insertSnippet('\n---\n') },
    { label: '🔗 Lien', onPress: () => insertSnippet('[texte du lien](https://)') },
    { label: '🖼 Image (fichier)', onPress: () => void uploadImage('inline') },
    { label: '🖼 Image (URL)', onPress: () => insertSnippet('\n\n![Légende de l’image](https://)\n\n') },
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={() => onClose(changedRef.current)}>
      <View style={styles.screen}>
        {/* En-tête */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => onClose(changedRef.current)}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Fermer l'éditeur"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {post ? title || post.title : 'Article'}
            </Text>
            {post ? (
              <Text style={[styles.statusLabel, post.status === 'published' ? styles.statusPub : styles.statusDraft]}>
                {post.status === 'published' ? '● Publié' : '● Brouillon'}
                {dirty ? '  ·  modifications non enregistrées' : ''}
              </Text>
            ) : null}
          </View>
          <View style={styles.modeSwitch}>
            {(['preview', 'edit'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                onPress={() => setMode(m)}
                accessibilityRole="button"
              >
                <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                  {m === 'preview' ? 'Aperçu' : 'Modifier'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {loading ? (
          <ActivityIndicator color={tokens.colors.accent} style={{ marginTop: tokens.space['2xl'] }} />
        ) : !post ? null : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
            <View style={styles.inner}>
              {mode === 'preview' ? (
                <>
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cover, styles.coverEmpty]}>
                      <Text style={styles.coverEmptyText}>Sans image de couverture</Text>
                    </View>
                  )}
                  {category ? (
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryText}>{category}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.previewTitle}>{title}</Text>
                  {summary ? <Text style={styles.previewSummary}>{summary}</Text> : null}
                  {sections.map((s, index) => (
                    <View key={index} style={styles.previewSection}>
                      {s.heading ? <Text style={styles.previewHeading}>{s.heading}</Text> : null}
                      {s.markdown ? <MarkdownRenderer text={s.markdown} /> : null}
                    </View>
                  ))}
                </>
              ) : (
                <>
                  {/* Couverture */}
                  <View style={styles.fieldCard}>
                    <Text style={styles.fieldLabel}>Image de couverture</Text>
                    {coverUrl ? (
                      <Image source={{ uri: coverUrl }} style={styles.coverThumb} resizeMode="cover" />
                    ) : (
                      <Text style={styles.coverNone}>Aucune image pour le moment.</Text>
                    )}
                    <Text style={styles.fieldHint}>
                      Pour un sujet clinique, préfère une vraie photo (libre de droits) à une
                      illustration générée par IA.
                    </Text>
                    <View style={styles.coverActions}>
                      {Platform.OS === 'web' ? (
                        <TouchableOpacity
                          style={styles.smallBtn}
                          onPress={() => void uploadImage('cover')}
                          disabled={uploading}
                          accessibilityRole="button"
                        >
                          <Text style={styles.smallBtnText}>
                            {uploading ? 'Envoi…' : '📷 Importer une photo'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={() => setShowCoverUrlInput((v) => !v)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.smallBtnText}>🔗 Depuis une URL</Text>
                      </TouchableOpacity>
                      {coverUrl ? (
                        <TouchableOpacity
                          style={styles.smallBtn}
                          onPress={() => {
                            setCoverUrl(null);
                            markDirty();
                          }}
                          accessibilityRole="button"
                        >
                          <Text style={styles.smallBtnDanger}>Retirer l'image</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {showCoverUrlInput ? (
                      <View style={styles.urlRow}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          value={coverUrlInput}
                          onChangeText={setCoverUrlInput}
                          placeholder="https://…"
                          placeholderTextColor={tokens.colors.textMuted}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TouchableOpacity style={styles.smallBtn} onPress={applyCoverUrl} accessibilityRole="button">
                          <Text style={styles.smallBtnText}>OK</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>

                  {/* Métadonnées */}
                  <View style={styles.fieldCard}>
                    <Text style={styles.fieldLabel}>Titre</Text>
                    <TextInput
                      style={styles.input}
                      value={title}
                      onChangeText={(t) => {
                        setTitle(t);
                        markDirty();
                      }}
                      multiline
                    />
                    <Text style={styles.fieldLabel}>Chapeau (résumé)</Text>
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      value={summary}
                      onChangeText={(t) => {
                        setSummary(t);
                        markDirty();
                      }}
                      multiline
                    />
                    <Text style={styles.fieldLabel}>Catégorie</Text>
                    <TextInput
                      style={styles.input}
                      value={category}
                      onChangeText={(t) => {
                        setCategory(t);
                        markDirty();
                      }}
                    />
                  </View>

                  {/* Contenu + barre d'outils */}
                  <View style={styles.fieldCard}>
                    <Text style={styles.fieldLabel}>Contenu (markdown)</Text>
                    <Text style={styles.fieldHint}>
                      Les titres « ## » alimentent le sommaire cliquable de la page publique.
                      Sélectionne du texte puis « Gras » pour l'entourer, ou place le curseur
                      pour insérer un bloc.
                    </Text>
                    <View style={styles.toolbar}>
                      {toolbar.map((t) => (
                        <TouchableOpacity
                          key={t.label}
                          style={styles.toolBtn}
                          onPress={t.onPress}
                          disabled={uploading}
                          accessibilityRole="button"
                        >
                          <Text style={styles.toolBtnText}>{t.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={styles.contentInput}
                      value={content}
                      onChangeText={(t) => {
                        setContent(t);
                        markDirty();
                      }}
                      onSelectionChange={(e) => {
                        selectionRef.current = e.nativeEvent.selection;
                      }}
                      multiline
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        )}

        {/* Pied : actions */}
        {post ? (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.footerBtn, styles.saveBtn, (!dirty || saving) && styles.btnDisabled]}
              onPress={() => void save()}
              disabled={!dirty || saving}
              accessibilityRole="button"
            >
              {saving ? <ActivityIndicator size="small" color={tokens.colors.onAccent} /> : null}
              <Text style={styles.saveBtnText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerBtn, styles.publishBtn, publishing && styles.btnDisabled]}
              onPress={() => void togglePublish()}
              disabled={publishing}
              accessibilityRole="button"
            >
              <Text style={styles.publishBtnText}>
                {publishing
                  ? '…'
                  : post.status === 'published'
                    ? 'Dépublier'
                    : dirty
                      ? 'Enregistrer et publier'
                      : 'Publier'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  closeBtn: { padding: tokens.space.sm },
  closeBtnText: { fontFamily: tokens.font.sans, fontSize: tokens.type.h3.fontSize, color: tokens.colors.textSubtle },
  headerTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  statusLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.micro.fontSize, marginTop: 1 },
  statusPub: { color: tokens.colors.success },
  statusDraft: { color: tokens.colors.warningText },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSunken,
    padding: 2,
  },
  modeBtn: { borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.md, paddingVertical: 5 },
  modeBtnActive: { backgroundColor: tokens.colors.surface },
  modeBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  modeBtnTextActive: { color: tokens.colors.text },
  error: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.label.fontSize,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.sm,
  },
  notice: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.success,
    fontSize: tokens.type.label.fontSize,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.sm,
  },
  content: { flexGrow: 1, alignItems: 'center', paddingBottom: tokens.space['2xl'] },
  inner: {
    width: '100%',
    maxWidth: 760,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.lg,
    gap: tokens.space.lg,
  },
  // Aperçu
  cover: { width: '100%', height: 260, borderRadius: tokens.radius.lg, backgroundColor: tokens.colors.surfaceAlt },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  coverEmptyText: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.label.fontSize },
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  categoryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  previewTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  previewSummary: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  previewSection: { gap: tokens.space.sm },
  previewHeading: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginTop: tokens.space.md,
  },
  // Édition
  fieldCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
  },
  fieldLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
  },
  input: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm + 2,
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  coverThumb: { width: '100%', height: 180, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.surfaceAlt },
  coverNone: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.label.fontSize, fontStyle: 'italic' },
  coverActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  smallBtn: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs + 2,
  },
  smallBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  smallBtnDanger: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.xs + 2 },
  toolBtn: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    paddingHorizontal: tokens.space.sm + 2,
    paddingVertical: 4,
  },
  toolBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  contentInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    fontFamily: tokens.font.mono,
    color: tokens.colors.text,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 20,
    minHeight: 420,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.sm + 2,
  },
  saveBtn: { backgroundColor: tokens.colors.accentVivid },
  saveBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  publishBtn: { borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface },
  publishBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  btnDisabled: { opacity: 0.5 },
});
