import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

import { SectionLabel } from './AudienceSwitcher';
import { METHOD_STEPS, TRUST_ITEMS } from './copy';
import { lx } from './lx';
import { useInView } from './MockParts';

const NBSP = ' ';

/**
 * « Méthode » (ADR-0047) : bandeau bleu nuit. À gauche, le déroulé des étapes tel que le chat
 * l'affiche pendant une réponse (pas de fonctionnement supposé : chaque étape correspond à un
 * élément réel de `ResearchTimeline`) ; une piste lumineuse relie les étapes et les allume
 * tour à tour. À droite, ce sur quoi repose le produit, et ses limites.
 */
export function MethodSection() {
  const [ref, inView] = useInView<View>();
  return (
    <View {...lx('lx-method')} style={styles.section}>
      <View {...lx('lx-method-grid')} aria-hidden style={styles.grid} />
      <View {...lx('lx-container')} style={styles.page}>
        <View {...lx('lx-method-cols')} style={styles.cols}>
          <View style={styles.left}>
            <SectionLabel index="04" label="Comment répond l’assistant" tone="night" />
            <Text accessibilityRole="header" aria-level={2} style={styles.title}>
              Chaque étape de la réponse{'\n'}
              <Text style={styles.titleAccent}>reste visible.</Text>
            </Text>
            <Text style={styles.body}>
              Pendant la rédaction, le chat affiche son déroulé : la réflexion résumée, les recherches lancées avec leurs requêtes exactes, les sites consultés, puis la rédaction. Le déroulé se replie au-dessus de la réponse dès le premier mot.
            </Text>
            <View
              ref={ref}
              {...lx('lx-timeline', { on: inView ? '1' : '0' })}
              accessibilityRole="image"
              accessibilityLabel="Illustration du déroulé des étapes : analyse de la question, recherches effectuées, domaines consultés, rédaction."
              style={styles.timeline}
            >
              <View {...lx('lx-tl-track')} style={styles.track}>
                <View {...lx('lx-tl-fill')} style={styles.trackFill} />
              </View>
              {METHOD_STEPS.map((step, i) => (
                <View key={step.title} {...lx('lx-tl-step', { s: String(i + 1) })} style={styles.step}>
                  <View {...lx('lx-tl-node')} style={styles.node}>
                    <View style={styles.nodeCore} />
                  </View>
                  <View style={styles.stepText}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDetail}>{step.detail}</Text>
                    {i === 1 ? (
                      <View style={styles.query}>
                        <Icon name="search" size={12} color={tokens.colors.night.mint} />
                        <Text style={styles.queryText} numberOfLines={1}>hypertension artérielle recommandations HAS</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.right}>
            {TRUST_ITEMS.map(([title, text], i) => (
              <View key={title} style={styles.trustRow}>
                <Text style={styles.trustIndex}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={styles.trustText}>
                  <Text accessibilityRole="header" aria-level={3} style={styles.trustTitle}>{title}</Text>
                  <Text style={styles.body}>{text}</Text>
                </View>
              </View>
            ))}
            <View style={styles.limit}>
              <Icon name="shieldCheck" size={18} color={tokens.colors.night.mint} />
              <Text style={styles.limitText}>
                {`Une réponse reste une information générale${NBSP}: vérifiez la date, le contexte et le niveau de preuve des références avant de vous en servir.`}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { position: 'relative', overflow: 'hidden', backgroundColor: tokens.colors.night.base, paddingVertical: tokens.space['3xl'] + tokens.space.lg },
  grid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  page: { width: '100%', maxWidth: tokens.layout.page, alignSelf: 'center', paddingHorizontal: tokens.space.lg },
  cols: { gap: tokens.space['3xl'] },
  left: { gap: tokens.space.lg, flex: 1 },
  right: { gap: tokens.space.xl, flex: 1 },
  title: { fontFamily: tokens.font.serif, color: tokens.colors.night.text, ...tokens.type.display, fontWeight: tokens.weight.regular },
  titleAccent: { fontStyle: 'italic', color: tokens.colors.night.mint },
  body: { fontFamily: tokens.font.sans, color: tokens.colors.night.muted, ...tokens.type.body, maxWidth: tokens.layout.measure },
  timeline: { marginTop: tokens.space.md, gap: tokens.space.lg, paddingLeft: 4 },
  track: { position: 'absolute', left: 14, top: 12, bottom: 18, width: 2, backgroundColor: tokens.colors.night.line, borderRadius: 1, overflow: 'hidden' },
  trackFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tokens.colors.night.mint },
  step: { flexDirection: 'row', gap: tokens.space.md, alignItems: 'flex-start' },
  node: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: tokens.colors.night.mint, backgroundColor: tokens.colors.night.base, alignItems: 'center', justifyContent: 'center' },
  nodeCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colors.night.mint },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { fontFamily: tokens.font.display, color: tokens.colors.night.text, ...tokens.type.label, fontWeight: tokens.weight.semibold },
  stepDetail: { fontFamily: tokens.font.sans, color: tokens.colors.night.muted, ...tokens.type.caption },
  query: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', marginTop: tokens.space.xs, borderRadius: tokens.radius.sm, borderWidth: tokens.border.thin, borderColor: tokens.colors.night.line, backgroundColor: tokens.colors.night.deep, paddingHorizontal: tokens.space.sm, paddingVertical: 3 },
  queryText: { flexShrink: 1, fontFamily: tokens.font.mono, color: tokens.colors.night.text, fontSize: 12, lineHeight: 18 },
  trustRow: { flexDirection: 'row', gap: tokens.space.lg, paddingTop: tokens.space.lg, borderTopWidth: tokens.border.thin, borderTopColor: tokens.colors.night.line },
  trustIndex: { fontFamily: tokens.font.serif, fontStyle: 'italic', color: tokens.colors.night.mint, fontSize: 22, lineHeight: 28, minWidth: 28 },
  trustText: { flex: 1, gap: tokens.space.xs },
  trustTitle: { fontFamily: tokens.font.display, color: tokens.colors.night.text, ...tokens.type.h3, fontWeight: tokens.weight.semibold },
  limit: { flexDirection: 'row', gap: tokens.space.md, alignItems: 'flex-start', padding: tokens.space.lg, borderRadius: tokens.radius.xl, backgroundColor: tokens.colors.night.raised },
  limitText: { flex: 1, fontFamily: tokens.font.sans, color: tokens.colors.night.text, ...tokens.type.label },
});
