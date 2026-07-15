/**
 * Section QCM du chatbot étudiant (2026-07) — génération à la demande + rendu interactif.
 *
 * `QcmLauncher` affiche un bouton sous une réponse du chat étudiant ; au clic, il génère
 * un mini-examen de QCM/QCS type EDN (route /api/qcm) sur le sujet de la conversation, puis
 * `QcmRunner` le rend interactif : sélection des propositions (QCS = un seul choix, QCM =
 * plusieurs), validation explicite, puis correction item par item avec justifications et
 * note /20 calculée DÉTERMINISTEment (barème EDN « discordances », src/qcm/qcm.ts).
 *
 * Aucune note ne vient de l'IA : elle ne fournit que la grille (propositions correct/incorrect
 * + explications). Rien n'est archivé.
 */
import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

import { tokens } from '@/ui/tokens';
import { Icon } from '@/ui/icons';
import {
  scoreQcm,
  scoreQuestion,
  propositionLetter,
  type Qcm,
  type QcmResult,
} from '@/qcm/qcm';

// ── Lancement (bouton + fetch) ───────────────────────────────────────────────

export function QcmLauncher({
  token,
  buildContext,
  disabled,
}: {
  token: string | null;
  /** Construit { topic?, context } à envoyer (dernier échange du chat). */
  buildContext: () => { topic?: string; context: string };
  disabled?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [qcm, setQcm] = useState<Qcm | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [runKey, setRunKey] = useState(0);

  async function generate() {
    if (state === 'loading') return;
    const { topic, context } = buildContext();
    if (!context.trim() && !topic?.trim()) {
      setErrorMsg('Pose d’abord une question dans le chat pour générer un QCM sur ce sujet.');
      setState('error');
      return;
    }
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/qcm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ topic, context }),
      });
      const data = (await res.json()) as { qcm?: Qcm; error?: string };
      if (!res.ok || !data.qcm) {
        setErrorMsg(data.error ?? 'Échec de la génération du QCM.');
        setState('error');
        return;
      }
      setQcm(data.qcm);
      setRunKey((k) => k + 1);
      setState('ready');
    } catch {
      setErrorMsg('Impossible de générer le QCM (connexion ?). Réessaie.');
      setState('error');
    }
  }

  if (state === 'ready' && qcm) {
    return <QcmRunner key={runKey} qcm={qcm} onRegenerate={generate} regenerating={false} />;
  }

  return (
    <View style={styles.launcher}>
      <TouchableOpacity
        style={[styles.launchButton, (disabled || state === 'loading') && styles.launchButtonDisabled]}
        onPress={generate}
        disabled={disabled || state === 'loading'}
        accessibilityRole="button"
        accessibilityLabel="Générer un QCM d’entraînement sur ce sujet"
      >
        {state === 'loading' ? (
          <ActivityIndicator size="small" color={tokens.colors.onAccent} />
        ) : (
          <Icon name="fileText" size={16} color={tokens.colors.onAccent} />
        )}
        <Text style={styles.launchButtonText}>
          {state === 'loading' ? 'Génération du QCM…' : 'Générer un QCM (type EDN)'}
        </Text>
      </TouchableOpacity>
      {state === 'error' ? <Text style={styles.launchError}>{errorMsg}</Text> : null}
    </View>
  );
}

// ── Notation d'affichage ─────────────────────────────────────────────────────

type Tone = 'success' | 'warning' | 'danger';

function toneOf(over20: number): Tone {
  if (over20 >= 14) return 'success';
  if (over20 >= 10) return 'warning';
  return 'danger';
}

function toneColors(tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'success':
      return { fg: tokens.colors.success, bg: tokens.colors.successBackground };
    case 'warning':
      return { fg: tokens.colors.warningText, bg: tokens.colors.warningBackground };
    case 'danger':
      return { fg: tokens.colors.danger, bg: tokens.colors.dangerBackground };
  }
}

function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

// ── Examen interactif ────────────────────────────────────────────────────────

