/**
 * Analyseur de classement de promo — outil étudiant (persona student).
 *
 * L'étudiant importe le tableau des notes de toute sa promo (CSV/TSV exporté d'Excel/Sheets,
 * ou collé) et obtient son classement, des statistiques, et peut comparer avec un autre
 * numéro étudiant. Traitement 100 % CÔTÉ CLIENT : les notes ne quittent jamais l'appareil
 * (aucune IA, aucun réseau, aucune persistance) — confidentialité des données de tiers.
 */
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

import { tokens } from '@/ui/tokens';
import { RoleGate } from '@/ui/RoleGate';
import { ToolsMenu } from '@/ui/ToolsMenu';
import {
  parseDelimited,
  detectColumns,
  defaultGradeCol,
  analyze,
  type Sheet,
  type AnalyzeResult,
} from '@/lib/classement';

const fr = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

function PartielInner() {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [idCol, setIdCol] = useState(0);
  const [gradeCols, setGradeCols] = useState<number[]>([]);
  const [gradeCol, setGradeCol] = useState(-1);
  const [myId, setMyId] = useState('');
  const [otherId, setOtherId] = useState('');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadSheet(text: string, name: string | null) {
    const parsed = parseDelimited(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setError('Fichier vide ou illisible. Attendu : une ligne d’en-têtes puis une ligne par étudiant.');
      return;
    }
    const { idCol: id, gradeCols: gc } = detectColumns(parsed);
    setSheet(parsed);
    setFileName(name);
    setIdCol(id);
    setGradeCols(gc);
    setGradeCol(defaultGradeCol(parsed, gc));
    setResult(null);
    setError(null);
  }

  function pickFile() {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt,text/csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => loadSheet(String(reader.result ?? ''), file.name);
      reader.onerror = () => setError('Lecture du fichier impossible.');
      reader.readAsText(file);
    };
    input.click();
  }

  function usePaste() {
    if (pasteText.trim().length < 5) return;
    loadSheet(pasteText, null);
  }

  function compute() {
    if (!sheet) return;
    if (!myId.trim()) {
      setError('Indique ton numéro étudiant.');
      return;
    }
    const res = analyze(sheet, idCol, gradeCol, myId, otherId);
    if (res.error) {
      setError(res.error);
      setResult(null);
      return;
    }
    setError(null);
    setResult(res);
  }

  const reset = () => {
    setSheet(null);
    setFileName(null);
    setPasteText('');
    setResult(null);
    setError(null);
  };

  const headerChip = useMemo(
    () =>
      sheet?.headers.map((h, i) => ({ label: h || `Col ${i + 1}`, value: i })) ?? [],
    [sheet],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ToolsMenu />
        </View>
        <Text style={styles.title}>Analyseur de classement</Text>
        <Text style={styles.subtitle}>
          Importe les notes de ta promo et situe-toi — calcul privé, sur ton appareil.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!sheet ? (
          <>
            {Platform.OS === 'web' ? (
              <TouchableOpacity style={styles.button} onPress={pickFile} accessibilityRole="button">
                <Text style={styles.buttonText}>📂 Importer un fichier (.csv / .tsv)</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.or}>ou colle le tableau (copié depuis Excel/Sheets)</Text>
            <TextInput
              style={styles.textArea}
              value={pasteText}
              onChangeText={setPasteText}
              placeholder={'Numero;Moyenne\n22001;15,5\n22002;9,0\n…'}
              placeholderTextColor={tokens.colors.textMuted}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.button, pasteText.trim().length < 5 && styles.buttonDisabled]}
              onPress={usePaste}
              disabled={pasteText.trim().length < 5}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Utiliser ce tableau</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              Format attendu : une 1re ligne d’en-têtes, puis une ligne par étudiant, avec une colonne
              « numéro étudiant » et au moins une colonne de notes. Excel : Fichier → Enregistrer sous → CSV.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.loadedRow}>
              <Text style={styles.loadedText}>
                ✅ {sheet.rows.length} étudiants{fileName ? ` · ${fileName}` : ''}
              </Text>
              <TouchableOpacity onPress={reset} accessibilityRole="button">
                <Text style={styles.changeLink}>Changer</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Colonne « numéro étudiant »</Text>
            <View style={styles.chips}>
              {headerChip.map((c) => (
                <Chip key={`id-${c.value}`} active={idCol === c.value} label={c.label} onPress={() => setIdCol(c.value)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Note à classer</Text>
            <View style={styles.chips}>
              {gradeCols.length === 0 ? (
                <Text style={styles.hint}>Aucune colonne numérique détectée.</Text>
              ) : (
                gradeCols.map((c) => (
                  <Chip
                    key={`g-${c}`}
                    active={gradeCol === c}
                    label={sheet.headers[c] || `Col ${c + 1}`}
                    onPress={() => setGradeCol(c)}
                  />
                ))
              )}
            </View>

            <Text style={styles.fieldLabel}>Mon numéro étudiant</Text>
            <TextInput
              style={styles.input}
              value={myId}
              onChangeText={setMyId}
              placeholder="ex. 22001"
              placeholderTextColor={tokens.colors.textMuted}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Comparer avec (optionnel)</Text>
            <TextInput
              style={styles.input}
              value={otherId}
              onChangeText={setOtherId}
              placeholder="numéro d’un·e autre étudiant·e"
              placeholderTextColor={tokens.colors.textMuted}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.button, (!myId.trim() || gradeCol < 0) && styles.buttonDisabled]}
              onPress={compute}
              disabled={!myId.trim() || gradeCol < 0}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Calculer mon classement</Text>
            </TouchableOpacity>
          </>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {result?.me ? <ResultCard res={result} /> : null}

        <Text style={styles.note}>
          Confidentialité : le fichier est lu et calculé localement. Aucune note n’est envoyée à un
          serveur ni à une IA.
        </Text>
      </ScrollView>
    </View>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ResultCard({ res }: { res: AnalyzeResult }) {
  const me = res.me!;
  const r = me.ranking;
  return (
    <View style={styles.result}>
      <Text style={styles.resultRank}>
        {r.rank}
        <Text style={styles.resultRankTotal}> / {r.total}</Text>
      </Text>
      <Text style={styles.resultLead}>
        Ta note {fr(r.score)} — meilleur que {Math.round(r.betterThanPct)} % de la promo.
      </Text>

      <View style={styles.statGrid}>
        <Stat label="Moyenne promo" value={fr(r.mean)} />
        <Stat label="Médiane" value={fr(r.median)} />
        <Stat label="Min" value={fr(r.min)} />
        <Stat label="Max" value={fr(r.max)} />
        <Stat label="Écart à la moyenne" value={(r.score >= r.mean ? '+' : '') + fr(r.score - r.mean)} />
      </View>

      {res.other ? (
        <View style={styles.compareBox}>
          <Text style={styles.compareTitle}>Comparaison · n° {res.other.id}</Text>
          <Text style={styles.compareLine}>
            Rang {res.other.ranking.rank}/{res.other.ranking.total} · note {fr(res.other.ranking.score)}
          </Text>
          <Text style={[styles.compareGap, (res.gap ?? 0) >= 0 ? styles.gapAhead : styles.gapBehind]}>
            {(res.gap ?? 0) >= 0 ? 'Tu es devant de ' : 'Tu es derrière de '}
            {fr(Math.abs(res.gap ?? 0))} pt · {Math.abs(res.other.ranking.rank - r.rank)} place(s)
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function PartielScreen() {
  return (
    <RoleGate feature="partiel">
      <PartielInner />
    </RoleGate>
  );
}

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
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  subtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
    marginTop: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: tokens.space.lg, gap: tokens.space.md },
  or: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    textAlign: 'center',
  },
  textArea: {
    minHeight: 120,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.md,
    fontFamily: tokens.font.mono,
    fontSize: tokens.type.label.fontSize,
    color: tokens.colors.text,
  },
  button: {
    minHeight: 48,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.space.lg,
    ...tokens.elevation.sm,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  hint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
  },
  loadedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loadedText: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold },
  changeLink: { fontFamily: tokens.font.sans, color: tokens.colors.accent, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold },
  fieldLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: tokens.space.xs,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  chip: {
    borderRadius: tokens.radius.none,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  chipActive: { backgroundColor: tokens.colors.accentSurface, borderColor: tokens.colors.accentSurfaceStrong },
  chipText: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  chipTextActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  input: {
    minHeight: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    color: tokens.colors.text,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    paddingHorizontal: tokens.space.lg,
  },
  errorBox: {
    borderRadius: tokens.radius.md,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.danger,
    backgroundColor: tokens.colors.dangerBackground,
    padding: tokens.space.lg,
  },
  errorText: { fontFamily: tokens.font.sans, color: tokens.colors.danger, fontSize: tokens.type.label.fontSize, lineHeight: 21 },
  result: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  resultRank: {
    fontFamily: tokens.font.display,
    color: tokens.colors.accentDeep,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: tokens.weight.bold,
  },
  resultRankTotal: { fontSize: 22, color: tokens.colors.accent, fontWeight: tokens.weight.semibold },
  resultLead: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm, marginTop: tokens.space.xs },
  stat: {
    flexGrow: 1,
    flexBasis: 90,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
  },
  statValue: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.bold },
  statLabel: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: 11, marginTop: 2 },
  compareBox: {
    marginTop: tokens.space.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.md,
    gap: 2,
  },
  compareTitle: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.semibold },
  compareLine: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.label.fontSize },
  compareGap: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold, marginTop: 2 },
  gapAhead: { color: tokens.colors.success },
  gapBehind: { color: tokens.colors.danger },
  note: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: tokens.space.sm,
  },
});
