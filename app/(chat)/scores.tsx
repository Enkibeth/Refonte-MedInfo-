/**
 * Scores médicaux — calculateurs cliniques interactifs (persona étudiant + pro).
 *
 * 100 % CÔTÉ CLIENT, sans IA ni réseau (comme l'analyseur de partiels) : le moteur
 * déterministe `@/scores` calcule la valeur ET son interprétation. Recherche double :
 * par NOM (CHA₂DS₂-VASc) ou par FONCTION quand on a oublié le nom (« risque
 * hémorragie anticoagulant » → HAS-BLED). Aide à la décision, jamais un diagnostic.
 */
import { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';

import { Icon, type IconName } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { PAGE_SEO, breadcrumbJsonLd, webApplicationJsonLd } from '@/seo/meta';
import { SeoHead } from '@/ui/SeoHead';
import { RoleGate } from '@/ui/RoleGate';
import { ToolsMenu } from '@/ui/ToolsMenu';
import {
  ALL_SCORES,
  CATEGORIES,
  categoryMeta,
  getScore,
  searchScores,
  type RiskLevel,
  type ScoreCategory,
  type ScoreDefinition,
} from '@/scores';

// Couleurs par niveau de gravité de l'interprétation (design system tokens).
const LEVEL_COLORS: Record<RiskLevel, { fg: string; bg: string; solid?: boolean }> = {
  info: { fg: tokens.colors.textSubtle, bg: tokens.colors.surfaceSunken },
  low: { fg: tokens.colors.success, bg: tokens.colors.successBackground },
  moderate: { fg: tokens.colors.warningText, bg: tokens.colors.warningBackground },
  high: { fg: tokens.colors.danger, bg: tokens.colors.dangerBackground },
  critical: { fg: tokens.colors.onAccent, bg: tokens.colors.danger, solid: true },
};

function parseNum(s: string | undefined): number {
  if (s == null) return NaN;
  const t = s.trim().replace(',', '.');
  if (t === '') return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// ── Écran ────────────────────────────────────────────────────────────────────

export default function ScoresScreen() {
  return (
    <>
      <SeoHead
        title={PAGE_SEO.scores.title}
        description={PAGE_SEO.scores.description}
        path={PAGE_SEO.scores.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Scores médicaux', path: PAGE_SEO.scores.path },
          ]),
          webApplicationJsonLd({
            name: 'Scores médicaux — MedInfo AI',
            description: PAGE_SEO.scores.description,
            path: PAGE_SEO.scores.path,
          }),
        ]}
      />
      <RoleGate feature="scores">
        <ScoresInner />
      </RoleGate>
    </>
  );
}

function ScoresInner() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? getScore(selectedId) : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ToolsMenu />
        </View>
        <Text style={styles.title}>Scores médicaux</Text>
        <Text style={styles.subtitle}>
          {ALL_SCORES.length} scores et calculateurs cliniques — boutons interactifs et
          interprétation immédiate. Calcul privé, sur ton appareil.
        </Text>
      </View>

      {selected ? (
        <ScoreDetail key={selected.id} def={selected} onBack={() => setSelectedId(null)} />
      ) : (
        <ScoreBrowser onSelect={setSelectedId} />
      )}
    </View>
  );
}

// ── Navigation / recherche ─────────────────────────────────────────────────────

