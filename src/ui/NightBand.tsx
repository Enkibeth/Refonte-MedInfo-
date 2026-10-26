import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { EcgTrace } from './EcgTrace';
import { Icon, type IconName } from './icons';
import { lx } from './landing/lx';
import { tokens } from './tokens';

/**
 * Bandeau « Moniteur » commun (ADR-0047) : premier écran des pages publiques, légales, de
 * compte et des outils. Bleu nuit, papier millimétré d'ECG et halo localisé (CSS `ax-night`,
 * src/ui/appMotion.ts, présent dès le pré-rendu), repère menthe, titre serif clair.
 *
 * Même hiérarchie partout : repère (icône + libellé), titre de niveau `level` (1 par défaut :
 * UN seul H1 par écran), chapeau, puis `children` (actions, métadonnées). `trace` ajoute le
 * tracé ECG lumineux en pied de bandeau (pages de présentation ; jamais sur un outil, dont
 * l'en-tête doit rester compact).
 *
 * Natif : fond bleu nuit plein, sans papier millimétré ni tracé.
 */
export function NightBand({
  kicker,
  icon,
  title,
  lead,
  children,
  level = 1,
  maxWidth = tokens.layout.page,
  compact = false,
  trace = false,
  aside,
  before,
  style,
}: {
  kicker?: string;
  icon?: IconName;
  title: string;
  lead?: string;
  children?: ReactNode;
  level?: 1 | 2;
  /** Largeur de la colonne de contenu (alignée sur celle de la page sous le bandeau). */
  maxWidth?: number;
  /** En-tête d'outil : marges et titre réduits. */
  compact?: boolean;
  trace?: boolean;
  /** Action posée en haut à droite (menu « Outils » d'un outil). */
  aside?: ReactNode;
  /** Élément posé au-dessus du repère (logo en pastille claire sur les écrans sans en-tête de site). */
  before?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View {...lx('ax-night')} style={[styles.band, style]}>
      <View style={[styles.inner, { maxWidth }, compact && styles.innerCompact]}>
        {before}
        {kicker || icon || aside ? (
          <View style={styles.top}>
            <View style={styles.kicker}>
              {icon ? (
                <View style={[styles.iconChip, compact && styles.iconChipCompact]}>
                  <Icon name={icon} size={compact ? 16 : 18} color={tokens.colors.night.mint} />
                </View>
              ) : (
                <View style={styles.rule} />
              )}
              {kicker ? <Text style={styles.kickerText}>{kicker}</Text> : null}
            </View>
            {aside}
          </View>
        ) : null}
        <Text accessibilityRole="header" aria-level={level} style={[styles.title, compact && styles.titleCompact]}>
          {title}
        </Text>
        {lead ? <Text style={[styles.lead, compact && styles.leadCompact]}>{lead}</Text> : null}
        {children}
      </View>
      {trace ? (
        <View style={styles.trace}>
          <EcgTrace height={44} tone="night" />
        </View>
      ) : null}
    </View>
  );
}

const night = tokens.colors.night;

const styles = StyleSheet.create({
  band: { position: 'relative', width: '100%', backgroundColor: night.base, overflow: 'hidden' },
  inner: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['3xl'],
    paddingBottom: tokens.space['3xl'],
    gap: tokens.space.md,
  },
  innerCompact: { paddingTop: tokens.space.lg, paddingBottom: tokens.space.lg, gap: tokens.space.xs + 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, flexShrink: 1 },
  rule: { width: 24, height: 2, backgroundColor: night.mint },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: night.raised,
    borderWidth: tokens.border.thin,
    borderColor: night.line,
  },
  iconChipCompact: { width: 30, height: 30, borderRadius: tokens.radius.sm },
  kickerText: { fontFamily: tokens.font.display, color: night.muted, ...tokens.type.label, fontWeight: tokens.weight.semibold },
  title: { fontFamily: tokens.font.serif, color: night.text, ...tokens.type.display, fontWeight: tokens.weight.regular },
  titleCompact: { ...tokens.type.h1 },
  lead: { fontFamily: tokens.font.sans, color: night.muted, ...tokens.type.bodyLg, maxWidth: tokens.layout.measure + 80 },
  leadCompact: { ...tokens.type.label, maxWidth: tokens.layout.measure + 120 },
  trace: { width: '100%', marginTop: -tokens.space.lg },
});
