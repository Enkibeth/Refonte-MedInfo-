/**
 * Création / édition d'un plan de révision (feature étudiant, ADR-0027).
 *
 * Saisie 100 % utilisateur : dates, plafond quotidien, vitesse personnelle, blocs de
 * travail (volumes). Aucun chiffre n'est inventé. À l'enregistrement, on renvoie un
 * brouillon (`PlanDraft`) que l'écran persiste via /api/revision (RLS own-row).
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import type { ExamType, RevisionItem } from '../engine/types';
import type { FullPlan, PlanDraft } from '../api';

const EXAM_OPTIONS: { value: ExamType; label: string }[] = [
  { value: 'pass_las', label: 'PASS/LAS' },
  { value: 'dfgsm', label: 'DFGSM' },
  { value: 'edn', label: 'EDN' },
  { value: 'ecos', label: 'ECOS' },
  { value: 'custom', label: 'Autre' },
];

let tmpCounter = 0;
function newItem(): RevisionItem {
  tmpCounter += 1;
  return {
    id: `tmp-${tmpCounter}-${Date.now()}`,
    title: '',
    subject: '',
    pages: 0,
    chapters: 0,
    qcm: 0,
    priority: 2,
    completedPages: 0,
    completedChapters: 0,
    completedQcm: 0,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface PlanEditorProps {
  /** Plan existant à éditer, sinon création. */
  initial?: FullPlan | null;
  saving?: boolean;
  error?: string | null;
  onSave: (draft: PlanDraft) => void;
  onCancel: () => void;
}