function ScoreBrowser({ onSelect }: { onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ScoreCategory | 'all'>('all');

  const results = useMemo(
    () => searchScores(query, category === 'all' ? {} : { category }),
    [query, category],
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {/* Barre de recherche double (nom OU fonction) */}
      <View style={styles.searchBox}>
        <Icon name="search" size={18} color={tokens.colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Nom (CHA₂DS₂-VASc) ou fonction (risque hémorragie…)"
          placeholderTextColor={tokens.colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} accessibilityLabel="Effacer la recherche" hitSlop={8}>
            <Icon name="x" size={16} color={tokens.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.searchHint}>
        Nom oublié ? Décris ce que le score évalue (ex. « probabilité embolie pulmonaire »,
        « clairance rénale »).
      </Text>

      {/* Chips de catégories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
        <CategoryChip label="Tous" active={category === 'all'} onPress={() => setCategory('all')} />
        {CATEGORIES.map((c) => (
          <CategoryChip
            key={c.id}
            label={c.label}
            icon={c.icon as IconName}
            active={category === c.id}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </ScrollView>

      {/* Résultats */}
      {results.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="search" size={26} color={tokens.colors.textMuted} />
          <Text style={styles.emptyText}>Aucun score trouvé pour « {query} ».</Text>
          <Text style={styles.emptySub}>Essaie un autre mot-clé, un synonyme, ou l’indication clinique.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.resultCount}>
            {results.length} score{results.length > 1 ? 's' : ''}
          </Text>
          {results.map((s) => (
            <ScoreCard key={s.id} def={s} onPress={() => onSelect(s.id)} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function CategoryChip({ label, icon, active, onPress }: { label: string; icon?: IconName; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityRole="button">
      {icon ? <Icon name={icon} size={14} color={active ? tokens.colors.onAccent : tokens.colors.accentDeep} /> : null}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function ScoreCard({ def, onPress }: { def: ScoreDefinition; onPress: () => void }) {
  const cat = categoryMeta(def.category);
  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button">
      <View style={styles.cardIcon}>
        <Icon name={cat.icon as IconName} size={18} color={tokens.colors.accentDeep} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardAcronym}>{def.acronym ?? def.name}</Text>
        {def.acronym ? <Text style={styles.cardName}>{def.name}</Text> : null}
        <Text style={styles.cardPurpose} numberOfLines={2}>
          {def.purpose}
        </Text>
      </View>
      <Icon name="arrowRight" size={16} color={tokens.colors.textMuted} />
    </Pressable>
  );
}

// ── Détail / calcul ─────────────────────────────────────────────────────────

function ScoreDetail({ def, onBack }: { def: ScoreDefinition; onBack: () => void }) {
  const initial = useMemo(() => initState(def), [def]);
  const [choiceIdx, setChoiceIdx] = useState<Record<string, number>>(initial.choiceIdx);
  const [numInputs, setNumInputs] = useState<Record<string, string>>(initial.numInputs);

  const values = useMemo(() => {
    const v: Record<string, number> = {};
    for (const f of def.fields) {
      if (f.kind === 'choice') v[f.id] = f.options[choiceIdx[f.id] ?? 0]?.value ?? 0;
      else v[f.id] = parseNum(numInputs[f.id]);
    }
    return v;
  }, [def, choiceIdx, numInputs]);

  const result = useMemo(() => def.compute(values), [def, values]);
  const color = LEVEL_COLORS[result.interpretation.level];

  const reset = () => {
    const s = initState(def);
    setChoiceIdx(s.choiceIdx);
    setNumInputs(s.numInputs);
  };

  const cat = categoryMeta(def.category);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button">
        <Icon name="arrowLeft" size={16} color={tokens.colors.accentDeep} />
        <Text style={styles.backLabel}>Tous les scores</Text>
      </Pressable>

      <View style={styles.detailHead}>
        <View style={styles.detailChip}>
          <Icon name={cat.icon as IconName} size={13} color={tokens.colors.accentDeep} />
          <Text style={styles.detailChipLabel}>{cat.label}</Text>
        </View>
        <Text style={styles.detailAcronym}>{def.acronym ?? def.name}</Text>
        {def.acronym ? <Text style={styles.detailName}>{def.name}</Text> : null}
        <Text style={styles.detailPurpose}>{def.purpose}</Text>
      </View>

      {/* Carte résultat (sticky visuellement en tête du calcul) */}
      <View style={[styles.resultCard, color.solid && { backgroundColor: color.bg, borderColor: color.bg }]}>
        <View style={styles.resultRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.resultLabelSmall, color.solid && { color: color.fg }]}>Résultat</Text>
            <Text style={[styles.resultValue, color.solid && { color: color.fg }]}>{result.display}</Text>
          </View>
          {!result.incomplete ? (
            <View style={[styles.badge, { backgroundColor: color.solid ? 'rgba(255,255,255,0.2)' : color.bg }]}>
              <Text style={[styles.badgeText, { color: color.fg }]}>{result.interpretation.label}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.resultDetail, color.solid && { color: color.fg }]}>{result.interpretation.detail}</Text>
      </View>

      {/* Champs interactifs */}
      <View style={styles.fields}>
        {def.fields.map((f) =>
          f.kind === 'choice' ? (
            <View key={f.id} style={styles.field}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              {f.help ? <Text style={styles.fieldHelp}>{f.help}</Text> : null}
              <View style={styles.options}>
                {f.options.map((opt, idx) => {
                  const active = (choiceIdx[f.id] ?? 0) === idx;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => setChoiceIdx((prev) => ({ ...prev, [f.id]: idx }))}
                      style={[styles.option, active && styles.optionActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View key={f.id} style={styles.field}>
              <Text style={styles.fieldLabel}>
                {f.label}
                {f.unit ? <Text style={styles.fieldUnit}> ({f.unit})</Text> : null}
              </Text>
              {f.help ? <Text style={styles.fieldHelp}>{f.help}</Text> : null}
              <TextInput
                value={numInputs[f.id] ?? ''}
                onChangeText={(t) => setNumInputs((prev) => ({ ...prev, [f.id]: t }))}
                placeholder={f.placeholder ?? '—'}
                placeholderTextColor={tokens.colors.textMuted}
                keyboardType="decimal-pad"
                inputMode="decimal"
                style={styles.numInput}
              />
            </View>
          ),
        )}
      </View>

      <Pressable onPress={reset} style={styles.resetBtn} accessibilityRole="button">
        <Icon name="refresh" size={15} color={tokens.colors.accentDeep} />
        <Text style={styles.resetLabel}>Réinitialiser</Text>
      </Pressable>

      {def.reference ? <Text style={styles.meta}>Référence : {def.reference}</Text> : null}
      {def.caution ? (
        <View style={styles.caution}>
          <Icon name="shield" size={15} color={tokens.colors.warningText} />
          <Text style={styles.cautionText}>{def.caution}</Text>
        </View>
      ) : null}
      <Text style={styles.disclaimer}>
        Aide à la décision destinée aux professionnels et étudiants en santé — ne remplace ni le
        jugement clinique ni les recommandations en vigueur.
      </Text>
    </ScrollView>
  );
}

function initState(def: ScoreDefinition): { choiceIdx: Record<string, number>; numInputs: Record<string, string> } {
  const choiceIdx: Record<string, number> = {};
  const numInputs: Record<string, string> = {};
  for (const f of def.fields) {
    if (f.kind === 'choice') choiceIdx[f.id] = 0;
    else numInputs[f.id] = f.default != null ? String(f.default) : '';
  }
  return { choiceIdx, numInputs };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.md,
    paddingBottom: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: tokens.space.sm },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  subtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
    marginTop: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: tokens.space.lg, paddingBottom: tokens.space['3xl'], maxWidth: 760, width: '100%', alignSelf: 'center' },

  // Recherche
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.space.md,
    height: tokens.size.controlLg,
    ...tokens.elevation.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
    ...(Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }) as object),
  },
  searchHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginTop: tokens.space.sm,
    marginBottom: tokens.space.md,
    lineHeight: 17,
  },

  // Chips catégories
  chipsRow: { flexGrow: 0, marginBottom: tokens.space.md },
  chipsContent: { gap: tokens.space.sm, paddingRight: tokens.space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  chipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  chipLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.semibold, color: tokens.colors.accentDeep },
  chipLabelActive: { color: tokens.colors.onAccent },

  resultCount: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.sm,
  },

  // Cartes de score
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.md,
    marginBottom: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 1 },
  cardAcronym: { fontFamily: tokens.font.display, fontSize: tokens.type.bodyLg.fontSize, fontWeight: tokens.weight.bold, color: tokens.colors.text },
  cardName: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, color: tokens.colors.textSubtle },
  cardPurpose: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, color: tokens.colors.textMuted, lineHeight: 17, marginTop: 2 },

  empty: { alignItems: 'center', gap: tokens.space.sm, paddingVertical: tokens.space['3xl'] },
  emptyText: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.fontSize, color: tokens.colors.text, fontWeight: tokens.weight.semibold },
  emptySub: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, color: tokens.colors.textMuted, textAlign: 'center' },

  // Détail
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: tokens.space.md, alignSelf: 'flex-start' },
  backLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold, color: tokens.colors.accentDeep },
  detailHead: { marginBottom: tokens.space.md },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    marginBottom: tokens.space.sm,
  },
  detailChipLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.micro.fontSize, fontWeight: tokens.weight.semibold, color: tokens.colors.accentDeep },
  detailAcronym: { fontFamily: tokens.font.serif, fontSize: tokens.type.h1.fontSize, letterSpacing: tokens.type.h1.letterSpacing, fontWeight: tokens.weight.semibold, color: tokens.colors.text },
  detailName: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.fontSize, color: tokens.colors.textSubtle, marginTop: 2 },
  detailPurpose: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.fontSize, color: tokens.colors.textMuted, lineHeight: tokens.type.body.lineHeight, marginTop: tokens.space.sm },

  // Carte résultat
  resultCard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.lg,
    marginBottom: tokens.space.lg,
    ...tokens.elevation.md,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  resultLabelSmall: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.micro.fontSize,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
    fontWeight: tokens.weight.bold,
    color: tokens.colors.textMuted,
  },
  resultValue: { fontFamily: tokens.font.display, fontSize: tokens.type.display.fontSize, letterSpacing: tokens.type.display.letterSpacing, fontWeight: tokens.weight.bold, color: tokens.colors.text, marginTop: 2 },
  badge: { paddingHorizontal: tokens.space.md, paddingVertical: 6, borderRadius: tokens.radius.pill },
  badgeText: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.bold },
  resultDetail: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.fontSize, color: tokens.colors.textSubtle, lineHeight: 21, marginTop: tokens.space.md },

  // Champs
  fields: { gap: tokens.space.lg },
  field: { gap: tokens.space.sm },
  fieldLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold, color: tokens.colors.text },
  fieldUnit: { fontWeight: tokens.weight.regular, color: tokens.colors.textMuted },
  fieldHelp: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, color: tokens.colors.textMuted, marginTop: -2 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  option: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm + 2,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
  },
  optionActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  optionLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.fontSize, color: tokens.colors.text, fontWeight: tokens.weight.medium },
  optionLabelActive: { color: tokens.colors.onAccent, fontWeight: tokens.weight.semibold },
  numInput: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space.md,
    height: tokens.size.controlMd,
    ...(Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }) as object),
  },

  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: tokens.space.lg, paddingVertical: tokens.space.sm },
  resetLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold, color: tokens.colors.accentDeep },

  meta: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, color: tokens.colors.textMuted, lineHeight: 18, marginTop: tokens.space.md },
  caution: {
    flexDirection: 'row',
    gap: tokens.space.sm,
    backgroundColor: tokens.colors.warningBackground,
    borderRadius: tokens.radius.md,
    padding: tokens.space.md,
    marginTop: tokens.space.md,
  },
  cautionText: { flex: 1, fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, color: tokens.colors.warningText, lineHeight: 18 },
  disclaimer: { fontFamily: tokens.font.sans, fontSize: tokens.type.micro.fontSize, color: tokens.colors.textMuted, lineHeight: 16, marginTop: tokens.space.lg, fontStyle: 'italic' },
});
