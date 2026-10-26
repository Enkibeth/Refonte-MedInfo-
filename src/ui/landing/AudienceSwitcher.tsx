import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Persona } from '@/ai/prompts/_schema';
import { APP_FEATURES, type AppFeatureMeta } from '@/ai/routing/featureVisibility';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons';
import { LandingPhoto } from '@/ui/LandingPhoto';
import { navLinkProps } from '@/ui/navLink';
import { tokens } from '@/ui/tokens';
import { Touchable } from '@/ui/Touchable';

import { AUDIENCES } from './copy';
import { lx } from './lx';
import { useInView } from './MockParts';
import { AnswerMock } from './ProductMocks';

const TINTS = {
  public: tokens.colors.personas.public,
  student: tokens.colors.personas.student,
  professional: tokens.colors.personas.pro,
};
const PHOTO_POSITION = { sources: '50% 40%', study: '50% 35%', work: '55% 30%' } as const;
const PHOTO_KEY = { sources: 'sources', study: 'library', work: 'work' } as const;

/**
 * « Trois assistants » (ADR-0047) : un vrai jeu d'onglets (WAI-ARIA, flèches du clavier) qui
 * fait passer la section d'un univers à l'autre : fond, repère coulissant, photographie,
 * aperçu de réponse, outils du profil et accès. Les outils listés viennent du registre
 * `APP_FEATURES` (source de vérité de la visibilité par rôle) ; l'accès réel reste contrôlé
 * par le serveur.
 *
 * @param canOpen    le compte courant peut-il ouvrir ce chatbot ? (visiteur : oui, essai)
 * @param canUseTool l'outil est-il ouvert au compte courant ? (`null` : visiteur, qui voit la
 *                   présentation publique de chaque outil). Sinon la puce reste informative.
 */