export function PlanEditor({ initial, saving, error, onSave, onCancel }: PlanEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [examType, setExamType] = useState<ExamType>(initial?.examType ?? 'pass_las');
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayIso());
  const [examDate, setExamDate] = useState(initial?.examDate ?? '');
  const [dailyMax, setDailyMax] = useState(String(initial?.dailyMaxMinutes ?? 180));
  const [pagesPerHour, setPagesPerHour] = useState(String(initial?.pagesPerHour ?? 8));
  const [chaptersPerHour, setChaptersPerHour] = useState(String(initial?.chaptersPerHour ?? 1.5));
  const [qcmPerHour, setQcmPerHour] = useState(String(initial?.qcmPerHour ?? 60));
  const [bufferRatio, setBufferRatio] = useState(initial?.bufferRatio ?? 0.1);
  const [spaced, setSpaced] = useState(initial?.spacedRepetition ?? false);
  const [restWeekends, setRestWeekends] = useState(
    initial ? initial.restWeekdays.includes(0) && initial.restWeekdays.includes(6) : false,
  );
  const [items, setItems] = useState<RevisionItem[]>(initial?.items?.length ? initial.items : [newItem()]);

  function updateItem(id: string, patch: Partial<RevisionItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function submit() {
    const draft: PlanDraft = {
      id: initial?.id,
      title: title.trim() || 'Plan de révision',
      examType,
      startDate,
      examDate,
      dailyMaxMinutes: toInt(dailyMax, 180),
      pagesPerHour: toNum(pagesPerHour, 8),
      chaptersPerHour: toNum(chaptersPerHour, 1.5),
      qcmPerHour: toNum(qcmPerHour, 60),
      bufferRatio,
      spacedRepetition: spaced,
      restWeekdays: restWeekends ? [0, 6] : [],
      unavailableDays: initial?.unavailableDays ?? [],
      // L'ordre du tableau fixe la position côté serveur (sanitizePlanPayload).
      items: items
        .filter((it) => it.title.trim().length > 0)
        .map((it) => ({ ...it, title: it.title.trim(), priority: it.priority || 2 })),
    };
    onSave(draft);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{initial ? 'Modifier le plan' : 'Nouveau plan de révision'}</Text>

      <Field label="Titre">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ex. EDN — rang A cardio/pneumo"
          placeholderTextColor={tokens.colors.textMuted}
          style={styles.input}
        />
      </Field>

      <Field label="Type d’examen">
        <View style={styles.segmentRow}>
          {EXAM_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setExamType(opt.value)}
              style={[styles.segment, examType === opt.value && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, examType === opt.value && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <View style={styles.row}>
        <Field label="Début (aaaa-mm-jj)" flex>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-06-13"
            placeholderTextColor={tokens.colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
          />
        </Field>
        <Field label="Examen (aaaa-mm-jj)" flex>
          <TextInput
            value={examDate}
            onChangeText={setExamDate}
            placeholder="2026-09-01"
            placeholderTextColor={tokens.colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
          />
        </Field>
      </View>

      <Field label="Temps de travail max par jour (minutes)">
        <TextInput
          value={dailyMax}
          onChangeText={setDailyMax}
          keyboardType="number-pad"
          style={styles.input}
        />
      </Field>

      <Text style={styles.groupTitle}>Mon rythme (déclaré par toi)</Text>
      <View style={styles.row}>
        <Field label="Pages / heure" flex>
          <TextInput value={pagesPerHour} onChangeText={setPagesPerHour} keyboardType="decimal-pad" style={styles.input} />
        </Field>
        <Field label="Chapitres / heure" flex>
          <TextInput value={chaptersPerHour} onChangeText={setChaptersPerHour} keyboardType="decimal-pad" style={styles.input} />
        </Field>
        <Field label="QCM / heure" flex>
          <TextInput value={qcmPerHour} onChangeText={setQcmPerHour} keyboardType="number-pad" style={styles.input} />
        </Field>
      </View>

      <Field label={`Jours tampon réservés en fin de période : ${Math.round(bufferRatio * 100)}%`}>
        <View style={styles.segmentRow}>
          {[0, 0.1, 0.2, 0.3].map((r) => (
            <Pressable
              key={r}
              onPress={() => setBufferRatio(r)}
              style={[styles.segment, Math.abs(bufferRatio - r) < 0.001 && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, Math.abs(bufferRatio - r) < 0.001 && styles.segmentTextActive]}>
                {Math.round(r * 100)}%
              </Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Week-ends de repos (sam./dim.)</Text>
        <Switch value={restWeekends} onValueChange={setRestWeekends} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Révision espacée (rappels sur les jours tampon)</Text>
        <Switch value={spaced} onValueChange={setSpaced} />
      </View>

      <Text style={styles.groupTitle}>Blocs de travail</Text>
      {items.map((it) => (
        <View key={it.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <TextInput
              value={it.title}
              onChangeText={(t) => updateItem(it.id, { title: t })}
              placeholder="Matière / collège / chapitre"
              placeholderTextColor={tokens.colors.textMuted}
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable onPress={() => setItems((p) => p.filter((x) => x.id !== it.id))} style={styles.removeBtn}>
              <Icon name="trash" size={16} color={tokens.colors.danger} />
            </Pressable>
          </View>
          <View style={styles.row}>
            <Field label="Pages" flex>
              <TextInput
                value={String(it.pages)}
                onChangeText={(t) => updateItem(it.id, { pages: toInt(t, 0) })}
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>
            <Field label="Chapitres" flex>
              <TextInput
                value={String(it.chapters)}
                onChangeText={(t) => updateItem(it.id, { chapters: toInt(t, 0) })}
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>
            <Field label="QCM" flex>
              <TextInput
                value={String(it.qcm)}
                onChangeText={(t) => updateItem(it.id, { qcm: toInt(t, 0) })}
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>
          </View>
          <View style={styles.priorityRow}>
            <Text style={styles.priorityLabel}>Priorité</Text>
            {[1, 2, 3].map((p) => (
              <Pressable
                key={p}
                onPress={() => updateItem(it.id, { priority: p })}
                style={[styles.prioPill, it.priority === p && styles.prioPillActive]}
              >
                <Text style={[styles.prioText, it.priority === p && styles.prioTextActive]}>
                  {p === 1 ? 'Haute' : p === 2 ? 'Normale' : 'Basse'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Pressable onPress={() => setItems((p) => [...p, newItem()])} style={styles.addBtn}>
        <Icon name="plus" size={16} color={tokens.colors.accentDeep} />
        <Text style={styles.addBtnText}>Ajouter un bloc</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <View style={styles.cancelWrap}>
          <Button label="Annuler" variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.saveWrap}>
          <Button label="Enregistrer le plan" variant="primary" loading={saving} onPress={submit} />
        </View>
      </View>
    </ScrollView>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <View style={[styles.field, flex && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function toInt(value: string, fallback: number): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
function toNum(value: string, fallback: number): number {
  const n = parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.md, paddingBottom: tokens.space['3xl'] },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  groupTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    marginTop: tokens.space.sm,
  },
  field: { gap: 4 },
  fieldLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.medium,
  },
  input: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    backgroundColor: tokens.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm + 2,
  },
  row: { flexDirection: 'row', gap: tokens.space.sm },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.xs },
  segment: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  segmentActive: { backgroundColor: tokens.colors.accentSurface, borderColor: tokens.colors.accentSurfaceStrong },
  segmentText: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: tokens.type.caption.fontSize, fontWeight: tokens.weight.medium },
  segmentTextActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  switchLabel: { flex: 1, fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.body.fontSize },
  itemCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.md,
    gap: tokens.space.sm,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  removeBtn: {
    width: tokens.size.iconButton,
    height: tokens.size.iconButton,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.dangerBackground,
  },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs },
  priorityLabel: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize, marginRight: tokens.space.xs },
  prioPill: {
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 4,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  prioPillActive: { backgroundColor: tokens.colors.accentSurface, borderColor: tokens.colors.accentSurfaceStrong },
  prioText: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, fontSize: tokens.type.micro.fontSize },
  prioTextActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colors.accentSurfaceStrong,
    backgroundColor: tokens.colors.accentSurface,
  },
  addBtnText: { fontFamily: tokens.font.sans, color: tokens.colors.accentDeep, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold },
  error: { fontFamily: tokens.font.sans, color: tokens.colors.danger, fontSize: tokens.type.caption.fontSize },
  actions: { flexDirection: 'row', gap: tokens.space.sm, marginTop: tokens.space.sm },
  cancelWrap: { flex: 1 },
  saveWrap: { flex: 2 },
});
