import { useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

import type { Persona } from '@/ai/prompts/_schema';
import { APP_FEATURES, type AppFeatureMeta } from '@/ai/routing/featureVisibility';
import { featureTint } from '@/ui/featureChips';
import { Icon } from '@/ui/icons';
import { navLinkProps } from '@/ui/navLink';
import { tokens } from '@/ui/tokens';
import { Touchable } from '@/ui/Touchable';

import { SectionLabel } from './AudienceSwitcher';
import { lx } from './lx';

const COLUMNS: { id: Persona; label: string; short: string; color: string }[] = [
  { id: 'public', label: 'Grand public', short: 'Public', color: tokens.colors.personas.public.accent },
  { id: 'student', label: 'Étudiants', short: 'Étudiants', color: tokens.colors.personas.student.accent },
  { id: 'professional', label: 'Professionnels', short: 'Pros', color: tokens.colors.personas.pro.accent },
];

/**
 * « Qui accède à quoi » (ADR-0047) : sommaire des outils sous forme de tableau outils × profils,
 * dérivé du registre `APP_FEATURES` (la même source que la navigation et RoleGate). Il dit
 * honnêtement ce qui est réservé à qui ; l'autorisation réelle reste serveur.
 *
 * Une ligne est un lien vers l'outil quand il est ouvert au compte courant, ou vers sa
 * présentation publique pour un visiteur ; sinon elle reste informative.
 *
 * @param canUse l'outil est-il ouvert au compte courant ? (`null` : visiteur)
 */
export function AccessMatrix({ canUse }: { canUse: ((feature: AppFeatureMeta) => boolean) | null }) {
  const router = useRouter();
  return (
    <View {...lx('lx-matrix')} style={styles.section}>
      <View {...lx('lx-container')} style={styles.page}>
        <View {...lx('lx-matrix-head')} style={styles.head}>
          <View style={styles.headText}>
            <SectionLabel index="03" label="Qui accède à quoi" />
            <Text accessibilityRole="header" aria-level={2} style={styles.title}>{`${APP_FEATURES.length} outils, ouverts selon votre profil vérifié.`}</Text>
          </View>
          <Text style={styles.intro}>
            Le chat est ouvert à tous. Les autres outils dépendent du rôle vérifié de votre compte : le grand public, les étudiants en santé et les professionnels n’y voient pas les mêmes écrans.
          </Text>
        </View>

        <View style={styles.table}>
          {/* En-têtes visuels : chaque ligne énonce ses profils aux lecteurs d'écran. */}
          <View aria-hidden {...lx(['lx-matrix-cols', 'ge768'])} style={styles.headerRow}>
            <Text style={[styles.colHead, styles.toolCol]}>Outil</Text>
            {COLUMNS.map((c) => (
              <Text key={c.id} style={[styles.colHead, styles.dotCol]}>{c.label}</Text>
            ))}
          </View>
          {APP_FEATURES.map((feature, i) => {
            const open = canUse ? canUse(feature) : true;
            const tint = featureTint(feature.id);
            const audiences = COLUMNS.filter((c) => feature.personas.includes(c.id)).map((c) => c.label).join(', ');
            const content = (
              <>
                <View style={[styles.toolCell, styles.toolCol]}>
                  <View style={[styles.toolIcon, { backgroundColor: tint.bg }]}>
                    <Icon name={feature.icon} size={18} color={tint.fg} />
                  </View>
                  <View style={styles.toolText}>
                    <Text style={styles.toolName}>{feature.label}</Text>
                    <Text style={styles.toolDescription}>{feature.description}</Text>
                    {Platform.OS === 'web' ? (
                      <Text {...lx('lx-sr')} style={styles.srOnly}>{`Profils\u00a0: ${audiences}.${open ? '' : ' Non ouvert à votre compte.'}`}</Text>
                    ) : null}
                    {/* Sous 768 px : les profils en toutes lettres sous la description. */}
                    <View aria-hidden {...lx('lt768')} style={styles.inlineAudiences}>
                      {COLUMNS.filter((c) => feature.personas.includes(c.id)).map((c) => (
                        <View key={c.id} style={styles.inlineAudience}>
                          <View style={[styles.miniDot, { backgroundColor: c.color }]} />
                          <Text style={styles.inlineAudienceText}>{c.short}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                {COLUMNS.map((c) => {
                  const has = feature.personas.includes(c.id);
                  return (
                    <View key={c.id} aria-hidden {...lx('ge768')} style={[styles.dotCell, styles.dotCol]}>
                      <View
                        {...lx('lx-dot', { d: String(i) })}
                        style={[styles.dot, has ? { backgroundColor: c.color, borderColor: c.color } : styles.dotEmpty]}
                      />
                    </View>
                  );
                })}
                <View {...lx('lx-row-arrow')} style={styles.arrow}>
                  {open ? <Icon name="arrowRight" size={16} color={tokens.colors.accent} /> : <Icon name="lock" size={14} color={tokens.colors.textMuted} />}
                </View>
              </>
            );
            return open ? (
              <Touchable
                key={feature.id}
                {...navLinkProps(feature.route, () => router.push(feature.route as never))}
                accessibilityRole="link"
                {...lx('lx-row')}
                style={[styles.row, i === APP_FEATURES.length - 1 && styles.rowLast]}
              >
                {content}
              </Touchable>
            ) : (
              <View key={feature.id} {...lx(['lx-row', 'lx-row-locked'])} style={[styles.row, i === APP_FEATURES.length - 1 && styles.rowLast]}>
                {content}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: tokens.colors.surface, paddingVertical: tokens.space['3xl'] },
  page: { width: '100%', maxWidth: tokens.layout.page, alignSelf: 'center', paddingHorizontal: tokens.space.lg, gap: tokens.space['2xl'] },
  head: { gap: tokens.space.lg },
  headText: { gap: tokens.space.md, flexShrink: 1 },
  title: { fontFamily: tokens.font.serif, color: tokens.colors.text, ...tokens.type.display, fontWeight: tokens.weight.regular, maxWidth: 640 },
  intro: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.bodyLg, maxWidth: 460 },
  table: { borderTopWidth: 2, borderTopColor: tokens.colors.text },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: tokens.space.md, borderBottomWidth: tokens.border.thin, borderBottomColor: tokens.colors.border, paddingRight: 36 },
  colHead: { fontFamily: tokens.font.display, color: tokens.colors.textMuted, ...tokens.type.caption, fontWeight: tokens.weight.semibold },
  toolCol: { flex: 1, minWidth: 0 },
  dotCol: { width: 128, textAlign: 'center', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.space.lg,
    borderBottomWidth: tokens.border.thin,
    borderBottomColor: tokens.colors.border,
    ...tokens.motion.transitionWeb,
  },
  rowLast: { borderBottomWidth: 0 },
  toolCell: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.md },
  toolIcon: { width: 40, height: 40, borderRadius: tokens.radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  toolText: { flex: 1, minWidth: 0, gap: 2 },
  toolName: { fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.h3, fontWeight: tokens.weight.semibold },
  toolDescription: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.body, maxWidth: 560 },
  inlineAudiences: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md, marginTop: tokens.space.xs },
  inlineAudience: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineAudienceText: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.caption, fontWeight: tokens.weight.semibold },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  dotCell: { justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  dotEmpty: { borderColor: tokens.colors.border, backgroundColor: tokens.colors.transparent, width: 8, height: 8 },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  arrow: { width: 36, alignItems: 'flex-end' },
});
