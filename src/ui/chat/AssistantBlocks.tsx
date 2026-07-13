/**
 * Rendu interactif des réponses des 3 chatbots (refonte 2026-06).
 *
 * Transforme le texte structuré imposé par les prompts v3 en éléments visuels :
 *   - titres MAJUSCULES → en-têtes de section ;
 *   - SOURCES → cartes cliquables avec badge (OFFICIEL / GUIDELINE / ÉTUDE / RCP) ;
 *   - références inline (¹ ²…) dans le corps → cliquables, ouvrent la même modale de source ;
 *   - APPROFONDISSEMENTS → propositions à cocher, envoi groupé quand l'utilisateur le décide ;
 *   - QUESTIONS_PATIENT → formulaire 3 questions à choix multiples (1 envoi groupé) ;
 *   - INTERACTION → propositions à cocher (format public et pro), envoi groupé ;
 *   - AUTO-RÉFLEXION → carte repliable discrète ;
 *   - <!--CALC:…--> → scores cliniques à cocher, envoi groupé ;
 *   - [1] + [2] + [3] (étudiant) → propositions à cocher, envoi groupé.
 *
 * Les blocs de propositions (approfondissements / interaction / calc / relances étudiant)
 * ne déclenchent jamais d'envoi au premier clic : cocher bascule la sélection, un bouton
 * « Envoyer (N) » explicite déclenche l'envoi groupé — cohérent avec QUESTIONS_PATIENT.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  formatInlineCitations,
  parseAssistantMessage,
  sourceIdFromSuperscript,
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

// ── Sélection à cocher + envoi groupé ─────────────────────────────────────────
// Motif commun à tous les blocs de propositions (approfondissements, interaction,
// scores, relances étudiant) : on coche une ou plusieurs propositions, puis on
// choisit soi-même quand les envoyer — plus d'envoi immédiat au premier clic.

function CheckToggle({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked ? <Icon name="check" size={12} color={tokens.colors.onAccent} /> : null}
    </View>
  );
}

function SendSelectionButton({
  count,
  sent,
  disabled,
  onPress,
}: {
  count: number;
  sent: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  if (count === 0 && !sent) return null;
  return (
    <TouchableOpacity
      style={[styles.submitButton, (sent || disabled) && styles.submitButtonDisabled]}
      onPress={onPress}
      disabled={sent || disabled}
      accessibilityRole="button"
    >
      <Text style={styles.submitButtonText}>
        {sent ? 'Envoyé' : `Envoyer (${count})`}
      </Text>
    </TouchableOpacity>
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sent, setSent] = useState(false);

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const submit = () => {
    if (selected.size === 0) return;
    const text = items
      .filter((_, i) => selected.has(i))
      .map((item) => item.question)
      .join('\n');
    setSent(true);
    onSend(text);
  };

  return (
    <View style={styles.deepeningWrapper}>
      <Text style={styles.blockLabel}>Pour aller plus loin</Text>
      {items.map((item, i) => {
        const checked = selected.has(i);
        return (
          <TouchableOpacity
            key={i}
            style={[styles.deepeningButton, checked && styles.deepeningButtonSelected]}
            onPress={() => toggle(i)}
            disabled={disabled || sent}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <CheckToggle checked={checked} />
            <View style={styles.deepeningTextBlock}>
              <Text style={styles.deepeningTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.deepeningDescription}>{item.description}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
      <SendSelectionButton count={selected.size} sent={sent} disabled={disabled} onPress={submit} />
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
  // Une désélection laisse une chaîne vide : seules les réponses non vides comptent
  // (sinon le bouton affichait « (1/3) » actif mais inopérant).
  const answeredCount = Object.values(answers).filter(Boolean).length;

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
  const [selected, setSelected] = useState<Record<number, Set<string>>>({});
  const [sent, setSent] = useState(false);
  const count = Object.values(selected).reduce((n, s) => n + s.size, 0);

  const toggle = (gi: number, opt: string) => {
    setSelected((prev) => {
      const current = new Set(prev[gi] ?? []);
      if (current.has(opt)) current.delete(opt);
      else current.add(opt);
      return { ...prev, [gi]: current };
    });
  };

  const submit = () => {
    const parts = groups
      .map((group, gi) => {
        const opts = [...(selected[gi] ?? [])];
        if (opts.length === 0) return null;
        return group.question ? `${group.question} → ${opts.join(', ')}` : opts.join(', ');
      })
      .filter((p): p is string => !!p);
    if (parts.length === 0) return;
    setSent(true);
    onSend(parts.join('\n'));
  };

  return (
    <View style={styles.interactionWrapper}>
      {groups.map((group, gi) => (
        <View key={gi} style={styles.interactionGroup}>
          {group.question ? <Text style={styles.interactionQuestion}>{group.question}</Text> : null}
          <View style={styles.optionsRow}>
            {group.options.map((opt) => {
              const checked = selected[gi]?.has(opt) ?? false;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.actionButton, checked && styles.actionButtonSelected]}
                  onPress={() => toggle(gi, opt)}
                  disabled={disabled || sent}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <CheckToggle checked={checked} />
                  <Text style={[styles.actionButtonText, checked && styles.actionButtonTextSelected]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      <SendSelectionButton count={count} sent={sent} disabled={disabled} onPress={submit} />
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sent, setSent] = useState(false);

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const submit = () => {
    if (selected.size === 0) return;
    const text = questions.filter((_, i) => selected.has(i)).join('\n');
    setSent(true);
    onSend(text);
  };

  return (
    <View style={styles.deepeningWrapper}>
      <Text style={styles.blockLabel}>Approfondir</Text>
      {questions.map((q, i) => {
        const checked = selected.has(i);
        return (
          <TouchableOpacity
            key={i}
            style={[styles.deepeningButton, checked && styles.deepeningButtonSelected]}
            onPress={() => toggle(i)}
            disabled={disabled || sent}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <CheckToggle checked={checked} />
            <View style={styles.followupIndex}>
              <Text style={styles.followupIndexText}>{i + 1}</Text>
            </View>
            <Text style={styles.followupQuestion}>{q}</Text>
          </TouchableOpacity>
        );
      })}
      <SendSelectionButton count={selected.size} sent={sent} disabled={disabled} onPress={submit} />
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    const labels = ids.filter((id) => selected.has(id)).map((id) => CALC_LABELS[id] ?? id.toUpperCase());
    if (labels.length === 0) return;
    const text =
      labels.length === 1
        ? `Calcule avec moi le score ${labels[0]} : pose-moi les questions item par item.`
        : `Calcule avec moi les scores suivants : ${labels.join(', ')} : pose-moi les questions item par item pour chacun.`;
    setSent(true);
    onSend(text);
  };

  return (
    <View style={styles.calcWrapper}>
      <Text style={styles.blockLabel}>Scores cliniques suggérés</Text>
      <View style={styles.optionsRow}>
        {ids.map((id) => {
          const label = CALC_LABELS[id] ?? id.toUpperCase();
          const checked = selected.has(id);
          return (
            <TouchableOpacity
              key={id}
              style={[styles.calcChip, checked && styles.calcChipSelected]}
              onPress={() => toggle(id)}
              disabled={disabled || sent}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              <CheckToggle checked={checked} />
              <Icon name="calculator" size={14} color={tokens.colors.accentDeep} />
              <Text style={styles.calcChipText}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <SendSelectionButton count={selected.size} sent={sent} disabled={disabled} onPress={submit} />
    </View>
  );
}

// ── AUTO-RÉFLEXION ────────────────────────────────────────────────────────────

/** Résout l'exposant affiché (ex. "¹") vers la source correspondante, si connue. */
function useCitationResolver(sources: ParsedSource[], onOpenSource: (s: ParsedSource) => void) {
  return (superscript: string) => {
    const id = sourceIdFromSuperscript(superscript);
    const source = id ? sources.find((s) => s.id === id) : undefined;
    if (source) onOpenSource(source);
  };
}

