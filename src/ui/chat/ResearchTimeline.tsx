/**
 * Déroulé vertical de la génération d'une réponse (2026-10, retour de la timeline
 * « Étapes » demandé par Hugo).
 *
 * Deux usages :
 *  - pendant l'attente : déroulé VIVANT dans la zone de statut — analyse, réflexion
 *    (titre du résumé du modèle), recherches avec les requêtes exactes, pages consultées
 *    (domaines cliquables), recherche dans une page, puis rédaction ;
 *  - au-dessus d'une réponse : en-tête repliable « Étapes · 3 recherches · 14 pages
 *    consultées » (fermé par défaut) qui garde la trace de ce qui a été fait.
 *
 * Données : `buildResearchTimeline` (src/ai/chat/researchTimeline.ts), dérivées des parts du
 * flux — rien n'est supposé ni inventé. Pastille active pulsante, coupée sous
 * prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import type { ResearchTimelineView, TimelineStep, TimelineStepKind } from '@/ai/chat/researchTimeline';
import { researchSummaryLine } from '@/ai/chat/researchTimeline';
import { Icon } from '@/ui/icons';
import type { IconName } from '@/ui/iconPaths';
import { tokens } from '@/ui/tokens';
import { Touchable } from '@/ui/Touchable';
import { useReducedMotion } from '@/ui/useReducedMotion';

const STEP_ICONS: Record<TimelineStepKind, IconName> = {
  analyze: 'brain',
  think: 'sparkles',
  search: 'search',
  read: 'fileText',
  find: 'search',
  write: 'penLine',
};

/** Domaines affichés par étape avant le « +N ». */
const MAX_SOURCES_SHOWN = 6;

function StepDot({ status }: { status: TimelineStep['status'] }) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (status !== 'active' || reduced) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0.45, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [status, reduced, pulse]);

  if (status === 'done') {
    return (
      <View style={[styles.dot, styles.dotDone]}>
        <Icon name="check" size={10} color={tokens.colors.onAccent} />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={[styles.dot, styles.dotError]}>
        <Icon name="x" size={10} color={tokens.colors.onAccent} />
      </View>
    );
  }
  return (
    <View style={[styles.dot, styles.dotActive]}>
      <Animated.View style={[styles.dotActiveCore, { opacity: reduced ? 1 : pulse }]} />
    </View>
  );
}

function SourceChips({ step }: { step: TimelineStep }) {
  if (step.sources.length === 0) return null;
  const shown = step.sources.slice(0, MAX_SOURCES_SHOWN);
  const rest = step.sources.length - shown.length;
  return (
    <View style={styles.chipRow}>
      {shown.map((s) => (
        <Touchable
          key={s.url}
          style={styles.chip}
          onPress={() => void Linking.openURL(s.url)}
          accessibilityRole="link"
          accessibilityLabel={`Page consultée : ${s.domain}`}
          {...(Platform.OS === 'web' ? { title: s.url } : {})}
        >
          <Icon name="globe" size={11} color={tokens.colors.textMuted} />
          <Text style={styles.chipText} numberOfLines={1}>
            {s.domain}
          </Text>
        </Touchable>
      ))}
      {rest > 0 ? <Text style={styles.chipMore}>+{rest}</Text> : null}
    </View>
  );
}

function StepRow({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  const active = step.status === 'active';
  return (
    <View style={styles.stepRow}>
      <View style={styles.railColumn}>
        <StepDot status={step.status} />
        {!isLast ? <View style={[styles.rail, step.status === 'done' && styles.railDone]} /> : null}
      </View>
      <View style={[styles.stepBody, isLast && styles.stepBodyLast]}>
        <View style={styles.stepHead}>
          <Icon name={STEP_ICONS[step.kind]} size={13} color={active ? tokens.colors.accent : tokens.colors.textMuted} />
          <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
            {step.title}
            {active ? '…' : ''}
          </Text>
        </View>
        {step.detail ? (
          <Text style={styles.stepDetail} numberOfLines={2}>
            {step.detail}
          </Text>
        ) : null}
        {step.queries.map((q) => (
          <Text key={q} style={styles.query} numberOfLines={2}>
            « {q} »
          </Text>
        ))}
        <SourceChips step={step} />
      </View>
    </View>
  );
}

/** Déroulé vertical des étapes (vivant pendant la génération). */
export function ResearchTimeline({ view }: { view: ResearchTimelineView }) {
  if (view.steps.length === 0) return null;
  return (
    <View style={styles.timeline} accessibilityLabel="Étapes de la génération de la réponse">
      {view.steps.map((s, i) => (
        <StepRow key={s.id} step={s} isLast={i === view.steps.length - 1} />
      ))}
    </View>
  );
}

/**
 * En-tête repliable « Étapes » au-dessus d'une réponse — fermé par défaut : la
 * transparence est à un clic, jamais dans les jambes de la lecture.
 */
export function ResearchStepsToggle({ view }: { view: ResearchTimelineView }) {
  const [open, setOpen] = useState(false);
  if (view.steps.length === 0) return null;
  const summary = researchSummaryLine(view);
  return (
    <View style={styles.toggleWrapper}>
      <Touchable
        style={styles.toggle}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`Étapes de la réponse : ${summary}`}
        aria-expanded={open}
      >
        <Icon name="calendarCheck" size={14} color={tokens.colors.accent} />
        <Text style={styles.toggleText} numberOfLines={1}>
          Étapes
        </Text>
        <Text style={styles.toggleSummary} numberOfLines={1}>
          {summary}
        </Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={14} color={tokens.colors.textMuted} />
        </View>
      </Touchable>
      {open ? <ResearchTimeline view={view} /> : null}
    </View>
  );
}

const DOT = 18;

const styles = StyleSheet.create({
  timeline: { paddingTop: tokens.space.xs, maxWidth: 560 },
  stepRow: { flexDirection: 'row', gap: tokens.space.sm },
  railColumn: { width: DOT, alignItems: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: tokens.colors.success },
  dotError: { backgroundColor: tokens.colors.danger },
  dotActive: { borderWidth: 2, borderColor: tokens.colors.accent, backgroundColor: tokens.colors.surface },
  dotActiveCore: { width: 8, height: 8, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.accent },
  rail: { flex: 1, width: 2, minHeight: tokens.space.sm, backgroundColor: tokens.colors.border, marginVertical: 2 },
  railDone: { backgroundColor: tokens.colors.successBackground },
  stepBody: { flex: 1, minWidth: 0, paddingBottom: tokens.space.md, gap: 2 },
  stepBodyLast: { paddingBottom: 0 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs, minHeight: DOT },
  stepLabel: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.label },
  stepLabelActive: { color: tokens.colors.text, fontWeight: '600' },
  stepDetail: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption, fontStyle: 'italic' },
  query: { fontFamily: tokens.font.sans, color: tokens.colors.text, ...tokens.type.caption },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.space.xs, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 220,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  chipText: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: 12, lineHeight: 18 },
  chipMore: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: 12, lineHeight: 18 },
  toggleWrapper: { marginBottom: tokens.space.sm, gap: tokens.space.sm },
  toggle: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: tokens.space.xs,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  toggleText: { fontFamily: tokens.font.sans, color: tokens.colors.text, ...tokens.type.caption, fontWeight: '600' },
  toggleSummary: { flexShrink: 1, fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption },
});