export function AudienceSwitcher({
  canOpen,
  canUseTool,
  isAuthed,
}: {
  canOpen: (id: Persona) => boolean;
  canUseTool: ((feature: AppFeatureMeta) => boolean) | null;
  isAuthed: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(View | null)[]>([]);
  const [sectionRef, inView] = useInView<View>();
  const audience = AUDIENCES[active];
  const tint = TINTS[audience.id];
  const tools = APP_FEATURES.filter((f) => f.id !== 'chat' && f.personas.includes(audience.id));
  const allowed = canOpen(audience.id);

  const select = (index: number, focus = false) => {
    const next = (index + AUDIENCES.length) % AUDIENCES.length;
    setActive(next);
    if (focus) (tabRefs.current[next] as unknown as HTMLElement | null)?.focus?.();
  };
  const onKeyDown = (event: { key: string; preventDefault: () => void }) => {
    const moves: Record<string, number> = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: AUDIENCES.length - 1 };
    if (event.key in moves) {
      event.preventDefault();
      select(moves[event.key], true);
    }
  };

  return (
    <View
      ref={sectionRef}
      {...lx('lx-aud', { p: audience.id })}
      style={[styles.section, { backgroundColor: tint.soft }]}
    >
      <View {...lx('lx-container')} style={styles.page}>
        <View {...lx('lx-aud-head')} style={styles.head}>
          <View style={styles.headText}>
            <SectionLabel index="01" label="Trois assistants" color={tint.accent} />
            <Text accessibilityRole="header" aria-level={2} style={styles.title}>
              Le même sujet, expliqué selon votre profil.
            </Text>
          </View>
          <View
            role="tablist"
            aria-label="Choisir un assistant"
            {...(Platform.OS === 'web' ? { onKeyDown } : null)}
            {...lx('lx-tabs', { i: String(active) })}
            style={styles.tabs}
          >
            <View {...lx('lx-tab-ind')} style={[styles.indicator, { backgroundColor: tokens.colors.surface, left: `${(active * 100) / 3}%` }]} />
            {AUDIENCES.map((a, i) => {
              const selected = i === active;
              return (
                <Pressable
                  key={a.id}
                  ref={(node) => {
                    tabRefs.current[i] = node;
                  }}
                  role="tab"
                  nativeID={`lx-tab-${a.id}`}
                  aria-selected={selected}
                  aria-controls="lx-aud-panel"
                  {...(Platform.OS === 'web' ? { tabIndex: selected ? 0 : -1 } : null)}
                  onPress={() => select(i)}
                  style={({ hovered, focused, pressed }: { hovered?: boolean; focused?: boolean; pressed?: boolean }) => [styles.tab, hovered && !selected && styles.tabHover, pressed && styles.tabPressed, focused && tokens.focus.ring]}
                >
                  <Icon name={a.icon} size={16} color={selected ? TINTS[a.id].accent : tokens.colors.textMuted} />
                  <Text {...lx('ge640')} style={[styles.tabLabel, selected && { color: TINTS[a.id].accent }]}>{a.tabLabel}</Text>
                  <Text {...lx('lt640')} style={[styles.tabLabel, selected && { color: TINTS[a.id].accent }]}>{a.shortLabel}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          key={audience.id}
          role="tabpanel"
          nativeID="lx-aud-panel"
          aria-labelledby={`lx-tab-${audience.id}`}
          {...lx('lx-panel')}
          style={styles.panel}
        >
          <View {...lx('lx-panel-text')} style={styles.panelText}>
            <Text style={[styles.audienceLabel, { color: tint.accent }]}>{audience.label}</Text>
            <Text accessibilityRole="header" aria-level={3} style={styles.panelTitle}>{audience.title}</Text>
            <Text style={styles.description}>{audience.description}</Text>
            <View style={styles.points}>
              {audience.points.map((point, i) => (
                <View key={point} style={styles.point}>
                  <Text style={[styles.pointIndex, { color: tint.accent }]}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>
            <View style={styles.actions}>
              <Button
                label={allowed ? `Essayer le chat ${audience.shortLabel.toLowerCase()}` : 'Demander l’accès'}
                onPress={() => router.push((allowed ? `/(chat)/chat?bot=${audience.id}` : '/(account)/choose-role') as never)}
                accessibilityRole="link"
                fullWidth={false}
              />
              <Text style={styles.access}>{accessNote(audience.id, audience.access, isAuthed, allowed)}</Text>
            </View>
            {tools.length > 0 ? (
              <View style={styles.tools}>
                <Text style={styles.toolsLabel}>Outils de ce profil</Text>
                <View style={styles.toolChips}>
                  {tools.map((tool) =>
                    !canUseTool || canUseTool(tool) ? (
                      <Touchable
                        key={tool.id}
                        {...navLinkProps(tool.route, () => router.push(tool.route as never))}
                        accessibilityRole="link"
                        style={styles.toolChip}
                      >
                        <Icon name={tool.icon} size={14} color={tint.accent} />
                        <Text style={styles.toolChipText}>{tool.label}</Text>
                      </Touchable>
                    ) : (
                      <View key={tool.id} style={[styles.toolChip, styles.toolChipLocked]}>
                        <Icon name="lock" size={13} color={tokens.colors.textMuted} />
                        <Text style={[styles.toolChipText, styles.toolChipTextLocked]}>{tool.label}</Text>
                      </View>
                    ),
                  )}
                </View>
              </View>
            ) : null}
          </View>
          <View {...lx('lx-panel-visual')} style={styles.panelVisual}>
            <View {...lx('lx-panel-photo')} style={styles.photo}>
              <LandingPhoto
                photo={PHOTO_KEY[audience.photo]}
                aspectRatio={4 / 5}
                radius={tokens.radius.xl + 4}
                position={PHOTO_POSITION[audience.photo]}
                sizes="(min-width: 1024px) 380px, (min-width: 640px) 60vw, calc(100vw - 32px)"
              />
            </View>
            <View {...lx('lx-panel-mock')} style={styles.mock}>
              <AnswerMock persona={audience.id} question={audience.question} on={inView} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Condition d'accès affichée sous l'action : jamais une promesse au-delà des droits réels. */
function accessNote(id: Persona, access: string, isAuthed: boolean, allowed: boolean): string {
  if (isAuthed) return allowed ? 'Accessible avec votre compte.' : access;
  return id === 'public' ? access : `Essai d’un message sans inscription. ${access}`;
}

/** Repère de section : numéro en serif italique + libellé. */
export function SectionLabel({ index, label, color, tone = 'light' }: { index: string; label: string; color?: string; tone?: 'light' | 'night' }) {
  const night = tone === 'night';
  return (
    <View style={styles.label}>
      <Text style={[styles.labelIndex, { color: color ?? (night ? tokens.colors.night.mint : tokens.colors.accent) }]}>{index}</Text>
      <View {...lx('lx-rule')} style={[styles.labelRule, { backgroundColor: color ?? (night ? tokens.colors.night.mint : tokens.colors.accent) }]} />
      <Text style={[styles.labelText, night && { color: tokens.colors.night.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    position: 'relative',
    overflow: 'hidden',
    paddingTop: tokens.space['3xl'],
    paddingBottom: tokens.space['3xl'],
    ...tokens.motion.transitionWeb,
    ...Platform.select({ web: { transitionDuration: '600ms' }, default: {} }),
  },
  page: { width: '100%', maxWidth: tokens.layout.page, alignSelf: 'center', paddingHorizontal: tokens.space.lg, gap: tokens.space['2xl'] },
  head: { gap: tokens.space.xl },
  headText: { gap: tokens.space.md, flexShrink: 1 },
  title: { fontFamily: tokens.font.serif, color: tokens.colors.text, ...tokens.type.display, fontWeight: tokens.weight.regular, maxWidth: 640 },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    padding: 4,
    borderRadius: tokens.radius.xl + 2,
    backgroundColor: 'rgba(20,30,78,0.07)',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '33.333%',
    borderRadius: tokens.radius.xl - 2,
    ...Platform.select({ web: { boxShadow: '0 1px 2px rgba(20,30,78,0.1), 0 6px 16px -6px rgba(20,30,78,0.22)' }, default: {} }),
  },
  tab: {
    flex: 1,
    minHeight: tokens.size.controlMd + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.xs + 2,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.xl - 2,
  },
  tabHover: { backgroundColor: 'rgba(255,255,255,0.5)' },
  tabPressed: { transform: [{ scale: 0.97 }] },
  tabLabel: { fontFamily: tokens.font.display, color: tokens.colors.textSubtle, ...tokens.type.label, fontWeight: tokens.weight.semibold },
  panel: { gap: tokens.space['2xl'] },
  panelText: { gap: tokens.space.lg },
  audienceLabel: { fontFamily: tokens.font.display, ...tokens.type.label, fontWeight: tokens.weight.semibold },
  panelTitle: { fontFamily: tokens.font.serif, color: tokens.colors.text, ...tokens.type.h1, fontWeight: tokens.weight.regular },
  description: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.bodyLg, maxWidth: tokens.layout.measure },
  points: { gap: 0, maxWidth: tokens.layout.measure },
  point: { flexDirection: 'row', gap: tokens.space.md, paddingVertical: tokens.space.md, borderTopWidth: tokens.border.thin, borderTopColor: 'rgba(20,30,78,0.12)' },
  pointIndex: { fontFamily: tokens.font.serif, fontStyle: 'italic', fontSize: 17, lineHeight: 24, fontVariant: ['tabular-nums'], minWidth: 24 },
  pointText: { flex: 1, fontFamily: tokens.font.sans, color: tokens.colors.text, ...tokens.type.body },
  actions: { gap: tokens.space.sm, alignItems: 'flex-start' },
  access: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption },
  tools: { gap: tokens.space.sm },
  toolsLabel: { fontFamily: tokens.font.display, color: tokens.colors.textMuted, ...tokens.type.caption, fontWeight: tokens.weight.semibold },
  toolChips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  toolChip: {
    minHeight: tokens.size.controlMd - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs + 2,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surface,
    borderWidth: tokens.border.thin,
    borderColor: 'rgba(20,30,78,0.12)',
  },
  toolChipText: { fontFamily: tokens.font.sans, color: tokens.colors.text, ...tokens.type.caption, fontWeight: tokens.weight.semibold },
  toolChipLocked: { backgroundColor: tokens.colors.transparent },
  toolChipTextLocked: { color: tokens.colors.textMuted },
  panelVisual: { position: 'relative', paddingBottom: tokens.space.xl },
  photo: { width: '78%', alignSelf: 'flex-end' },
  mock: { width: '86%', marginTop: -140, alignSelf: 'flex-start' },
  label: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  labelIndex: { fontFamily: tokens.font.serif, fontStyle: 'italic', fontSize: 18, lineHeight: 22 },
  labelRule: { width: 28, height: 1.5 },
  labelText: { fontFamily: tokens.font.display, color: tokens.colors.textSubtle, ...tokens.type.label, fontWeight: tokens.weight.semibold },
});