export function QcmRunner({
  qcm,
  onRegenerate,
  regenerating,
}: {
  qcm: Qcm;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  // Une entrée par question : ensemble des indices de propositions cochées.
  const [answers, setAnswers] = useState<Set<number>[]>(() => qcm.questions.map(() => new Set<number>()));
  const [submitted, setSubmitted] = useState(false);

  const result: QcmResult | null = useMemo(
    () => (submitted ? scoreQcm(qcm, answers) : null),
    [submitted, qcm, answers],
  );

  function toggle(qi: number, pi: number) {
    if (submitted) return;
    setAnswers((prev) => {
      const next = prev.map((s) => new Set(s));
      const set = next[qi];
      const question = qcm.questions[qi];
      if (question.kind === 'QCS') {
        // Choix unique : sélectionner remplace, recliquer désélectionne.
        if (set.has(pi)) set.clear();
        else {
          set.clear();
          set.add(pi);
        }
      } else if (set.has(pi)) set.delete(pi);
      else set.add(pi);
      return next;
    });
  }

  const answeredCount = answers.filter((s) => s.size > 0).length;
  const tone = result ? toneOf(result.over20) : null;
  const heroColors = tone ? toneColors(tone) : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Icon name="fileText" size={14} color={tokens.colors.accentDeep} />
          <Text style={styles.headerBadgeText}>QCM · type EDN</Text>
        </View>
        <Text style={styles.title}>{qcm.title}</Text>
        {qcm.topic ? <Text style={styles.topic}>{qcm.topic}</Text> : null}
      </View>

      {/* Score global (après validation) */}
      {result && heroColors ? (
        <View style={[styles.scoreHero, { backgroundColor: heroColors.bg }]}>
          <Text style={[styles.scoreHeroValue, { color: heroColors.fg }]}>
            {formatPoints(result.over20)}
            <Text style={styles.scoreHeroMax}>/20</Text>
          </Text>
          <Text style={[styles.scoreHeroLabel, { color: heroColors.fg }]}>
            {result.perfectCount}/{result.max} question{result.max > 1 ? 's' : ''} parfaite
            {result.perfectCount > 1 ? 's' : ''} · {formatPoints(result.total)}/{result.max} pts
          </Text>
        </View>
      ) : null}

      {qcm.questions.map((question, qi) => {
        const qScore = result ? result.perQuestion[qi] : null;
        return (
          <View key={qi} style={styles.question}>
            <View style={styles.questionHead}>
              <Text style={styles.questionNum}>Question {qi + 1}</Text>
              <View style={styles.kindPill}>
                <Text style={styles.kindPillText}>{question.kind}</Text>
              </View>
              {qScore ? (
                <Text
                  style={[
                    styles.questionScore,
                    { color: qScore.perfect ? tokens.colors.success : qScore.score > 0 ? tokens.colors.warningText : tokens.colors.danger },
                  ]}
                >
                  {formatPoints(qScore.score)}/1
                </Text>
              ) : null}
            </View>
            <Text style={styles.stem}>{question.stem}</Text>

            {question.propositions.map((prop, pi) => {
              const checked = answers[qi].has(pi);
              // Après correction : verdict visuel par proposition.
              const showResult = submitted;
              const isCorrect = prop.correct;
              const rowTone: 'correctPicked' | 'correctMissed' | 'wrongPicked' | 'neutral' = !showResult
                ? 'neutral'
                : isCorrect && checked
                  ? 'correctPicked'
                  : isCorrect && !checked
                    ? 'correctMissed'
                    : !isCorrect && checked
                      ? 'wrongPicked'
                      : 'neutral';

              return (
                <TouchableOpacity
                  key={pi}
                  style={[
                    styles.prop,
                    checked && !submitted && styles.propChecked,
                    rowTone === 'correctPicked' && styles.propCorrect,
                    rowTone === 'correctMissed' && styles.propMissed,
                    rowTone === 'wrongPicked' && styles.propWrong,
                  ]}
                  onPress={() => toggle(qi, pi)}
                  disabled={submitted}
                  accessibilityRole={question.kind === 'QCS' ? 'radio' : 'checkbox'}
                  accessibilityState={{ checked }}
                >
                  <View
                    style={[
                      styles.propMark,
                      question.kind === 'QCS' && styles.propMarkRadio,
                      checked && styles.propMarkChecked,
                      rowTone === 'correctPicked' && styles.propMarkCorrect,
                      rowTone === 'wrongPicked' && styles.propMarkWrong,
                    ]}
                  >
                    {checked ? <Text style={styles.propMarkGlyph}>{question.kind === 'QCS' ? '●' : '✓'}</Text> : null}
                  </View>
                  <Text style={styles.propLetter}>{propositionLetter(pi)}.</Text>
                  <View style={styles.propBody}>
                    <Text style={styles.propText}>{prop.text}</Text>
                    {submitted ? (
                      <Text style={styles.propExplain}>
                        {isCorrect ? '✓ Vrai' : '✗ Faux'}
                        {prop.explanation ? ` — ${prop.explanation}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}

      {/* Actions */}
      {!submitted ? (
        <TouchableOpacity
          style={[styles.validate, answeredCount === 0 && styles.validateDisabled]}
          onPress={() => setSubmitted(true)}
          disabled={answeredCount === 0}
          accessibilityRole="button"
          accessibilityLabel="Valider mes réponses et voir la correction"
        >
          <Text style={styles.validateText}>
            Valider mes réponses{answeredCount < qcm.questions.length ? ` (${answeredCount}/${qcm.questions.length})` : ''}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.afterActions}>
          <TouchableOpacity
            style={styles.retry}
            onPress={() => {
              setAnswers(qcm.questions.map(() => new Set<number>()));
              setSubmitted(false);
            }}
            accessibilityRole="button"
          >
            <Icon name="refresh" size={14} color={tokens.colors.accentDeep} />
            <Text style={styles.retryText}>Refaire ce QCM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.retry}
            onPress={onRegenerate}
            disabled={regenerating}
            accessibilityRole="button"
          >
            {regenerating ? (
              <ActivityIndicator size="small" color={tokens.colors.accentDeep} />
            ) : (
              <Icon name="sparkles" size={14} color={tokens.colors.accentDeep} />
            )}
            <Text style={styles.retryText}>Nouveau QCM</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  launcher: { marginTop: tokens.space.sm, gap: tokens.space.xs },
  launchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    ...tokens.elevation.sm,
  },
  launchButtonDisabled: { opacity: 0.55 },
  launchButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  launchError: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.caption.fontSize,
  },

  card: {
    marginTop: tokens.space.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.md,
    ...tokens.elevation.sm,
  },
  header: { gap: 4 },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  headerBadgeText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.semibold,
    letterSpacing: tokens.type.h3.letterSpacing,
  },
  topic: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },

  scoreHero: {
    borderRadius: tokens.radius.md,
    padding: tokens.space.md,
    alignItems: 'center',
    gap: 2,
  },
  scoreHeroValue: { fontFamily: tokens.font.display, fontSize: 34, fontWeight: tokens.weight.bold },
  scoreHeroMax: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.fontSize, fontWeight: tokens.weight.medium },
  scoreHeroLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.medium },

  question: {
    gap: tokens.space.sm,
    paddingTop: tokens.space.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  questionHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  questionNum: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  kindPill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  kindPillText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  questionScore: {
    marginLeft: 'auto',
    fontFamily: tokens.font.display,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
  },
  stem: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    fontWeight: tokens.weight.medium,
  },

  prop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    padding: tokens.space.sm,
  },
  propChecked: { borderColor: tokens.colors.accent, backgroundColor: tokens.colors.accentSurface },
  propCorrect: { borderColor: tokens.colors.success, backgroundColor: tokens.colors.successBackground },
  propMissed: { borderColor: tokens.colors.warningText, backgroundColor: tokens.colors.warningBackground },
  propWrong: { borderColor: tokens.colors.danger, backgroundColor: tokens.colors.dangerBackground },
  propMark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  propMarkRadio: { borderRadius: 11 },
  propMarkChecked: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  propMarkCorrect: { backgroundColor: tokens.colors.success, borderColor: tokens.colors.success },
  propMarkWrong: { backgroundColor: tokens.colors.danger, borderColor: tokens.colors.danger },
  propMarkGlyph: { color: tokens.colors.onAccent, fontSize: 13, fontWeight: tokens.weight.bold, lineHeight: 16 },
  propLetter: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.body.fontSize,
    fontWeight: tokens.weight.semibold,
    marginTop: 1,
  },
  propBody: { flex: 1, gap: 2 },
  propText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  propExplain: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
  },

  validate: {
    height: 46,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
  },
  validateDisabled: { opacity: 0.5 },
  validateText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: tokens.type.body.fontSize,
  },
  afterActions: { flexDirection: 'row', gap: tokens.space.sm, flexWrap: 'wrap' },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  retryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
});
