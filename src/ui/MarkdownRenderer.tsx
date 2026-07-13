/**
 * Lightweight markdown renderer for AI chat responses.
 * Handles: ##/### headings, **bold**, tables (|col|), - lists, --- hr,
 * et liens markdown → notes de bas de page numérotées cliquables.
 * No external dependency — uses React Native primitives + design tokens.
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Linking, Image } from 'react-native';
import { tokens } from './tokens';

// ── Types ────────────────────────────────────────────────────────────────────

type TableRow = { cells: string[]; isHeader: boolean };

type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'hr' }
  | { kind: 'listItem'; text: string; ordered: boolean; index: number }
  | { kind: 'table'; rows: TableRow[] }
  | { kind: 'image'; url: string; caption: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'spacer' };

// ── Inline parser + notes de bas de page cliquables ───────────────────────────
// Les liens markdown `[label](url)` (souvent de longues URL brutes en fin de phrase)
// sont remplacés par un petit exposant numéroté ¹ ² cliquable qui ouvre la source.
// On supprime ainsi les URL disgracieuses ET le débordement horizontal qu'elles
// provoquaient. Numérotation par ordre d'apparition, URL identiques regroupées, via
// un registre partagé entre tous les blocs d'un même message.

type FootnoteRegistry = { urls: string[] };

function footnoteNumber(url: string, reg: FootnoteRegistry): number {
  let idx = reg.urls.indexOf(url);
  if (idx < 0) {
    reg.urls.push(url);
    idx = reg.urls.length - 1;
  }
  return idx + 1;
}

// bold | code | lien markdown (parenthèses englobantes éventuelles absorbées) | exposant de citation (¹ ²…).
const INLINE_RE =
  /(\*\*[^*]+\*\*|`[^`]+`|\(?\s*\[[^\]]+\]\(https?:\/\/[^\s)]+\)\s*\)?|[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g;
const LINK_URL_RE = /\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/;
const SUPERSCRIPT_SEG_RE = /^[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/;

function parseInline(
  text: string,
  base: object,
  reg: FootnoteRegistry,
  key?: string,
  onCitationPress?: (superscript: string) => void,
): React.ReactNode {
  return (
    <Text key={key} style={base}>
      {text.split(INLINE_RE).map((seg, i) => {
        if (!seg) return null;
        if (seg.startsWith('**') && seg.endsWith('**')) {
          return (
            <Text key={i} style={inlineStyles.bold}>
              {seg.slice(2, -2)}
            </Text>
          );
        }
        if (seg.startsWith('`') && seg.endsWith('`')) {
          return (
            <Text key={i} style={inlineStyles.code}>
              {seg.slice(1, -1)}
            </Text>
          );
        }
        const link = seg.match(LINK_URL_RE);
        if (link) {
          const url = link[1];
          const num = footnoteNumber(url, reg);
          return (
            <Text
              key={i}
              style={inlineStyles.footnote}
              onPress={() => {
                Linking.openURL(url).catch(() => {});
              }}
              accessibilityRole="link"
              accessibilityLabel={`Source ${num}`}
            >
              {num}
            </Text>
          );
        }
        if (onCitationPress && SUPERSCRIPT_SEG_RE.test(seg)) {
          return (
            <Text
              key={i}
              style={inlineStyles.footnote}
              onPress={() => onCitationPress(seg)}
              accessibilityRole="link"
              accessibilityLabel={`Voir la source ${seg}`}
            >
              {seg}
            </Text>
          );
        }
        return seg;
      })}
    </Text>
  );
}

// ── Block parser ─────────────────────────────────────────────────────────────

const TABLE_ROW_RE = /^\|(.+)\|$/;
const TABLE_SEP_RE = /^\|[\s\-:|]+\|$/;

function parseTableRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // H3 before H2 (### has 3 chars, ## has 2)
    if (trimmed.startsWith('### ')) {
      blocks.push({ kind: 'h3', text: trimmed.slice(4) });
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: trimmed.slice(3) });
      i++;
      continue;
    }

    // Image seule sur sa ligne : ![légende](https://…) (articles de blog)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (imageMatch) {
      blocks.push({ kind: 'image', url: imageMatch[2], caption: imageMatch[1] });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      blocks.push({ kind: 'listItem', text: line.slice(2).trim(), ordered: false, index: 0 });
      i++;
      continue;
    }

    // Ordered list — le numéro AFFICHÉ est celui écrit dans le texte : les lignes
    // vides entre items (fréquentes dans les réponses LLM) ne remettent plus la
    // numérotation à « 1. » à chaque item.
    const orderedMatch = line.match(/^(\d+)\.\s(.+)/);
    if (orderedMatch) {
      blocks.push({
        kind: 'listItem',
        text: orderedMatch[2].trim(),
        ordered: true,
        index: Number(orderedMatch[1]),
      });
      i++;
      continue;
    }

    // Table (collect all consecutive table lines)
    if (TABLE_ROW_RE.test(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && TABLE_ROW_RE.test(lines[i].trim())) {
        // Trim : une ligne de tableau indentée créerait une cellule parasite vide
        // (slice(1, -1) sur la ligne brute) et décalerait toutes les colonnes.
        tableLines.push(lines[i].trim());
        i++;
      }
      // Find separator index to identify header
      const sepIdx = tableLines.findIndex((l) => TABLE_SEP_RE.test(l));
      const rows: TableRow[] = tableLines
        .filter((l) => !TABLE_SEP_RE.test(l))
        .map((l, idx) => ({
          cells: parseTableRow(l),
          isHeader: sepIdx > 0 && idx === 0,
        }));
      if (rows.length > 0) blocks.push({ kind: 'table', rows });
      continue;
    }

    // Empty line
    if (trimmed === '') {
      // Collapse multiple blank lines
      if (blocks.length > 0 && blocks[blocks.length - 1].kind !== 'spacer') {
        blocks.push({ kind: 'spacer' });
      }
      i++;
      continue;
    }

    // Paragraph
    blocks.push({ kind: 'paragraph', text: line });
    i++;
  }

  return blocks;
}

// ── Table component ──────────────────────────────────────────────────────────
// Chaque ligne est une flex-row indépendante : sans largeur de colonne partagée,
// les cellules se dimensionnent selon leur propre contenu et les colonnes se
// décalent d'une ligne à l'autre. On calcule donc une largeur par colonne
// (estimée sur le contenu, bornée pour forcer le retour à la ligne des cellules
// longues) appliquée en flexBasis identique sur toutes les lignes ; flexGrow
// proportionnel pour qu'un petit tableau occupe toute la largeur de la bulle.

const CELL_FONT_CHAR_W = 7.4; // largeur moyenne d'un caractère (label 14px)
const CELL_MIN_W = 84;
const CELL_MAX_W = 220; // au-delà, le texte wrappe dans la cellule

function columnWidths(rows: TableRow[], colCount: number): number[] {
  const pad = tokens.space.md * 2;
  return Array.from({ length: colCount }, (_, ci) => {
    let longest = 0;
    for (const row of rows) {
      const raw = (row.cells[ci] ?? '').replace(/\*\*|`/g, '').trim();
      longest = Math.max(longest, raw.length);
    }
    const ideal = Math.ceil(longest * CELL_FONT_CHAR_W) + pad;
    return Math.min(CELL_MAX_W, Math.max(CELL_MIN_W, ideal));
  });
}

function TableBlock({
  rows,
  footnotes,
  onCitationPress,
}: {
  rows: TableRow[];
  footnotes: FootnoteRegistry;
  onCitationPress?: (superscript: string) => void;
}) {
  if (rows.length === 0) return null;
  const colCount = Math.max(...rows.map((r) => r.cells.length));
  const widths = columnWidths(rows, colCount);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={Platform.OS === 'web'}
      style={tableStyles.scroll}
      contentContainerStyle={tableStyles.scrollContent}
    >
      <View style={tableStyles.table}>
        {rows.map((row, ri) => (
          <View
            key={ri}
            style={[
              tableStyles.row,
              row.isHeader && tableStyles.headerRow,
              ri > 0 && !row.isHeader && ri % 2 === 0 && tableStyles.evenRow,
              ri < rows.length - 1 && tableStyles.rowBorder,
            ]}
          >
            {Array.from({ length: colCount }).map((_, ci) => (
              <View
                key={ci}
                style={[
                  tableStyles.cell,
                  { flexBasis: widths[ci], flexGrow: widths[ci] },
                  ci < colCount - 1 && tableStyles.cellBorder,
                ]}
              >
                {parseInline(
                  row.cells[ci] ?? '',
                  row.isHeader ? tableStyles.headerText : tableStyles.cellText,
                  footnotes,
                  undefined,
                  onCitationPress,
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MarkdownRenderer({
  text,
  onDark = false,
  onCitationPress,
}: {
  text: string;
  onDark?: boolean;
  /** Reçoit l'exposant affiché (ex. "¹") d'une référence inline cliquée — ouvre la source associée. */
  onCitationPress?: (superscript: string) => void;
}) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  const textColor = onDark ? tokens.colors.onAccent : tokens.colors.text;
  const mutedColor = onDark ? 'rgba(255,255,255,0.75)' : tokens.colors.textMuted;

  // Registre de notes reconstruit à chaque rendu : la numérotation suit l'ordre
  // d'apparition des liens, cohérente entre tous les blocs du message.
  const footnotes: FootnoteRegistry = { urls: [] };

  return (
    <View style={mdStyles.container}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'h2':
            return parseInline(
              block.text,
              { ...mdStyles.h2, color: textColor },
              footnotes,
              String(i),
              onCitationPress,
            );

          case 'h3':
            return parseInline(
              block.text,
              { ...mdStyles.h3, color: textColor },
              footnotes,
              String(i),
              onCitationPress,
            );

          case 'hr':
            return (
              <View
                key={i}
                style={[
                  mdStyles.hr,
                  { backgroundColor: onDark ? 'rgba(255,255,255,0.2)' : tokens.colors.border },
                ]}
              />
            );

          case 'listItem':
            return (
              <View key={i} style={mdStyles.listRow}>
                <Text style={[mdStyles.bullet, { color: mutedColor }]}>
                  {block.ordered ? `${block.index}.` : '•'}
                </Text>
                {parseInline(
                  block.text,
                  { ...mdStyles.listText, color: textColor },
                  footnotes,
                  undefined,
                  onCitationPress,
                )}
              </View>
            );

          case 'table':
            return (
              <TableBlock
                key={i}
                rows={block.rows}
                footnotes={footnotes}
                onCitationPress={onCitationPress}
              />
            );

          case 'image':
            return (
              <View key={i} style={mdStyles.figure}>
                <Image
                  source={{ uri: block.url }}
                  style={mdStyles.figureImage}
                  resizeMode="cover"
                  accessibilityLabel={block.caption || 'Illustration'}
                />
                {block.caption ? (
                  <Text style={[mdStyles.figureCaption, { color: mutedColor }]}>{block.caption}</Text>
                ) : null}
              </View>
            );

          case 'paragraph':
            return parseInline(
              block.text,
              { ...mdStyles.paragraph, color: textColor },
              footnotes,
              String(i),
              onCitationPress,
            );

          case 'spacer':
            return <View key={i} style={mdStyles.spacer} />;
        }
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const mdStyles = StyleSheet.create({
  container: { gap: 2 },
  h2: {
    fontFamily: tokens.font.display,
    fontSize: tokens.type.h3.fontSize,
    lineHeight: tokens.type.h3.lineHeight,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginTop: 4,
    marginBottom: 2,
  },
  h3: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize + 1,
    lineHeight: 22,
    fontWeight: tokens.weight.semibold,
    marginTop: 2,
  },
  hr: { height: 1, marginVertical: 6 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 2 },
  bullet: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    width: 14,
  },
  listText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  paragraph: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  spacer: { height: 6 },
  figure: { marginVertical: tokens.space.sm, gap: 4 },
  figureImage: {
    width: '100%',
    height: 240,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  figureCaption: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.caption.fontSize,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

const inlineStyles = StyleSheet.create({
  bold: { fontWeight: tokens.weight.bold },
  code: {
    fontFamily: tokens.font.mono,
    fontSize: tokens.type.caption.fontSize,
    backgroundColor: tokens.colors.surfaceSunken,
    borderRadius: 3,
    paddingHorizontal: 3,
  },
  // Exposant de source : petit numéro accent cliquable (style « ¹ ² »).
  footnote: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.bold,
    color: tokens.colors.accent,
    ...Platform.select({ web: { verticalAlign: 'super' } as object, default: {} }),
  },
});

const tableStyles = StyleSheet.create({
  scroll: { marginVertical: tokens.space.sm },
  // flexGrow : un tableau plus étroit que la bulle s'étire sur toute sa largeur
  // (les flexGrow des cellules répartissent l'espace en respectant l'alignement).
  scrollContent: { flexGrow: 1 },
  table: {
    flexGrow: 1,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(15,27,34,0.06)' }, default: {} }),
  },
  row: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surface,
  },
  headerRow: {
    backgroundColor: tokens.colors.accent,
  },
  evenRow: {
    backgroundColor: tokens.colors.surfaceAlt,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  cell: {
    flexShrink: 0,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm + 2,
    justifyContent: 'center',
  },
  cellBorder: {
    borderRightWidth: 1,
    borderRightColor: tokens.colors.border,
  },
  cellText: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    color: tokens.colors.text,
    lineHeight: 20,
  },
  headerText: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    color: tokens.colors.onAccent,
    lineHeight: 20,
  },
});
