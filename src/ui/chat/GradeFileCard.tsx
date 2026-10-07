/**
 * Carte du composeur : fichier (ou texte collé) de notes repéré avant l'envoi (ADR-0044).
 *
 * Un relevé de promotion contient les notes d'autres étudiants : il n'est pas joint au
 * message. La carte explique pourquoi et propose l'outil Partiels, qui fait le calcul sur
 * l'appareil, sans IA (ADR-0035). Seul le PDF repéré à son NOM (contenu non vérifiable ici)
 * peut être joint quand même, sur choix explicite.
 */
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { Touchable } from '@/ui/Touchable';

export type GradeCardKind = 'grade-table' | 'spreadsheet' | 'grade-pdf-name' | 'pasted';

const NBSP = ' ';
const NNBSP = ' ';

function quoted(name: string | null): string {
  return name ? `«${NBSP}${name}${NBSP}»` : 'Ce fichier';
}

function rowsLabel(rows: number | null): string {
  return rows ? ` (${rows}${NBSP}lignes)` : '';
}

/** Texte de la carte selon le cas (exporté pour les tests de rédaction). */
export function gradeCardMessage(kind: GradeCardKind, name: string | null, rows: number | null, canUsePartiel: boolean): string {
  switch (kind) {
    case 'grade-table':
      return canUsePartiel
        ? `${quoted(name)}${rowsLabel(rows)} n’est pas envoyé à l’IA${NBSP}: il contient les notes d’autres étudiants. L’outil Partiels l’analyse sur ton appareil, sans IA.`
        : `${quoted(name)} ressemble à un relevé de notes${NBSP}: il n’est pas envoyé à l’IA, car il contient les notes d’autres personnes. Collez seulement les informations utiles dans votre message.`;
    case 'spreadsheet':
      return `Le chat ne lit pas les tableurs. Si ${quoted(name)} contient des résultats de partiels, l’outil Partiels l’analyse sur ton appareil, sans IA.`;
    case 'grade-pdf-name':
      return `${quoted(name)} ressemble à des résultats de partiels. Joint au chat, il serait envoyé à l’IA avec les notes des autres étudiants${NNBSP}; l’outil Partiels l’analyse sur ton appareil.`;
    case 'pasted':
      return `Ce texte ressemble à un relevé de notes${rowsLabel(rows)}. Envoyé, il partirait à l’IA avec les notes de tes camarades${NNBSP}: l’outil Partiels l’analyse sur ton appareil.`;
  }
}

export function GradeFileCard({
  kind,
  name,
  rows,
  canUsePartiel,
  onOpenPartiel,
  onAttachAnyway,
  onDismiss,
}: {
  kind: GradeCardKind;
  name: string | null;
  rows: number | null;
  canUsePartiel: boolean;
  onOpenPartiel: () => void;
  /** PDF repéré à son nom seulement : l'utilisateur peut le joindre quand même. */
  onAttachAnyway?: () => void;
  onDismiss: () => void;
}) {
  const webTitle = (label: string) => (Platform.OS === 'web' ? { title: label } : {});
  return (
    <View style={styles.card} testID="grade-file-card">
      <View style={styles.top}>
        <Icon name="barChart" size={15} color={tokens.colors.accentDeep} />
        <Text style={styles.text}>{gradeCardMessage(kind, name, rows, canUsePartiel)}</Text>
        <Touchable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          {...webTitle('Fermer')}
          style={styles.close}
        >
          <Icon name="x" size={13} color={tokens.colors.textMuted} />
        </Touchable>
      </View>
      {canUsePartiel ? (
        <View style={styles.actions}>
          <Touchable
            onPress={onOpenPartiel}
            accessibilityRole="button"
            accessibilityLabel="Analyser dans l’outil Partiels"
            {...webTitle('Analyser dans l’outil Partiels')}
            style={styles.primary}
            feedback="light"
          >
            <Text style={styles.primaryText}>Analyser dans Partiels</Text>
          </Touchable>
          {onAttachAnyway ? (
            <Touchable
              onPress={onAttachAnyway}
              accessibilityRole="button"
              accessibilityLabel="Joindre quand même au chat"
              {...webTitle('Joindre quand même au chat')}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Joindre quand même</Text>
            </Touchable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.sm },
  text: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
  },
  close: {
    width: 26,
    height: 26,
    marginTop: -4,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm, paddingLeft: 23 },
  primary: {
    minHeight: tokens.size.controlMd,
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accentVivid,
    paddingHorizontal: tokens.space.md,
    ...tokens.motion.transitionWeb,
  },
  primaryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  secondary: {
    minHeight: tokens.size.controlMd,
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    ...tokens.motion.transitionWeb,
  },
  secondaryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});
