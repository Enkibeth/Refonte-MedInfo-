/**
 * Timeline des étapes de recherche (2026-07) — l'« Étapes » à la Vera Health.
 *
 * Deux usages :
 *  - pendant la génération : timeline VIVANTE dans la zone de statut (étapes cochées au
 *    fil de l'eau, étape active pulsante, compteurs réels : « ≈ 419 publications
 *    identifiées », « 3 résumés analysés », « 5/5 liens valides ») ;
 *  - sous une réponse terminée : panneau repliable « Étapes » (fermé par défaut) qui
 *    montre comment la réponse a été construite — transparence du workflow evidence-first.
 *
 * Rendu 100 % client depuis la data part `data-research` émise par /api/chat
 * (src/ai/chat/researchTimeline.ts) ; aucun appel réseau. Animations coupées sous
 * prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ResearchStepView, ResearchTimelineData } from '@/ai/chat/researchTimeline';
import { Icon } from '@/ui/icons';
import type { IconName } from '@/ui/iconPaths';
import { tokens } from '@/ui/tokens';
import { useReducedMotion } from '@/ui/useReducedMotion';

const STEP_ICONS: Record<ResearchStepView['id'], IconName> = {
  analyze: 'brain',
  concepts: 'sparkles',
  search: 'search',
  trials: 'testTube',
  pubmed: 'bookOpen',
  read: 'fileText',
  verify: 'shieldCheck',
  write: 'penLine',
};

/** Pastille d'état d'une étape : ✓ faite, point pulsant active, cercle vide à venir. */
function StepDot({ status }: { status: ResearchStepView['status'] }) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (status !== 'active' || reduced) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [status, reduced, pulse]);

  if (status === 'done') {
    return (
      <View style={[styles.dot, styles.dotDone]}>
        <Icon name="check" size={11} color={tokens.colors.onAccent} />
      </View>
    );
  }
  if (status === 'active') {
    return (
      <View style={[styles.dot, styles.dotActive]}>
        <Animated.View style={[styles.dotActiveCore, { opacity: reduced ? 1 : pulse }]} />
      </View>
    );
  }
  return <View style={[styles.dot, styles.dotPending]} />;
}

function StepRow({ step, isLast }: { step: ResearchStepView; isLast: boolean }) {
  const muted = step.status === 'pending';
  return (
    <View style={styles.stepRow}>
      <View style={styles.railColumn}>
        <StepDot status={step.status} />
        {!isLast ? <View style={[styles.rail, step.status === 'done' && styles.railDone]} /> : null}
      </View>
      <View style={[styles.stepBody, isLast && styles.stepBodyLast]}>
        <View style={styles.stepHead}>
          <Icon
            name={STEP_ICONS[step.id] ?? 'search'}
            size={13}
            color={muted ? tokens.colors.textMuted : tokens.colors.accentDeep}
          />
          <Text style={[styles.stepLabel, muted && styles.stepLabelMuted]}>{step.label}</Text>
        </View>
        {step.detail ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
        {step.chips.length > 0 ? (
          <View style={styles.chipRow}>
            {step.chips.map((c) => (
              <View key={c} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {c}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Timeline verticale des étapes (vivante pendant la génération). */
export function ResearchTimeline({ data }: { data: ResearchTimelineData }) {
  if (data.steps.length === 0) return null;
  return (
    <View style={styles.timeline} accessibilityLabel="Étapes de la recherche documentaire">
      {data.steps.map((s, i) => (
        <StepRow key={s.id} step={s} isLast={i === data.steps.length - 1} />
      ))}
    </View>
  );
}

/** Résumé une ligne pour l'en-tête du panneau replié (« ≈ 419 sources · 6 étapes »). */
export function researchSummaryLine(data: ResearchTimelineData): string {
  const parts: string[] = [];
  if (data.totalFound != null && data.totalFound > 0) {
    parts.push(`≈ ${data.totalFound} source${data.totalFound > 1 ? 's' : ''} identifiée${data.totalFound > 1 ? 's' : ''}`);
  }
  parts.push(`${data.steps.length} étapes`);
  return parts.join(' · ');
}

/**
 * Panneau repliable « Étapes » d'une réponse terminée — fermé par défaut, comme la
 * carte SOURCES : la transparence est à un clic, jamais dans les jambes.
 */
export function ResearchStepsToggle({ data }: { data: ResearchTimelineData }) {
  const [open, setOpen] = useState(false);
  if (data.steps.length === 0) return null;
  return (
    <View style={styles.toggleWrapper}>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`Étapes de la recherche (${data.steps.length})`}
        accessibilityState={{ expanded: open }}
      >
        <Icon name="calendarCheck" size={15} color={tokens.colors.accentDeep} />
        <Text style={styles.toggleText}>Étapes</Text>
        <Text style={styles.toggleSummary} numberOfLines={1}>
          {researchSummaryLine(data)}
        </Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={15} color={tokens.colors.textMuted} />
        </View>
      </TouchableOpacity>
      {open ? <ResearchTimeline data={data} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: {
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.md,
    alignSelf: 'stretch',
  },
  stepRow: { flexDirection: 'row', alignItems: 'stretch' },
  railColumn: { width: 22, alignItems: 'center' },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: tokens.colors.success },
  dotActive: {
    borderWidth: 2,
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.surface,
  },
  dotActiveCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.accent,
  },
  dotPending: {
    borderWidth: 2,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  rail: { flex: 1, width: 2, backgroundColor: tokens.colors.border, marginVertical: 2 },
  railDone: { backgroundColor: tokens.colors.success },
  stepBody: { flex: 1, paddingLeft: tokens.space.sm, paddingBottom: tokens.space.md, gap: 3 },
  stepBodyLast: { paddingBottom: 0 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    flexShrink: 1,
  },
  stepLabelMuted: { color: tokens.colors.textMuted, fontWeight: tokens.weight.medium },
  stepDetail: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 3,
    maxWidth: 260,
  },
  chipText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
  },
  toggleWrapper: { gap: tokens.space.sm, marginBottom: tokens.space.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  toggleText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  toggleSummary: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    flexShrink: 1,
  },
});
