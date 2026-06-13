/**
 * Panneau « AI Boost » du planificateur (ADR-0027, suivi).
 *
 * L'IA PROPOSE des ajustements d'organisation (bornés, validés serveur) ; l'utilisateur
 * APPLIQUE ou IGNORE chacun — rien n'est modifié automatiquement. Disclosure AI Act.
 *
 * ⚠️ Aucun conseil médical : suggestions purement organisationnelles (tampon, repos,
 * priorité d'un bloc existant, plafond, révision espacée).
 */
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { requestBoost } from '../api';
import type { BoostResponse, BoostSuggestion } from '../boost';
import { PressableScale } from './AnimatedBits';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; data: BoostResponse };

export function AiBoostPanel({
  token,
  planId,
  onApply,
}: {
  token: string | null;
  planId: string;
  onApply: (s: BoostSuggestion) => void;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [applied, setApplied] = useState<Set<number>>(() => new Set());

  async function run() {
    if (!token) {
      setState({ kind: 'error', message: 'Connecte-toi pour utiliser l’AI Boost.' });
      return;
    }
    setState({ kind: 'loading' });
    setApplied(new Set());
    try {
      const data = await requestBoost(token, planId);
      setState({ kind: 'loaded', data });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Suggestions indisponibles.' });
    }
  }

  function apply(s: BoostSuggestion, index: number) {
    onApply(s);
    setApplied((prev) => new Set(prev).add(index));
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <View style={styles.badge}>
            <Icon name="sparkles" size={16} color={tokens.colors.accentDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>AI Boost</Text>
            <Text style={styles.subtitle}>Suggestions d’organisation — tu valides ou tu ignores.</Text>
          </View>
        </View>
      </View>

      {state.kind === 'idle' ? (
        <Button
          label="Optimiser mon planning"
          variant="secondary"
          leftIcon={<Icon name="sparkles" size={16} color={tokens.colors.accentDeep} />}
          onPress={run}
        />
      ) : null}

      {state.kind === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={tokens.colors.accent} />
          <Text style={styles.muted}>Analyse de ton plan…</Text>
        </View>
      ) : null}

      {state.kind === 'error' ? (
        <>
          <Text style={styles.error}>{state.message}</Text>
          <Button label="Réessayer" variant="secondary" onPress={run} />
        </>
      ) : null}

      {state.kind === 'loaded' ? (
        <>
          {state.data.assessment ? <Text style={styles.assessment}>{state.data.assessment}</Text> : null}

          {state.data.refused ? (
            <Text style={styles.muted}>L’assistant est resté dans son rôle d’organisation des révisions.</Text>
          ) : state.data.suggestions.length === 0 ? (
            <Text style={styles.muted}>Aucun ajustement nécessaire — ton plan tient la route.</Text>
          ) : (
            state.data.suggestions.map((s, i) => {
              const done = applied.has(i);
              return (
                <View key={i} style={[styles.suggestion, done && styles.suggestionDone]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionLabel}>{s.label}</Text>
                    <Text style={styles.suggestionRationale}>{s.rationale}</Text>
                  </View>
                  {done ? (
                    <View style={styles.appliedPill}>
                      <Icon name="check" size={13} color={tokens.colors.success} />
                      <Text style={styles.appliedText}>Appliqué</Text>
                    </View>
                  ) : (
                    <PressableScale onPress={() => apply(s, i)} accessibilityLabel={`Appliquer : ${s.label}`} style={styles.applyBtn}>
                      <Text style={styles.applyText}>Appliquer</Text>
                    </PressableScale>
                  )}
                </View>
              );
            })
          )}

          <View style={styles.footerRow}>
            <Text style={styles.disclosure}>Suggestions générées par IA · vérifie qu’elles te conviennent.</Text>
            <PressableScale onPress={run} accessibilityLabel="Régénérer" style={styles.refreshBtn}>
              <Icon name="refresh" size={14} color={tokens.colors.accent} />
              <Text style={styles.refreshText}>Régénérer</Text>
            </PressableScale>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    padding: tokens.space.md,
    gap: tokens.space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, flex: 1 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: tokens.font.sans, color: tokens.colors.accentDeep, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.bold },
  subtitle: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  muted: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.body.fontSize },
  error: { fontFamily: tokens.font.sans, color: tokens.colors.danger, fontSize: tokens.type.caption.fontSize },
  assessment: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.md,
  },
  suggestionDone: { opacity: 0.7 },
  suggestionLabel: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.body.fontSize, fontWeight: tokens.weight.semibold },
  suggestionRationale: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize, marginTop: 2 },
  applyBtn: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accent,
  },
  applyText: { fontFamily: tokens.font.sans, color: tokens.colors.onAccent, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.semibold },
  appliedPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  appliedText: { fontFamily: tokens.font.sans, color: tokens.colors.success, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.semibold },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.sm, marginTop: tokens.space.xs },
  disclosure: { flex: 1, fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.micro.fontSize },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: tokens.space.sm, paddingVertical: 4 },
  refreshText: { fontFamily: tokens.font.sans, color: tokens.colors.accent, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.semibold },
});
