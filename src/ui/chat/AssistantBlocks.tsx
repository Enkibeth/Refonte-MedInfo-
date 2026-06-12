/**
 * Rendu interactif des réponses des 3 chatbots (refonte 2026-06).
 *
 * Transforme le texte structuré imposé par les prompts v3 en éléments visuels :
 *   - titres MAJUSCULES → en-têtes de section ;
 *   - SOURCES → cartes cliquables avec badge (OFFICIEL / GUIDELINE / ÉTUDE / RCP) ;
 *   - APPROFONDISSEMENTS → boutons « aller plus loin » ;
 *   - QUESTIONS_PATIENT → formulaire 3 questions à choix multiples (1 envoi groupé) ;
 *   - INTERACTION → boutons d'action rapide (format public et pro) ;
 *   - AUTO-RÉFLEXION → carte repliable discrète ;
 *   - <!--CALC:…--> → puces de scores cliniques ;
 *   - [1] + [2] + [3] (étudiant) → boutons d'approfondissement numérotés.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  formatInlineCitations,
  parseAssistantMessage,
  splitBodySections,
  type DeepeningItem,
  type InteractionGroup,
  type ParsedSource,
  type PatientQuestion,
  type SourceBadge,
} from '@/ai/chat/parseAssistantMessage';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

// ── Sources ───────────────────────────────────────────────────────────────────

const BADGE_STYLE: Record<SourceBadge, { bg: string; fg: string }> = {
  OFFICIEL: { bg: tokens.colors.accentSurfaceStrong, fg: tokens.colors.accentDeep },
  GUIDELINE: { bg: tokens.colors.personas.student.soft, fg: tokens.colors.personas.student.accent },
  'ÉTUDE': { bg: tokens.colors.personas.public.soft, fg: tokens.colors.personas.public.accent },
  RCP: { bg: tokens.colors.warningBackground, fg: tokens.colors.warningText },
};

export function SourceBadgePill({ badge }: { badge: SourceBadge }) {
  const s = BADGE_STYLE[badge];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{badge}</Text>
    </View>
  );
}

export function SourceCard({ source, onPress }: { source: ParsedSource; onPress: (s: ParsedSource) => void }) {
  const title = source.title || source.shortLabel || source.org || source.id;
  return (
    <TouchableOpacity
      style={styles.sourceCard}
      onPress={() => onPress(source)}
      accessibilityRole="button"
      accessibilityLabel={`Source ${source.id} : ${title} — voir le détail`}
    >
      <View style={styles.sourceHeader}>
        <Text style={styles.sourceId}>{source.id}</Text>
        {source.badge ? <SourceBadgePill badge={source.badge} /> : null}
        {source.year ? <Text style={styles.sourceYear}>{source.year}</Text> : null}
        <View style={styles.sourceLinkIcon}>
          <Icon name="chevronDown" size={14} color={tokens.colors.textMuted} />
        </View>
      </View>
      <Text style={styles.sourceTitle}>{title}</Text>
      {source.org && source.org !== source.shortLabel ? (
        <Text style={styles.sourceOrg}>{source.org}</Text>
      ) : null}
      {source.justification ? (
        <Text style={styles.sourceJustification} numberOfLines={2}>
          {source.justification}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export function SourcesBlock({
  sources,
  startOpen = false,
  onOpenSource,
}: {
  sources: ParsedSource[];
  startOpen?: boolean;
  onOpenSource: (s: ParsedSource) => void;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <View style={styles.sourcesWrapper}>
      <TouchableOpacity
        style={styles.sourcesToggle}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`Sources (${sources.length})`}
      >
        <Icon name="bookOpen" size={16} color={tokens.colors.accentDeep} />
        <Text style={styles.sourcesToggleText}>Sources ({sources.length})</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={16} color={tokens.colors.textMuted} />
        </View>
      </TouchableOpacity>
      {open ? (
        <View style={styles.sourcesList}>
          {sources.map((s) => (
            <SourceCard key={s.id + (s.url ?? '')} source={s} onPress={onOpenSource} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Approfondissements ────────────────────────────────────────────────────────

function DeepeningBlock({
  items,
  onSend,
  disabled,
}: {
  items: DeepeningItem[];
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.deepeningWrapper}>
      <Text style={styles.blockLabel}>Pour aller plus loin</Text>
      {items.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={styles.deepeningButton}
          onPress={() => onSend(item.question)}
          disabled={disabled}
          accessibilityRole="button"
        >
          <View style={styles.deepeningTextBlock}>
            <Text style={styles.deepeningTitle}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.deepeningDescription}>{item.description}</Text>
            ) : null}
          </View>
          <Icon name="arrowRight" size={16} color={tokens.colors.accent} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── QUESTIONS_PATIENT (formulaire groupé) ─────────────────────────────────────

function PatientQuestionsBlock({
  questions,
  onSend,
  disabled,
}: {
  questions: PatientQuestion[];
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [sent, setSent] = useState(false);
  const answeredCount = Object.keys(answers).length;

  const submit = () => {
    const parts = questions
      .map((q, i) => (answers[i] ? `${q.text} → ${answers[i]}` : null))
      .filter(Boolean);
    if (parts.length === 0) return;
    setSent(true);
    onSend(`Mes réponses :\n${parts.map((p) => `- ${p}`).join('\n')}`);
  };

  return (
    <View style={styles.patientFormWrapper}>
      <Text style={styles.blockLabel}>Quelques précisions pour mieux vous répondre</Text>
      {questions.map((q, qi) => (
        <View key={qi} style={styles.patientQuestion}>
          <Text style={styles.patientQuestionText}>{q.text}</Text>
          <View style={styles.optionsRow}>
            {q.options.map((opt) => {
              const selected = answers[qi] === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionChip, selected && styles.optionChipSelected]}
                  onPress={() =>
                    setAnswers((prev) => ({ ...prev, [qi]: selected ? '' : opt }))
                  }
                  disabled={disabled || sent}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      <TouchableOpacity
        style={[styles.submitButton, (answeredCount === 0 || sent || disabled) && styles.submitButtonDisabled]}
        onPress={submit}
        disabled={answeredCount === 0 || sent || disabled}
        accessibilityRole="button"
      >
        <Text style={styles.submitButtonText}>
          {sent ? 'Réponses envoyées' : `Envoyer mes réponses (${answeredCount}/${questions.length})`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── INTERACTION (boutons d'action) ────────────────────────────────────────────

function InteractionBlock({
  groups,
  onSend,
  disabled,
}: {
  groups: InteractionGroup[];
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.interactionWrapper}>
      {groups.map((group, gi) => (
        <View key={gi} style={styles.interactionGroup}>
          {group.question ? <Text style={styles.interactionQuestion}>{group.question}</Text> : null}
          <View style={styles.optionsRow}>
            {group.options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.actionButton}
                onPress={() => onSend(group.question ? `${group.question} → ${opt}` : opt)}
                disabled={disabled}
                accessibilityRole="button"
              >
                <Text style={styles.actionButtonText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Boutons étudiants [1] [2] [3] ─────────────────────────────────────────────

function FollowupsBlock({
  questions,
  onSend,
  disabled,
}: {
  questions: string[];
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.deepeningWrapper}>
      <Text style={styles.blockLabel}>Approfondir</Text>
      {questions.map((q, i) => (
        <TouchableOpacity
          key={i}
          style={styles.deepeningButton}
          onPress={() => onSend(q)}
          disabled={disabled}
          accessibilityRole="button"
        >
          <View style={styles.followupIndex}>
            <Text style={styles.followupIndexText}>{i + 1}</Text>
          </View>
          <Text style={styles.followupQuestion}>{q}</Text>
          <Icon name="arrowRight" size={16} color={tokens.colors.accent} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Scores cliniques (CALC) ───────────────────────────────────────────────────

const CALC_LABELS: Record<string, string> = {
  chads: 'CHA₂DS₂-VASc',
  hasbled: 'HAS-BLED',
  timi: 'TIMI',
  rcri: 'RCRI (Lee)',
  heart: 'HEART',
  grace: 'GRACE',
  wells: 'Wells (EP)',
  wellstvp: 'Wells (TVP)',
  pesi: 'PESI',
  psi: 'PSI',
  curb65: 'CURB-65',
  geneva: 'Genève',
  news2: 'NEWS2',
  qsofa: 'qSOFA',
  sofa: 'SOFA',
  glasgow: 'Glasgow',
  nihss: 'NIHSS',
  abcd2: 'ABCD²',
  mrs: 'mRS',
  gbs: 'Glasgow-Blatchford',
  childpugh: 'Child-Pugh',
  meld: 'MELD',
  centor: 'Centor',
  apgar: 'Apgar',
  bishop: 'Bishop',
  mmrc: 'mMRC',
  cat: 'CAT',
};

function CalcBlock({
  ids,
  onSend,
  disabled,
}: {
  ids: string[];
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.calcWrapper}>
      <Text style={styles.blockLabel}>Scores cliniques suggérés</Text>
      <View style={styles.optionsRow}>
        {ids.map((id) => {
          const label = CALC_LABELS[id] ?? id.toUpperCase();
          return (
            <TouchableOpacity
              key={id}
              style={styles.calcChip}
              onPress={() => onSend(`Calcule avec moi le score ${label} : pose-moi les questions item par item.`)}
              disabled={disabled}
              accessibilityRole="button"
            >
              <Icon name="calculator" size={14} color={tokens.colors.accentDeep} />
              <Text style={styles.calcChipText}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── AUTO-RÉFLEXION ────────────────────────────────────────────────────────────

function ReflectionBlock({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.reflectionWrapper}>
      <TouchableOpacity
        style={styles.sourcesToggle}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
      >
        <Icon name="sparkles" size={15} color={tokens.colors.textMuted} />
        <Text style={styles.reflectionToggleText}>Auto-réflexion de l'IA</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={15} color={tokens.colors.textMuted} />
        </View>
      </TouchableOpacity>
      {open ? (
        <View style={styles.reflectionBody}>
          <MarkdownRenderer text={formatInlineCitations(markdown)} />
        </View>
      ) : null}
    </View>
  );
}

// ── Corps avec titres MAJUSCULES ──────────────────────────────────────────────

function BodyBlock({ markdown }: { markdown: string }) {
  // (SRCx) → appels de note en exposant, APRÈS le découpage en sections : un titre
  // MAJUSCULES contenant une référence resterait sinon non détecté (¹ hors classe).
  const sections = useMemo(() => splitBodySections(markdown), [markdown]);
  return (
    <View style={styles.bodyWrapper}>
      {sections.map((section, i) => (
        <View key={i} style={styles.bodySection}>
          {section.heading ? (
            <Text style={styles.sectionHeading}>{formatInlineCitations(section.heading)}</Text>
          ) : null}
          {section.markdown ? <MarkdownRenderer text={formatInlineCitations(section.markdown)} /> : null}
        </View>
      ))}
    </View>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function AssistantBlocks({
  text,
  onSend,
  disabled,
  onOpenSource,
}: {
  text: string;
  onSend: (text: string) => void;
  disabled: boolean;
  onOpenSource: (s: ParsedSource) => void;
}) {
  const parsed = useMemo(() => parseAssistantMessage(text), [text]);

  return (
    <View style={styles.root}>
      {parsed.blocks.map((block, i) => {
        switch (block.type) {
          case 'body':
            return <BodyBlock key={i} markdown={block.markdown} />;
          case 'sources':
            return <SourcesBlock key={i} sources={block.sources} onOpenSource={onOpenSource} />;
          case 'deepening':
            return <DeepeningBlock key={i} items={block.items} onSend={onSend} disabled={disabled} />;
          case 'questionsPatient':
            return (
              <PatientQuestionsBlock key={i} questions={block.questions} onSend={onSend} disabled={disabled} />
            );
          case 'interaction':
            return <InteractionBlock key={i} groups={block.groups} onSend={onSend} disabled={disabled} />;
          case 'reflection':
            return <ReflectionBlock key={i} markdown={block.markdown} />;
          case 'calc':
            return <CalcBlock key={i} ids={block.ids} onSend={onSend} disabled={disabled} />;
          case 'followups':
            return <FollowupsBlock key={i} questions={block.questions} onSend={onSend} disabled={disabled} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { gap: tokens.space.sm },
  bodyWrapper: { gap: tokens.space.xs },
  bodySection: { gap: tokens.space.xs },
  sectionHeading: {
    fontFamily: tokens.font.display,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: 0.6,
    marginTop: tokens.space.sm,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.accentSurfaceStrong,
  },

  blockLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  badge: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: tokens.font.sans,
    fontSize: 10.5,
    fontWeight: tokens.weight.bold,
    letterSpacing: 0.4,
  },

  sourcesWrapper: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    overflow: 'hidden',
  },
  sourcesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.md,
  },
  sourcesToggleText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  sourcesList: { gap: tokens.space.sm, padding: tokens.space.md, paddingTop: 0 },
  sourceCard: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    padding: tokens.space.md,
    gap: 4,
    ...tokens.motion.transitionWeb,
  },
  sourceHeader: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  sourceId: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: tokens.weight.bold,
  },
  sourceYear: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: 12 },
  sourceLinkIcon: { marginLeft: 'auto' },
  sourceTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    lineHeight: 19,
  },
  sourceOrg: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: 12.5 },
  sourceJustification: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
  },
  sourceUrl: { fontFamily: tokens.font.sans, color: tokens.colors.accent, fontSize: 11.5 },

  deepeningWrapper: { gap: tokens.space.sm, marginTop: tokens.space.xs },
  deepeningButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    ...tokens.motion.transitionWeb,
  },
  deepeningTextBlock: { flex: 1, gap: 2 },
  deepeningTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  deepeningDescription: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
  },

  followupIndex: {
    width: 24,
    height: 24,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followupIndexText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: 12,
    fontWeight: tokens.weight.bold,
  },
  followupQuestion: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 19,
    fontWeight: tokens.weight.medium,
  },

  patientFormWrapper: {
    gap: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    padding: tokens.space.lg,
    marginTop: tokens.space.xs,
  },
  patientQuestion: { gap: tokens.space.sm },
  patientQuestionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    lineHeight: 19,
  },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  optionChip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 6,
    ...tokens.motion.transitionWeb,
  },
  optionChipSelected: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accent,
  },
  optionChipText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize + 0.5,
    fontWeight: tokens.weight.medium,
  },
  optionChipTextSelected: { color: tokens.colors.onAccent },
  submitButton: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.sm + 2,
    ...tokens.motion.transitionWeb,
  },
  submitButtonDisabled: { backgroundColor: tokens.colors.borderStrong },
  submitButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },

  interactionWrapper: { gap: tokens.space.md, marginTop: tokens.space.xs },
  interactionGroup: { gap: tokens.space.sm },
  interactionQuestion: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  actionButton: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm + 1,
    ...tokens.motion.transitionWeb,
  },
  actionButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },

  calcWrapper: { gap: tokens.space.sm, marginTop: tokens.space.xs },
  calcChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 6,
  },
  calcChipText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize + 0.5,
    fontWeight: tokens.weight.semibold,
  },

  reflectionWrapper: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    overflow: 'hidden',
  },
  reflectionToggleText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  reflectionBody: { paddingHorizontal: tokens.space.md, paddingBottom: tokens.space.md },
});
