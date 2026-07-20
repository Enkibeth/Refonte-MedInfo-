/**
 * Rendu d'un diagramme du chat (2026-07) — flux vertical de boîtes reliées.
 *
 * Cross-platform (web + iOS + Android), ZÉRO dépendance : on rend la structure
 * validée par src/ai/chat/diagram.ts avec des primitives React Native + tokens.
 * Types couverts : suite d'étapes (start/step/end) avec nœuds de DÉCISION dont les
 * branches s'affichent en puces étiquetées — assez pour les algorithmes de prise en
 * charge et arbres décisionnels sans moteur de graphe.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { DiagramNode, DiagramSpec } from '@/ai/chat/diagram';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

function nodeCardStyle(kind: DiagramNode['kind']) {
  switch (kind) {
    case 'start':
      return styles.nodeStart;
    case 'end':
      return styles.nodeEnd;
    case 'decision':
      return styles.nodeDecision;
    default:
      return styles.nodeStep;
  }
}

export function DiagramView({ spec }: { spec: DiagramSpec }) {
  return (
    <View
      style={styles.container}
      accessibilityRole="image"
      accessibilityLabel={`Diagramme${spec.title ? ` : ${spec.title}` : ''}`}
    >
      {spec.title ? <Text style={styles.title}>{spec.title}</Text> : null}
      {spec.nodes.map((node, i) => (
        <View key={i} style={styles.nodeBlock}>
          {i > 0 ? (
            <View style={styles.connector}>
              <View style={styles.connectorLine} />
              {/* Flèche « vers le bas » : arrowUp pivoté (pas d'arrowDown au catalogue). */}
              <View style={styles.connectorArrow}>
                <Icon name="arrowUp" size={12} color={tokens.colors.borderStrong} />
              </View>
            </View>
          ) : null}
          <View style={[styles.node, nodeCardStyle(node.kind)]}>
            <Text style={styles.nodeText}>{node.text}</Text>
          </View>
          {node.branches && node.branches.length > 0 ? (
            <View style={styles.branches}>
              {node.branches.map((branch, bi) => (
                <View key={bi} style={styles.branch}>
                  {branch.label ? (
                    <View style={styles.branchLabel}>
                      <Text style={styles.branchLabelText}>{branch.label}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.branchText}>{branch.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: tokens.space.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceAlt,
    padding: tokens.space.lg,
    gap: 0,
    alignItems: 'stretch',
  },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.sm,
    textAlign: 'center',
  },
  nodeBlock: { alignItems: 'stretch' },
  connector: { alignItems: 'center', height: 18, justifyContent: 'center' },
  connectorLine: {
    position: 'absolute',
    width: 2,
    height: 18,
    backgroundColor: tokens.colors.borderStrong,
  },
  connectorArrow: { transform: [{ rotate: '180deg' }] },
  node: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  nodeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
    textAlign: 'center',
    fontWeight: tokens.weight.medium,
  },
  nodeStart: {
    backgroundColor: tokens.colors.accent,
    borderColor: tokens.colors.accent,
  },
  nodeStep: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
  },
  nodeDecision: {
    backgroundColor: tokens.colors.accentSurface,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  nodeEnd: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.borderStrong,
  },
  branches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
    marginTop: tokens.space.sm,
    justifyContent: 'center',
  },
  branch: {
    flexGrow: 1,
    flexBasis: 130,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    gap: 4,
  },
  branchLabel: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 1,
  },
  branchLabelText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  branchText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
  },
});