function ReflectionBlock({
  markdown,
  sources,
  onOpenSource,
}: {
  markdown: string;
  sources: ParsedSource[];
  onOpenSource: (s: ParsedSource) => void;
}) {
  const [open, setOpen] = useState(false);
  const onCitationPress = useCitationResolver(sources, onOpenSource);
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
          <MarkdownRenderer text={formatInlineCitations(markdown)} onCitationPress={onCitationPress} />
        </View>
      ) : null}
    </View>
  );
}

// ── Corps avec titres MAJUSCULES ──────────────────────────────────────────────

function BodyBlock({
  markdown,
  sources,
  onOpenSource,
}: {
  markdown: string;
  sources: ParsedSource[];
  onOpenSource: (s: ParsedSource) => void;
}) {
  // (SRCx) → appels de note en exposant, APRÈS le découpage en sections : un titre
  // MAJUSCULES contenant une référence resterait sinon non détecté (¹ hors classe).
  const sections = useMemo(() => splitBodySections(markdown), [markdown]);
  const onCitationPress = useCitationResolver(sources, onOpenSource);
  return (
    <View style={styles.bodyWrapper}>
      {sections.map((section, i) => (
        <View key={i} style={styles.bodySection}>
          {section.heading ? (
            <Text style={styles.sectionHeading}>{formatInlineCitations(section.heading)}</Text>
          ) : null}
          {section.markdown ? (
            <MarkdownRenderer text={formatInlineCitations(section.markdown)} onCitationPress={onCitationPress} />
          ) : null}
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
            return (
              <BodyBlock key={i} markdown={block.markdown} sources={parsed.sources} onOpenSource={onOpenSource} />
            );
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
            return (
              <ReflectionBlock
                key={i}
                markdown={block.markdown}
                sources={parsed.sources}
                onOpenSource={onOpenSource}
              />
            );
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
    letterSpacing: tokens.tracking.caps,
    textTransform: 'uppercase',
  },

  badge: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.tracking.caps,
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
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.bold,
  },
  sourceYear: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  sourceLinkIcon: { marginLeft: 'auto' },
  sourceTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    lineHeight: 19,
  },
  sourceOrg: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: tokens.type.caption.fontSize },
  sourceJustification: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
  },
  sourceUrl: { fontFamily: tokens.font.sans, color: tokens.colors.accent, fontSize: tokens.type.micro.fontSize },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: tokens.radius.sm,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accent,
  },

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
  deepeningButtonSelected: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurfaceStrong,
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
    fontSize: tokens.type.caption.fontSize,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm + 1,
    ...tokens.motion.transitionWeb,
  },
  actionButtonSelected: {
    backgroundColor: tokens.colors.accentSurfaceStrong,
  },
  actionButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  actionButtonTextSelected: {
    fontWeight: tokens.weight.semibold,
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
  calcChipSelected: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurfaceStrong,
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
