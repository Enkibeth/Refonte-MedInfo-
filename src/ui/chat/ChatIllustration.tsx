/**
 * Image d'illustration dans une réponse de chat (2026-06).
 *
 * Résout un marqueur `<!--IMG: requête | légende -->` (parseAssistantMessage) via la
 * route proxy `/api/image-search` (Google Programmable Search, clé côté serveur),
 * puis affiche l'image avec sa légende et le domaine d'origine en crédit.
 *
 * Dégradation silencieuse : recherche non configurée, quota dépassé ou aucun
 * résultat → rien n'est affiché (le texte de la réponse se suffit). Si l'image
 * en taille réelle refuse le hotlink, on retombe sur la vignette Google (gstatic).
 */
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { IllustrationImage } from '@/ai/chat/imageSearch';
import { tokens } from '@/ui/tokens';

// Cache mémoire par requête : l'historique re-rend les mêmes marqueurs à chaque
// ouverture de conversation, inutile de re-solliciter le quota Google.
const resolved = new Map<string, IllustrationImage | null>();
const pending = new Map<string, Promise<IllustrationImage | null>>();

function resolveImage(query: string): Promise<IllustrationImage | null> {
  const existing = pending.get(query);
  if (existing) return existing;
  const promise = (async (): Promise<IllustrationImage | null> => {
    try {
      const res = await fetch(`/api/image-search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { image?: IllustrationImage | null };
      return data.image ?? null;
    } catch {
      return null;
    }
  })().then((image) => {
    resolved.set(query, image);
    pending.delete(query);
    return image;
  });
  pending.set(query, promise);
  return promise;
}

function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function ChatIllustration({ query, caption }: { query: string; caption: string }) {
  const [image, setImage] = useState<IllustrationImage | null | undefined>(() => resolved.get(query));
  const [useThumbnail, setUseThumbnail] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (resolved.has(query)) {
      setImage(resolved.get(query));
      return;
    }
    let cancelled = false;
    void resolveImage(query).then((img) => {
      if (!cancelled) setImage(img);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!image || failed) return null;

  const uri = useThumbnail ? image.thumbnailUrl : image.url;
  if (!uri) return null;

  const domain = domainOf(image.contextUrl);
  const aspectRatio =
    image.width && image.height && image.height > 0 ? image.width / image.height : 16 / 10;

  return (
    <View style={styles.figure}>
      <Image
        source={{ uri }}
        style={[styles.image, { aspectRatio: Math.min(Math.max(aspectRatio, 0.6), 2.4) }]}
        resizeMode="cover"
        accessibilityLabel={caption}
        onError={() => {
          // Hotlink refusé par le site d'origine → vignette Google, sinon abandon.
          if (!useThumbnail && image.thumbnailUrl) setUseThumbnail(true);
          else setFailed(true);
        }}
      />
      <Text style={styles.caption}>
        {caption}
        {domain ? <Text style={styles.credit}> — {domain}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  figure: {
    gap: tokens.space.xs,
    marginVertical: tokens.space.xs,
  },
  image: {
    width: '100%',
    maxHeight: 280,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  caption: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
  },
  credit: {
    color: tokens.colors.textMuted,
  },
});
