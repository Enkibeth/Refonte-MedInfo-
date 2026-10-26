import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

import { lx } from './lx';

/**
 * Pièces des aperçus d'interface de l'accueil (ADR-0047).
 *
 * Les aperçus sont des DÉMONSTRATIONS aux contenus fictifs : ils montrent la forme d'un écran
 * réel (mêmes libellés, mêmes badges de source), jamais un résultat d'utilisateur. Chaque
 * cadre porte la mention « Contenu fictif » et se présente aux lecteurs d'écran
 * comme une image décrite (`role="img"`), sans relire chaque élément décoratif.
 *
 * Animations (web) : un élément marqué `lx('lx-a', { k, d })` joue l'animation `k` après
 * `d` pas de 110 ms, seulement quand son aperçu est actif (`data-on="1"`) — voir landingCss.ts.
 */

/** Pas d'animation : `lx-a` + type + rang dans la séquence. */
export function anim(kind: 'grow' | 'rise' | 'pop' | 'bar' | 'fade' | 'check', step: number, extra?: string[]) {
  return lx(['lx-a', ...(extra ?? [])], { k: kind, d: String(step) });
}

/** Vrai quand l'élément entre dans la fenêtre (web) ; toujours vrai en natif. */
export function useInView<T extends View>(options?: { once?: boolean; margin?: string }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(Platform.OS !== 'web');
  const once = options?.once ?? true;
  const margin = options?.margin ?? '0px 0px -15% 0px';
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const node = ref.current as unknown as Element | null;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible && once) {
          setInView(true);
          observer.disconnect();
        } else if (!once) setInView(visible);
      },
      { rootMargin: margin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [once, margin]);
  return [ref, inView] as const;
}

/** Cadre d'aperçu : barre d'en-tête de l'application + mention de démonstration. */
export function MockFrame({
  icon,
  title,
  description,
  on,
  children,
  style,
  tone = 'light',
}: {
  icon: IconName;
  title: string;
  /** Description de l'aperçu pour les lecteurs d'écran. */
  description: string;
  /** Joue les animations de l'aperçu (web). */
  on: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'light' | 'night';
}) {
  const night = tone === 'night';
  return (
    <View
      {...lx('lx-mock', { on: on ? '1' : '0' })}
      accessibilityRole="image"
      accessibilityLabel={`Aperçu de l’interface, contenu fictif : ${description}`}
      style={[styles.frame, night && styles.frameNight, style]}
    >
      <View style={[styles.frameBar, night && styles.frameBarNight]}>
        <View style={[styles.frameIcon, night && styles.frameIconNight]}>
          <Icon name={icon} size={14} color={night ? tokens.colors.night.mint : tokens.colors.accent} />
        </View>
        <Text style={[styles.frameTitle, night && styles.frameTitleNight]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.frameTag, night && styles.frameTagNight]}>Contenu fictif</Text>
      </View>
      <View style={styles.frameBody}>{children}</View>
    </View>
  );
}

/** Ligne de texte esquissée (le contenu n'est pas ce que l'aperçu montre). */
export function Line({ width, step = 0, tone = 'muted', thick = false }: { width: `${number}%`; step?: number; tone?: 'muted' | 'ink' | 'accent' | 'night'; thick?: boolean }) {
  return (
    <View
      {...anim('grow', step)}
      style={[styles.line, { width }, thick && styles.lineThick, tone === 'ink' && styles.lineInk, tone === 'accent' && styles.lineAccent, tone === 'night' && styles.lineNight]}
    />
  );
}

/** Pastille courte (étiquette d'interface). */
export function Tag({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.xl + 2,
    borderWidth: tokens.border.thin,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(20,30,78,0.06), 0 24px 48px -20px rgba(20,30,78,0.28)' },
      default: {},
    }),
  },
  frameNight: {
    backgroundColor: tokens.colors.night.raised,
    borderColor: tokens.colors.night.line,
    ...Platform.select({
      web: { boxShadow: '0 30px 60px -24px rgba(5,10,40,0.7)' },
      default: {},
    }),
  },
  frameBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm + 2,
    backgroundColor: tokens.colors.surfaceAlt,
    borderBottomWidth: tokens.border.thin,
    borderBottomColor: tokens.colors.border,
  },
  frameBarNight: { backgroundColor: tokens.colors.night.deep, borderBottomColor: tokens.colors.night.line },
  frameIcon: {
    width: 24,
    height: 24,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.accentSurface,
  },
  frameIconNight: { backgroundColor: tokens.colors.night.base },
  frameTitle: {
    flex: 1,
    fontFamily: tokens.font.display,
    fontWeight: tokens.weight.semibold,
    color: tokens.colors.text,
    ...tokens.type.caption,
  },
  frameTitleNight: { color: tokens.colors.night.text },
  frameTag: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    ...tokens.type.micro,
  },
  frameTagNight: { color: tokens.colors.night.muted },
  frameBody: { padding: tokens.space.lg, gap: tokens.space.md },
  line: {
    height: 7,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSunken,
    ...Platform.select({ web: { transformOrigin: 'left center' }, default: {} }),
  },
  lineThick: { height: 10 },
  lineInk: { backgroundColor: tokens.colors.borderControl },
  lineAccent: { backgroundColor: tokens.colors.accentSurfaceStrong },
  lineNight: { backgroundColor: tokens.colors.night.line },
  tag: { alignSelf: 'flex-start', borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.sm, paddingVertical: 2 },
  tagText: { fontFamily: tokens.font.sans, fontWeight: tokens.weight.bold, ...tokens.type.micro, letterSpacing: tokens.tracking.caps },
});
