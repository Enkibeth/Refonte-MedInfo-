import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Persona } from '@/ai/prompts/_schema';
import { SourceBadgePill } from '@/ui/chat/AssistantBlocks';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

import type { ShowcaseChapter } from './copy';
import { lx } from './lx';
import { anim, Line, MockFrame, Tag } from './MockParts';

/**
 * Aperçus d'interface de l'accueil (ADR-0047) : démonstrations aux contenus FICTIFS,
 * construites avec les mêmes libellés et badges que les écrans réels. Aucun chiffre d'usage ;
 * les valeurs d'exemple (note ECOS, charge de travail) sont signalées par le cadre.
 */

const NBSP = ' ';
const THIN = ' ';

// ── Chat ──────────────────────────────────────────────────────────────────────
function ChatMock({ on }: { on: boolean }) {
  return (
    <MockFrame on={on} icon="messageCircle" title="Chat étudiant" description="une réponse structurée du chat étudiant, avec ses étapes de recherche et ses sources typées.">
      <View {...anim('rise', 0)} style={styles.userBubble}>
        <Text style={styles.userText}>{`Insuffisance cardiaque${NBSP}: que retenir pour l’EDN${THIN}?`}</Text>
      </View>
      <View {...anim('rise', 1)} style={styles.stepsPill}>
        <Icon name="check" size={13} color={tokens.colors.success} />
        <Text style={styles.stepsText}>Étapes · 3 recherches · 5 sources citées</Text>
        <Icon name="chevronDown" size={13} color={tokens.colors.textMuted} />
      </View>
      <View style={styles.answer}>
        <Text {...anim('fade', 2)} style={styles.answerHeading}>En bref</Text>
        <Line width="96%" step={2} tone="ink" />
        <Line width="88%" step={3} tone="ink" />
        <Line width="62%" step={4} tone="ink" />
        <View style={styles.inlineRow}>
          <Text {...anim('fade', 5)} style={styles.answerHeading}>Diagnostic</Text>
          <Text {...anim('pop', 6)} style={styles.sup}>¹ ²</Text>
        </View>
        <Line width="92%" step={5} />
        <Line width="74%" step={6} />
      </View>
      <View style={styles.sources}>
        {(['OFFICIEL', 'GUIDELINE', 'ÉTUDE'] as const).map((badge, i) => (
          <View key={badge} {...anim('rise', 7 + i)} style={[styles.sourceRow, i > 0 && styles.sourceRowDivided]}>
            <Text style={styles.sourceIndex}>{i + 1}</Text>
            <SourceBadgePill badge={badge} />
            <View style={styles.flex}><Line width={i === 1 ? '70%' : '86%'} step={7 + i} tone="ink" /></View>
          </View>
        ))}
      </View>
    </MockFrame>
  );
}

// ── ECOS ──────────────────────────────────────────────────────────────────────
const ECOS_DIALOGUE: [who: 'me' | 'patient', text: string][] = [
  ['me', `Depuis quand avez-vous cette douleur${THIN}?`],
  ['patient', 'Depuis ce matin, au réveil.'],
  ['me', `Est-ce qu’elle irradie quelque part${THIN}?`],
  ['patient', 'Oui, dans le bras gauche.'],
];
const ECOS_GRID = ['Caractériser la douleur', 'Rechercher les facteurs de risque', 'Examen clinique ciblé', 'Expliquer la suite de la prise en charge'];

