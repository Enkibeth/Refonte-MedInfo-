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
 *   - <!--CALC:…--> → score du catalogue : ouverture directe de l'outil Scores ; autres scores
 *     à cocher, envoi groupé (ADR-0044) ;
 *   - <!--OUTIL:…--> → cartes « ouvrir l'outil » (ADR-0044) : la navigation vient de l'écran,
 *     chaque carte est re-filtrée par la visibilité du rôle (jamais d'outil hors périmètre) ;
 *   - [1] + [2] + [3] (étudiant) → propositions à cocher, envoi groupé.
 *
 * Les blocs de propositions (approfondissements / interaction / calc / relances étudiant)
 * ne déclenchent jamais d'envoi au premier clic : cocher bascule la sélection, un bouton
 * « Envoyer (N) » explicite déclenche l'envoi groupé — cohérent avec QUESTIONS_PATIENT.
 */
import { memo, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  formatInlineCitations,
  parseAssistantMessage,
  sourceIdFromSuperscript,
  splitBodySections,
  type DeepeningItem,
  type InteractionGroup,
  type ParsedSource,
  type PatientQuestion,
  domainOfUrl,
  type SourceBadge,
} from '@/ai/chat/parseAssistantMessage';
import {
  moduleActionCard,
  scoreIdForCalc,
  stripInterfaceComments,
  type ChatModuleAction,
  type ModuleActionTool,
} from '@/ai/chat/moduleActions';
import { createFootnoteRegistry, MarkdownRenderer, type FootnoteRegistry } from '@/ui/MarkdownRenderer';
import { featureTint } from '@/ui/featureChips';
import { calcScoreIds, withoutCalcDuplicates } from '@/chat/cardDedupe';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { Button } from '@/ui/Button';
import { Touchable } from '@/ui/Touchable';
import { advanceStreamingBody, EMPTY_STREAMING_BODY, visibleStreamingTail } from '@/chat/streamingBody';

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

/** Numéro d'appel de note d'une source (« SRC3 » → « 3 ») pour la pastille de la carte. */
function sourceNumberOf(id: string): string {
  return id.replace(/^SRC/, '') || id;
}

export function SourceCard({
  source,
  onPress,
}: {
  source: ParsedSource;
  onPress: (s: ParsedSource) => void;
}) {
  const title = source.title || source.shortLabel || source.org || source.id;
  const domain = domainOfUrl(source.url);
  return (
    <Touchable
      style={styles.sourceCard}
      onPress={() => onPress(source)}
      accessibilityRole="button"
      accessibilityLabel={`Source ${source.id} : ${title}, voir le détail`}
    >
      <View style={styles.sourceHeader}>
        <View style={styles.sourceNumber}>
          <Text style={styles.sourceNumberText}>{sourceNumberOf(source.id)}</Text>
        </View>
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
      {domain ? (
        <View style={styles.sourceFooter}>
          <Text style={styles.sourceDomain}>{domain}</Text>
        </View>
      ) : null}
    </Touchable>
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
      <Touchable
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
      </Touchable>
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
    <Button
      label={sent ? 'Envoyé' : `Envoyer (${count})`}
      size="md"
      fullWidth={false}
      disabled={sent || disabled}
      onPress={onPress}
      style={styles.submitButton}
    />
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
          <Touchable
            key={i}
            style={[styles.deepeningButton, checked && styles.deepeningButtonSelected]}
            onPress={() => toggle(i)}
            disabled={disabled || sent}
            accessibilityRole="checkbox"
            aria-checked={checked}
          >
            <CheckToggle checked={checked} />
            <View style={styles.deepeningTextBlock}>
              <Text style={styles.deepeningTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.deepeningDescription}>{item.description}</Text>
              ) : null}
            </View>
          </Touchable>
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
                <Touchable
                  key={opt}
                  style={[styles.optionChip, selected && styles.optionChipSelected]}
                  onPress={() =>
                    setAnswers((prev) => ({ ...prev, [qi]: selected ? '' : opt }))
                  }
                  disabled={disabled || sent}
                  accessibilityRole="radio"
                  aria-checked={selected}
                >
                  <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
                    {opt}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        </View>
      ))}
      <Button
        label={sent ? 'Réponses envoyées' : `Envoyer mes réponses (${answeredCount}/${questions.length})`}
        size="md"
        fullWidth={false}
        disabled={answeredCount === 0 || sent || disabled}
        onPress={submit}
        style={styles.submitButton}
      />
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
                <Touchable
                  key={opt}
                  style={[styles.actionButton, checked && styles.actionButtonSelected]}
                  onPress={() => toggle(gi, opt)}
                  disabled={disabled || sent}
                  accessibilityRole="checkbox"
                  aria-checked={checked}
                >
                  <CheckToggle checked={checked} />
                  <Text style={[styles.actionButtonText, checked && styles.actionButtonTextSelected]}>
                    {opt}
                  </Text>
                </Touchable>
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
          <Touchable
            key={i}
            style={[styles.deepeningButton, checked && styles.deepeningButtonSelected]}
            onPress={() => toggle(i)}
            disabled={disabled || sent}
            accessibilityRole="checkbox"
            aria-checked={checked}
          >
            <CheckToggle checked={checked} />
            <View style={styles.followupIndex}>
              <Text style={styles.followupIndexText}>{i + 1}</Text>
            </View>
            <Text style={styles.followupQuestion}>{q}</Text>
          </Touchable>
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

/**
 * Scores suggérés par le chatbot pro. Décision ADR-0044 : un score présent dans le
 * calculateur s'ouvre DIRECTEMENT dans l'outil Scores (critères figés, calcul déterministe,
 * sans que le modèle fasse l'arithmétique). Seuls les scores absents du catalogue (GRACE,
 * PSI, Apgar…) gardent la proposition « calcule avec moi » dans la conversation, à cocher
 * puis envoyer. Sans accès à l'outil, tous les scores gardent ce comportement.
 */
function CalcBlock({
  ids,
  onSend,
  disabled,
  moduleActions,
}: {
  ids: string[];
  onSend: (text: string) => void;
  disabled: boolean;
  moduleActions?: ModuleActionsHandlers;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);
  const toolIds = moduleActions?.canOpen('scores') ? ids.filter((id) => scoreIdForCalc(id)) : [];
  const chatIds = ids.filter((id) => !toolIds.includes(id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    const labels = chatIds.filter((id) => selected.has(id)).map((id) => CALC_LABELS[id] ?? id.toUpperCase());
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
      {toolIds.length > 0 && moduleActions ? (
        <>
          <Text style={styles.blockLabel}>Scores suggérés · calcul déterministe, sans IA</Text>
          <View style={styles.optionsRow}>
            {toolIds.map((id) => {
              const label = CALC_LABELS[id] ?? id.toUpperCase();
              return (
                <Touchable
                  key={id}
                  style={styles.calcToolChip}
                  onPress={() => moduleActions.onOpen({ tool: 'scores', param: scoreIdForCalc(id) })}
                  accessibilityRole="link"
                  accessibilityLabel={`Calculer ${label} dans l’outil Scores`}
                >
                  <Icon name="calculator" size={14} color={tokens.colors.accentDeep} />
                  <Text style={styles.calcChipText}>{label}</Text>
                  <Icon name="arrowRight" size={13} color={tokens.colors.accentDeep} />
                </Touchable>
              );
            })}
          </View>
        </>
      ) : null}
      {chatIds.length > 0 ? (
        <>
          <Text style={styles.blockLabel}>{toolIds.length > 0 ? 'À calculer avec le chat' : 'Scores cliniques suggérés'}</Text>
          <View style={styles.optionsRow}>
            {chatIds.map((id) => {
              const label = CALC_LABELS[id] ?? id.toUpperCase();
              const checked = selected.has(id);
              return (
                <Touchable
                  key={id}
                  style={[styles.calcChip, checked && styles.calcChipSelected]}
                  onPress={() => toggle(id)}
                  disabled={disabled || sent}
                  accessibilityRole="checkbox"
                  aria-checked={checked}
                >
                  <CheckToggle checked={checked} />
                  <Icon name="calculator" size={14} color={tokens.colors.accentDeep} />
                  <Text style={styles.calcChipText}>{label}</Text>
                </Touchable>
              );
            })}
          </View>
          <SendSelectionButton count={selected.size} sent={sent} disabled={disabled} onPress={submit} />
        </>
      ) : null}
    </View>
  );
}

// ── Cartes « ouvrir l'outil » (<!--OUTIL:…-->, ADR-0044) ─────────────────────

/** Fourni par l'écran du chat : qui peut ouvrir quoi, et comment naviguer. */
export interface ModuleActionsHandlers {
  canOpen: (tool: ModuleActionTool) => boolean;
  onOpen: (action: ChatModuleAction) => void;
}

function ModuleActionsBlock({
  actions,
  moduleActions,
  coveredScores,
}: {
  actions: ChatModuleAction[];
  moduleActions: ModuleActionsHandlers;
  /** Scores déjà proposés par une puce CALC de la même réponse (pas de doublon). */
  coveredScores: Set<string>;
}) {
  const visible = withoutCalcDuplicates(actions, coveredScores).filter((a) => moduleActions.canOpen(a.tool));
  if (visible.length === 0) return null;
  return (
    <View style={styles.actionsWrapper}>
      {visible.map((action) => {
        const card = moduleActionCard(action);
        const tint = featureTint(card.tool);
        return (
          <Touchable
            key={`${card.tool}|${card.param ?? ''}`}
            style={styles.actionCard}
            onPress={() => moduleActions.onOpen(action)}
            accessibilityRole="link"
            accessibilityLabel={`${card.title}. ${card.description} Ouvrir l’outil.`}
            testID="module-action-card"
          >
            <View style={[styles.actionIcon, { backgroundColor: tint.bg }]}>
              <Icon name={card.icon} size={18} color={tint.fg} />
            </View>
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle} numberOfLines={2}>
                {card.title}
              </Text>
              <Text style={styles.actionDescription}>{card.description}</Text>
            </View>
            <View style={styles.actionCta}>
              <Text style={styles.actionCtaText}>Ouvrir</Text>
              <Icon name="arrowRight" size={14} color={tokens.colors.accentDeep} />
            </View>
          </Touchable>
        );
      })}
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
  footnotes,
}: {
  markdown: string;
  sources: ParsedSource[];
  onOpenSource: (s: ParsedSource) => void;
  footnotes: FootnoteRegistry;
}) {
  const [open, setOpen] = useState(false);
  const onCitationPress = useCitationResolver(sources, onOpenSource);
  return (
    <View style={styles.reflectionWrapper}>
      <Touchable
        style={styles.sourcesToggle}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
      >
        <Icon name="bookOpen" size={15} color={tokens.colors.textMuted} />
        <Text style={styles.reflectionToggleText}>Auto-réflexion de l’IA</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={15} color={tokens.colors.textMuted} />
        </View>
      </Touchable>
      {open ? (
        <View style={styles.reflectionBody}>
          <MarkdownRenderer
            text={formatInlineCitations(markdown)}
            onCitationPress={onCitationPress}
            footnotes={footnotes}
          />
        </View>
      ) : null}
    </View>
  );
}