function EcosMock({ on }: { on: boolean }) {
  return (
    <MockFrame on={on} icon="stethoscope" title="ECOS · Douleur thoracique" description="une station ECOS fictive : dialogue avec le patient simulé, grille d’évaluation cochée et note sur 20.">
      <View style={styles.ecosHead}>
        <View style={styles.flex}>
          <Tag label="CAS FICTIF" fg={tokens.colors.personas.student.accent} bg={tokens.colors.personas.student.soft} />
          <Text style={styles.ecosTitle}>Station · consultation aux urgences</Text>
        </View>
        <View style={styles.timer}>
          <View {...lx('lx-ring')} style={styles.timerRing} />
          <Icon name="clock" size={18} color={tokens.colors.personas.student.accent} />
        </View>
      </View>
      <View style={styles.dialogue}>
        {ECOS_DIALOGUE.map(([who, text], i) => (
          <View key={text} {...anim('rise', i * 2)} style={[styles.bubble, who === 'me' ? styles.bubbleMe : styles.bubblePatient]}>
            <Text style={[styles.bubbleText, who === 'me' && styles.bubbleTextMe]}>{text}</Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        <View style={styles.gridHead}>
          <Text style={styles.gridTitle}>Grille d’évaluation</Text>
          <Text {...anim('pop', 13)} style={styles.note}>
            {`Note${NBSP}: 14/20`}
          </Text>
        </View>
        {ECOS_GRID.map((item, i) => (
          <View key={item} style={styles.gridRow}>
            <View style={styles.checkBox}>
              <View {...anim('check', 8 + i)} style={styles.checkFill}>
                <Icon name="check" size={11} color={tokens.colors.onAccent} />
              </View>
            </View>
            <Text style={styles.gridText}>{item}</Text>
          </View>
        ))}
      </View>
    </MockFrame>
  );
}

// ── QCM ───────────────────────────────────────────────────────────────────────
const QCM_OPTIONS: [letter: string, text: string, correct: boolean][] = [
  ['A', 'Il évalue l’ouverture des yeux, la réponse verbale et la réponse motrice.', true],
  ['B', 'Le score minimal est de 3.', true],
  ['C', 'Le score maximal est de 20.', false],
  ['D', 'Un score inférieur ou égal à 8 fait discuter une protection des voies aériennes.', true],
];

function QcmMock({ on }: { on: boolean }) {
  return (
    <MockFrame on={on} icon="graduationCap" title="QCM type EDN" description="un QCM type EDN sur le score de Glasgow : propositions cochées puis corrigées, notées selon le barème des discordances.">
      <View style={styles.qcmHead}>
        <Tag label="QCM" fg={tokens.colors.personas.student.accent} bg={tokens.colors.personas.student.soft} />
        <Text style={styles.qcmHint}>Plusieurs réponses possibles</Text>
      </View>
      <Text style={styles.qcmQuestion}>{`Concernant le score de Glasgow, quelles propositions sont exactes${THIN}?`}</Text>
      <View style={styles.options}>
        {QCM_OPTIONS.map(([letter, text, correct], i) => (
          <View key={letter} style={styles.option}>
            <View style={styles.optionBox}>
              {correct ? (
                <View {...anim('check', 1 + i)} style={[styles.checkFill, styles.checkFillAccent]}>
                  <Icon name="check" size={11} color={tokens.colors.onAccent} />
                </View>
              ) : null}
            </View>
            <Text style={styles.optionText}>
              <Text style={styles.optionLetter}>{letter}. </Text>
              {text}
            </Text>
            <View {...anim('pop', 7 + i)} style={[styles.verdict, correct ? styles.verdictOk : styles.verdictNo]}>
              <Text style={[styles.verdictText, { color: correct ? tokens.colors.success : tokens.colors.danger }]}>{correct ? 'Juste' : 'Fausse'}</Text>
            </View>
          </View>
        ))}
      </View>
      <View {...anim('rise', 11)} style={styles.qcmResult}>
        <Text style={styles.qcmResultText}>0 discordance · 1 point</Text>
        <Text style={styles.qcmResultHint}>Barème EDN, calculé sur l’appareil</Text>
      </View>
    </MockFrame>
  );
}

// ── Présentations ─────────────────────────────────────────────────────────────
function SlidesMock({ on }: { on: boolean }) {
  return (
    <MockFrame on={on} icon="presentation" title="Présentations · Staff du jeudi" description="l’éditeur de présentations : vignettes des diapositives générées, diapositive en cours et export PPTX.">
      <View style={styles.slidesRow}>
        <View style={styles.thumbs}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} {...anim('rise', i)} style={[styles.thumb, i === 1 && styles.thumbActive]}>
              <Line width="70%" step={i} tone={i === 1 ? 'accent' : 'ink'} />
              <Line width="50%" step={i} />
            </View>
          ))}
        </View>
        <View style={styles.slide}>
          <Text {...anim('fade', 4)} style={styles.slideKicker}>DIAPOSITIVE 2 / 6</Text>
          <Text {...anim('rise', 4)} style={styles.slideTitle}>{`Insuffisance cardiaque${NBSP}: le bilan initial`}</Text>
          <View style={styles.slideBody}>
            <View style={styles.slideBullets}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.bulletRow}>
                  <View {...anim('pop', 5 + i)} style={styles.bulletDot} />
                  <View style={styles.flex}><Line width={i === 2 ? '64%' : '92%'} step={5 + i} tone="ink" /></View>
                </View>
              ))}
            </View>
            <View style={styles.chart}>
              {[42, 70, 55, 88].map((h, i) => (
                <View key={i} {...anim('bar', 7 + i)} style={[styles.chartBar, { height: `${h}%` }, i === 3 && styles.chartBarAccent]} />
              ))}
            </View>
          </View>
        </View>
      </View>
      <View style={styles.slidesFoot}>
        <Text style={styles.slidesMeta}>Avec l’IA ou à la main</Text>
        <View {...anim('pop', 12)} style={styles.exportButton}>
          <Icon name="download" size={13} color={tokens.colors.onAccent} />
          <Text style={styles.exportText}>Exporter en PPTX</Text>
        </View>
      </View>
    </MockFrame>
  );
}

// ── Vue d'ensemble / révisions ───────────────────────────────────────────────
const WEEK: [day: string, load: number][] = [['L', 70], ['M', 85], ['M', 60], ['J', 90], ['V', 75], ['S', 45], ['D', 20]];

function OverviewMock({ on }: { on: boolean }) {
  return (
    <MockFrame on={on} icon="calendarCheck" title="Vue d’ensemble · Révisions" description="la vue d’ensemble étudiante : charge prévue, risque du planning, prochain examen et charge de la semaine.">
      <View style={styles.tiles}>
        {[
          ['Charge prévue', '3 h 30'],
          ['Risque planning', 'Faible'],
          ['Prochain examen', 'J-42'],
        ].map(([label, value], i) => (
          <View key={label} {...anim('rise', i)} style={styles.tile}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.tileValue}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.week}>
        {WEEK.map(([day, load], i) => (
          <View key={i} style={styles.weekCol}>
            <View style={styles.weekTrack}>
              <View {...anim('bar', 3 + i)} style={[styles.weekBar, { height: `${load}%` }, i === 3 && styles.weekBarToday]} />
            </View>
            <Text style={[styles.weekDay, i === 3 && styles.weekDayToday]}>{day}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gauge}>
        <Text style={styles.gaugeLabel}>Jauge de risque</Text>
        <View style={styles.gaugeTrack}>
          <View style={[styles.gaugeSeg, { backgroundColor: tokens.colors.success }]} />
          <View style={[styles.gaugeSeg, { backgroundColor: tokens.colors.warningText }]} />
          <View style={[styles.gaugeSeg, { backgroundColor: tokens.colors.danger }]} />
          <View {...anim('rise', 10, ['lx-gauge'])} style={styles.gaugePointer} />
        </View>
      </View>
    </MockFrame>
  );
}

export const SHOWCASE_MOCKS: Record<ShowcaseChapter['id'], (props: { on: boolean }) => JSX.Element> = {
  chat: ChatMock,
  ecos: EcosMock,
  qcm: QcmMock,
  slides: SlidesMock,
  overview: OverviewMock,
};

// ── Réponses par profil (section « Trois assistants ») ───────────────────────
const PERSONA_TINT = {
  public: tokens.colors.personas.public,
  student: tokens.colors.personas.student,
  professional: tokens.colors.personas.pro,
};

export function AnswerMock({ persona, question, on }: { persona: Persona; question: string; on: boolean }) {
  const tint = PERSONA_TINT[persona];
  const label = persona === 'public' ? 'Chat grand public' : persona === 'student' ? 'Chat étudiant' : 'Chat professionnel';
  const icon = persona === 'public' ? 'users' : persona === 'student' ? 'bookOpen' : 'stethoscope';
  return (
    <MockFrame on={on} icon={icon} title={label} description={`la forme d’une réponse du ${label.toLowerCase()}.`}>
      <View {...anim('rise', 0)} style={styles.userBubble}>
        <Text style={styles.userText}>{question}</Text>
      </View>
      {persona === 'public' ? (
        <View style={styles.answer}>
          <Text {...anim('fade', 1)} style={styles.answerHeading}>En bref</Text>
          <Text {...anim('fade', 2)} style={styles.answerText}>
            La tension mesure la pression du sang dans les artères. On parle d’hypertension quand elle reste trop élevée de façon durable, confirmée par plusieurs mesures.
          </Text>
          <Line width="90%" step={3} />
          <Line width="70%" step={4} />
          <View {...anim('rise', 5)} style={[styles.sourceRow, styles.sourceCard]}>
            <SourceBadgePill badge="OFFICIEL" />
            <View style={styles.flex}><Line width="80%" step={5} tone="ink" /></View>
          </View>
        </View>
      ) : persona === 'student' ? (
        <View style={styles.answer}>
          {['Définition', 'Diagnostic', 'Bilan initial'].map((heading, i) => (
            <View key={heading} style={styles.studentBlock}>
              <View style={styles.inlineRow}>
                <Text {...anim('fade', 1 + i * 2)} style={styles.answerHeading}>{heading}</Text>
                <View {...anim('pop', 2 + i * 2)}><Tag label="RANG A" fg={tint.accent} bg={tint.soft} /></View>
              </View>
              <Line width={i === 1 ? '84%' : '94%'} step={1 + i * 2} tone="ink" />
            </View>
          ))}
          <View style={styles.relances}>
            {['[1] Physiopathologie', '[2] Cas clinique', '[3] QCM type EDN'].map((item, i) => (
              <View key={item} {...anim('pop', 7 + i)} style={[styles.relance, { borderColor: tint.accent }]}>
                <Text style={[styles.relanceText, { color: tint.accent }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.answer}>
          <View style={styles.inlineRow}>
            <Text {...anim('fade', 1)} style={styles.answerHeading}>Synthèse des recommandations</Text>
          </View>
          <View style={styles.inlineRow}>
            <View style={styles.flex}><Line width="96%" step={1} tone="ink" /></View>
            <Text {...anim('pop', 2)} style={styles.sup}>¹</Text>
          </View>
          <View style={styles.inlineRow}>
            <View style={styles.flex}><Line width="80%" step={2} tone="ink" /></View>
            <Text {...anim('pop', 3)} style={styles.sup}>² ³</Text>
          </View>
          <View style={styles.sources}>
            {(['GUIDELINE', 'ÉTUDE', 'OFFICIEL'] as const).map((badge, i) => (
              <View key={badge} {...anim('rise', 4 + i)} style={[styles.sourceRow, i > 0 && styles.sourceRowDivided]}>
                <Text style={styles.sourceIndex}>{i + 1}</Text>
                <SourceBadgePill badge={badge} />
                <View style={styles.flex}><Line width={i === 2 ? '66%' : '84%'} step={4 + i} tone="ink" /></View>
              </View>
            ))}
          </View>
        </View>
      )}
    </MockFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    backgroundColor: tokens.colors.accentVivid,
    borderRadius: tokens.radius.xl,
    borderBottomRightRadius: tokens.radius.xs,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  userText: { fontFamily: tokens.font.sans, color: tokens.colors.onAccent, ...tokens.type.caption, fontWeight: tokens.weight.medium },
  stepsPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs + 2,
    borderWidth: tokens.border.thin,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
    backgroundColor: tokens.colors.background,
  },
  stepsText: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.caption, fontWeight: tokens.weight.medium },
  answer: { gap: tokens.space.sm },
  answerHeading: { fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.label, fontWeight: tokens.weight.semibold },
  answerText: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.caption },
  sup: { fontFamily: tokens.font.sans, color: tokens.colors.accent, ...tokens.type.caption, fontWeight: tokens.weight.bold },
  sources: { borderWidth: tokens.border.thin, borderColor: tokens.colors.border, borderRadius: tokens.radius.md, overflow: 'hidden' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm + 1 },
  sourceRowDivided: { borderTopWidth: tokens.border.thin, borderTopColor: tokens.colors.border },
  sourceCard: { borderWidth: tokens.border.thin, borderColor: tokens.colors.border, borderRadius: tokens.radius.md, marginTop: tokens.space.xs },
  sourceIndex: { width: 14, fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption, fontVariant: ['tabular-nums'] },
  studentBlock: { gap: tokens.space.xs + 2 },
  relances: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.xs + 2, marginTop: tokens.space.xs },
  relance: { borderWidth: tokens.border.thin, borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.sm + 2, paddingVertical: 3 },
  relanceText: { fontFamily: tokens.font.sans, ...tokens.type.caption, fontWeight: tokens.weight.semibold },

  ecosHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  ecosTitle: { marginTop: tokens.space.xs, fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.label, fontWeight: tokens.weight.semibold },
  timer: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  timerRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, borderWidth: 4, borderColor: tokens.colors.personas.student.soft },
  dialogue: { gap: tokens.space.xs + 2 },
  bubble: { maxWidth: '82%', borderRadius: tokens.radius.xl, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.xs + 2 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: tokens.colors.personas.student.accent, borderBottomRightRadius: tokens.radius.xs },
  bubblePatient: { alignSelf: 'flex-start', backgroundColor: tokens.colors.surfaceAlt, borderBottomLeftRadius: tokens.radius.xs },
  bubbleText: { fontFamily: tokens.font.sans, color: tokens.colors.text, ...tokens.type.caption },
  bubbleTextMe: { color: tokens.colors.onAccent },
  grid: { gap: tokens.space.xs + 2, paddingTop: tokens.space.md, borderTopWidth: tokens.border.thin, borderTopColor: tokens.colors.border },
  gridHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.sm },
  gridTitle: { fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.caption, fontWeight: tokens.weight.semibold },
  note: { fontFamily: tokens.font.serif, color: tokens.colors.personas.student.accent, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  checkBox: { width: 18, height: 18, borderRadius: tokens.radius.xs, borderWidth: 1.5, borderColor: tokens.colors.borderStrong, overflow: 'hidden' },
  checkFill: { position: 'absolute', top: -1.5, left: -1.5, right: -1.5, bottom: -1.5, borderRadius: tokens.radius.xs, backgroundColor: tokens.colors.success, alignItems: 'center', justifyContent: 'center' },
  checkFillAccent: { backgroundColor: tokens.colors.accentVivid },
  gridText: { flex: 1, fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.caption },

  qcmHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  qcmHint: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption },
  qcmQuestion: { fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.label, fontWeight: tokens.weight.semibold },
  options: { gap: tokens.space.xs + 2 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.sm, paddingVertical: tokens.space.xs },
  optionBox: { width: 18, height: 18, marginTop: 1, borderRadius: tokens.radius.xs, borderWidth: 1.5, borderColor: tokens.colors.borderStrong, overflow: 'hidden' },
  optionText: { flex: 1, fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.caption },
  optionLetter: { fontWeight: tokens.weight.bold, color: tokens.colors.text },
  verdict: { borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.sm, paddingVertical: 1 },
  verdictOk: { backgroundColor: tokens.colors.successBackground },
  verdictNo: { backgroundColor: tokens.colors.dangerBackground },
  verdictText: { fontFamily: tokens.font.sans, ...tokens.type.micro, fontWeight: tokens.weight.bold },
  qcmResult: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: tokens.space.sm, padding: tokens.space.md, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.successBackground },
  qcmResultText: { fontFamily: tokens.font.display, color: tokens.colors.success, ...tokens.type.label, fontWeight: tokens.weight.bold },
  qcmResultHint: { fontFamily: tokens.font.sans, color: tokens.colors.success, ...tokens.type.micro },

  slidesRow: { flexDirection: 'row', gap: tokens.space.md },
  thumbs: { width: 64, gap: tokens.space.sm },
  thumb: { aspectRatio: 16 / 10, borderRadius: tokens.radius.sm, borderWidth: tokens.border.thin, borderColor: tokens.colors.border, padding: 6, gap: 4, backgroundColor: tokens.colors.surface },
  thumbActive: { borderColor: tokens.colors.accent, borderWidth: 2 },
  slide: { flex: 1, minWidth: 0, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.background, borderWidth: tokens.border.thin, borderColor: tokens.colors.border, padding: tokens.space.lg, gap: tokens.space.sm },
  slideKicker: { fontFamily: tokens.font.sans, color: tokens.colors.accent, ...tokens.type.micro, fontWeight: tokens.weight.bold, letterSpacing: tokens.tracking.caps },
  slideTitle: { fontFamily: tokens.font.serif, color: tokens.colors.text, fontSize: 19, lineHeight: 24 },
  slideBody: { flexDirection: 'row', gap: tokens.space.md, alignItems: 'flex-end', marginTop: tokens.space.xs },
  slideBullets: { flex: 1, gap: tokens.space.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.colors.accentVivid },
  chart: { width: 72, height: 64, flexDirection: 'row', alignItems: 'flex-end', gap: 5, borderBottomWidth: tokens.border.thin, borderBottomColor: tokens.colors.borderStrong },
  chartBar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: tokens.colors.accentSurfaceStrong },
  chartBarAccent: { backgroundColor: tokens.colors.accentVivid },
  slidesFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.sm },
  slidesMeta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption },
  exportButton: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs + 2, backgroundColor: tokens.colors.accentVivid, borderRadius: tokens.radius.md, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.xs + 3 },
  exportText: { fontFamily: tokens.font.display, color: tokens.colors.onAccent, ...tokens.type.caption, fontWeight: tokens.weight.semibold },

  tiles: { flexDirection: 'row', gap: tokens.space.sm },
  tile: { flex: 1, minWidth: 0, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.surfaceAlt, paddingHorizontal: tokens.space.sm + 2, paddingVertical: tokens.space.sm },
  tileLabel: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.micro },
  tileValue: { fontFamily: tokens.font.display, color: tokens.colors.text, fontSize: 17, lineHeight: 22, fontWeight: tokens.weight.semibold, fontVariant: ['tabular-nums'] },
  week: { flexDirection: 'row', gap: tokens.space.sm, height: 96, alignItems: 'flex-end' },
  weekCol: { flex: 1, height: '100%', alignItems: 'center', gap: 4 },
  weekTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.background },
  weekBar: { width: '100%', borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.personas.student.soft, borderTopWidth: 3, borderTopColor: tokens.colors.personas.student.accent },
  weekBarToday: { backgroundColor: tokens.colors.personas.student.accent },
  weekDay: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.micro, fontWeight: tokens.weight.semibold },
  weekDayToday: { color: tokens.colors.personas.student.accent },
  gauge: { gap: tokens.space.xs + 2 },
  gaugeLabel: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.micro, fontWeight: tokens.weight.semibold },
  gaugeTrack: { flexDirection: 'row', height: 8, borderRadius: tokens.radius.pill, overflow: 'visible', gap: 3 },
  gaugeSeg: { flex: 1, borderRadius: tokens.radius.pill, opacity: 0.85 },
  gaugePointer: { position: 'absolute', top: -5, left: '18%', width: 4, height: 18, borderRadius: 2, backgroundColor: tokens.colors.text },
});