// ── Corps avec titres MAJUSCULES ──────────────────────────────────────────────

const BodyBlock = memo(function BodyBlock({
  markdown,
  sources,
  onOpenSource,
  footnotes,
}: {
  markdown: string;
  sources: ParsedSource[];
  onOpenSource: (s: ParsedSource) => void;
  footnotes: FootnoteRegistry;
}) {
  // (SRCx) → appels de note en exposant, APRÈS le découpage en sections : un titre
  // MAJUSCULES contenant une référence resterait sinon non détecté (¹ hors classe).
  // Un marqueur d'interface glissé dans le texte n'est jamais affiché (sa carte est rendue à part).
  const sections = useMemo(() => splitBodySections(stripInterfaceComments(markdown)), [markdown]);
  const onCitationPress = useCitationResolver(sources, onOpenSource);
  return (
    <View style={styles.bodyWrapper}>
      {sections.map((section, i) => (
        <View key={i} style={styles.bodySection}>
          {section.heading ? (
            <Text style={styles.sectionHeading}>{formatInlineCitations(section.heading)}</Text>
          ) : null}
          {section.markdown ? (
            <MarkdownRenderer
              text={formatInlineCitations(section.markdown)}
              onCitationPress={onCitationPress}
              footnotes={footnotes}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
});

// ── Composant principal ───────────────────────────────────────────────────────

export function AssistantBlocks({
  text,
  onSend,
  disabled,
  onOpenSource,
  streaming = false,
  moduleActions,
}: {
  text: string;
  onSend: (text: string) => void;
  disabled: boolean;
  onOpenSource: (s: ParsedSource) => void;
  streaming?: boolean;
  /** Absent : aucune carte d'outil n'est rendue (et pas de lien vers le calculateur). */
  moduleActions?: ModuleActionsHandlers;
}) {
  const incrementalRef = useRef(streaming);
  if (streaming) incrementalRef.current = true;
  const incremental = incrementalRef.current;
  // Un registre de notes par réponse, conservé d'un fragment à l'autre (les blocs clos,
  // mémoïsés, ne se re-rendent pas) et remis à zéro quand le texte repart d'ailleurs
  // (régénération) : les liens sont numérotés 1, 2, 3… dans l'ordre du message entier.
  const footnotesRef = useRef<{ text: string; registry: FootnoteRegistry }>({ text: '', registry: createFootnoteRegistry() });
  if (!text.startsWith(footnotesRef.current.text)) {
    footnotesRef.current = { text, registry: createFootnoteRegistry() };
  } else {
    footnotesRef.current.text = text;
  }
  const footnotes = footnotesRef.current.registry;
  const bodyRef = useRef(EMPTY_STREAMING_BODY);
  const body = incremental ? advanceStreamingBody(bodyRef.current, text, !streaming) : EMPTY_STREAMING_BODY;
  bodyRef.current = body;
  const structuredText = streaming ? '' : incremental ? body.deferred ?? text : text;
  const parsed = useMemo(() => parseAssistantMessage(structuredText), [structuredText]);
  // Scores déjà ouverts par une puce CALC (calculateur accessible) : leur carte Scores serait
  // un doublon.
  const canOpenScores = !!moduleActions?.canOpen('scores');
  const coveredScores = useMemo(
    () => (canOpenScores ? calcScoreIds(parsed.blocks.flatMap((b) => (b.type === 'calc' ? b.ids : []))) : new Set<string>()),
    [parsed, canOpenScores],
  );
  const tail = streaming ? visibleStreamingTail(body.pending) : '';

  return (
    <View style={styles.root}>
      {body.chunks.map((markdown, i) => (
        <View key={`body-${i}`} testID="completed-answer-block">
          <BodyBlock markdown={markdown} sources={parsed.sources} onOpenSource={onOpenSource} footnotes={footnotes} />
        </View>
      ))}
      {tail ? (
        <View key={`body-${body.chunks.length}`}>
          <BodyBlock markdown={tail} sources={parsed.sources} onOpenSource={onOpenSource} footnotes={footnotes} />
        </View>
      ) : null}
      {parsed.blocks.map((block, i) => {
        switch (block.type) {
          case 'body':
            if (incremental && body.deferred === null) return null;
            return (
              <BodyBlock
                key={i}
                markdown={block.markdown}
                sources={parsed.sources}
                onOpenSource={onOpenSource}
                footnotes={footnotes}
              />
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
                footnotes={footnotes}
              />
            );
          case 'calc':
            return (
              <CalcBlock key={i} ids={block.ids} onSend={onSend} disabled={disabled} moduleActions={moduleActions} />
            );
          case 'actions':
            return moduleActions ? (
              <ModuleActionsBlock key={i} actions={block.actions} moduleActions={moduleActions} coveredScores={coveredScores} />
            ) : null;
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
    paddingBottom: tokens.space.xs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.accentSurfaceStrong,
  },

  blockLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    textTransform: 'none',
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
  sourcesToggle: { minHeight: tokens.size.controlMd,
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
    gap: tokens.space.xs,
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
  sourceNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.accentSurfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceNumberText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.bold,
  },
  sourceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
    marginTop: 2,
  },
  sourceDomain: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
  },

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

  actionsWrapper: { gap: tokens.space.sm, marginTop: tokens.space.xs },
  actionCard: {
    minHeight: tokens.size.controlMd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    ...tokens.motion.transitionWeb,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextBlock: { flex: 1, gap: 2 },
  actionTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  actionDescription: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
  },
  actionCta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCtaText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  calcToolChip: {
    minHeight: tokens.size.controlMd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    ...tokens.motion.transitionWeb,
  },

  deepeningWrapper: { gap: tokens.space.sm, marginTop: tokens.space.xs },
  deepeningButton: { minHeight: tokens.size.controlMd,
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
  optionChip: { minHeight: tokens.size.controlMd, justifyContent: 'center',
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
  submitButton: { alignSelf: 'flex-start', marginTop: tokens.space.xs },

  interactionWrapper: { gap: tokens.space.md, marginTop: tokens.space.xs },
  interactionGroup: { gap: tokens.space.sm },
  interactionQuestion: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  actionButton: { minHeight: tokens.size.controlMd,
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
  calcChip: { minHeight: tokens.size.controlMd,
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
