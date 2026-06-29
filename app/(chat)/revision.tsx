/**
 * Dashboard de révision étudiant (ADR-0027).
 *
 * Planificateur PÉDAGOGIQUE : transforme un programme (matières, pages, chapitres, QCM)
 * en charge quotidienne réaliste, avec jauge de risque anti-panique et suivi. Le cœur est
 * le moteur DÉTERMINISTE (`@/revision/engine`) — aucune IA, aucun chiffre inventé. Données
 * pédagogiques uniquement (jamais de symptôme/patient/santé). Persistance own-row (RLS).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { RoleGate } from '@/ui/RoleGate';
import { ToolsMenu } from '@/ui/ToolsMenu';
import { redistribute } from '@/revision/engine/redistribution';
import { daysBetween } from '@/revision/engine/dates';
import {
  sanitizeStoredPlan,
  storedPlanToInput,
  completedByResource,
  newResourceId,
  todayISO,
  DEFAULT_SPEED,
  EXAM_TYPES,
  type StoredPlan,
  type StoredResource,
} from '@/revision/db/plans';
import {
  listPlans,
  getPlan,
  savePlan,
  deletePlan,
  type RevisionPlanListItem,
} from '@/revision/db/queries';
import type { ExamType } from '@/revision/types';
import {
  StatTile,
  PlanHealthGauge,
  DailyLoadBar,
  formatMinutes,
} from '@/ui/revision/RevisionWidgets';

const EXAM_LABELS: Record<ExamType, string> = {
  pass_las: 'PASS/LAS',
  dfgsm: 'DFGSM',
  edn: 'EDN',
  ecos: 'ECOS',
  custom: 'Autre',
};

const UPCOMING_DAYS = 10;

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function newDraft(): { title: string; examType: ExamType; stored: StoredPlan } {
  const start = todayISO();
  return {
    title: 'Mon plan de révision',
    examType: 'custom',
    stored: {
      startDate: start,
      examDate: addDaysISO(start, 30),
      unavailableDays: [],
      dailyMaxMinutes: 120,
      bufferRatio: 0.1,
      speed: { ...DEFAULT_SPEED },
      resources: [],
    },
  };
}

export default function RevisionScreen() {
  return (
    <RoleGate feature="revision">
      <RevisionScreenInner />
    </RoleGate>
  );
}

function RevisionScreenInner() {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;
  const today = todayISO();

  const initial = useMemo(() => newDraft(), []);
  const [planId, setPlanId] = useState<string | null>(null);
  const [title, setTitle] = useState(initial.title);
  const [examType, setExamType] = useState<ExamType>(initial.examType);
  const [stored, setStored] = useState<StoredPlan>(initial.stored);
  const [formKey, setFormKey] = useState(0); // remonte les champs à chaque chargement/nouveau

  const [plans, setPlans] = useState<RevisionPlanListItem[]>([]);
  const [plansOpen, setPlansOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPlans = useCallback(async () => {
    if (!userId) return;
    try {
      setPlans(await listPlans());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [userId]);

  useEffect(() => {
    void refreshPlans();
  }, [refreshPlans]);

  const view = useMemo(() => {
    const clean = sanitizeStoredPlan(stored);
    const input = storedPlanToInput(clean);
    const result = redistribute(input, {
      completedMinutesByResource: completedByResource(clean),
      today,
    });
    const todayTasks = result.tasks.filter((t) => t.date === today);
    return { clean, result, todayTasks };
  }, [stored, today]);

  function patchStored(patch: Partial<StoredPlan>) {
    setStored((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function patchResource(id: string, patch: Partial<StoredResource>) {
    setStored((prev) => ({
      ...prev,
      resources: prev.resources.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    setDirty(true);
  }

  function addResource() {
    setStored((prev) => ({
      ...prev,
      resources: [
        ...prev.resources,
        {
          id: newResourceId(),
          title: '',
          pages: 0,
          chapters: 0,
          qcm: 0,
          priority: prev.resources.length + 1,
          masteryStart: 0,
          completedMinutes: 0,
        },
      ],
    }));
    setDirty(true);
  }

  function removeResource(id: string) {
    setStored((prev) => ({ ...prev, resources: prev.resources.filter((r) => r.id !== id) }));
    setDirty(true);
  }

  const persist = useCallback(
    async (nextStored: StoredPlan, nextTitle: string, nextExamType: ExamType) => {
      if (!userId) {
        setError('Connecte-toi pour enregistrer ton plan.');
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const { id } = await savePlan({
          id: planId,
          userId,
          title: nextTitle,
          examType: nextExamType,
          plan: nextStored,
        });
        setPlanId(id);
        setDirty(false);
        await refreshPlans();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
      } finally {
        setSaving(false);
      }
    },
    [userId, planId, refreshPlans],
  );

  async function loadPlan(id: string) {
    setError(null);
    try {
      const record = await getPlan(id);
      if (!record) {
        setError('Plan introuvable.');
        return;
      }
      setPlanId(record.id);
      setTitle(record.title);
      setExamType(record.exam_type);
      setStored(record.plan);
      setDirty(false);
      setPlansOpen(false);
      setFormKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }

  function startNewPlan() {
    const d = newDraft();
    setPlanId(null);
    setTitle(d.title);
    setExamType(d.examType);
    setStored(d.stored);
    setDirty(false);
    setPlansOpen(false);
    setFormKey((k) => k + 1);
  }

  async function handleDelete(id: string) {
    try {
      await deletePlan(id);
      if (id === planId) startNewPlan();
      await refreshPlans();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible.');
    }
  }

  function markTaskDone(resourceId: string, minutes: number) {
    const next: StoredPlan = {
      ...stored,
      resources: stored.resources.map((r) =>
        r.id === resourceId ? { ...r, completedMinutes: r.completedMinutes + minutes } : r,
      ),
    };
    setStored(next);
    void persist(next, title, examType);
  }

  const { clean, result, todayTasks } = view;
  const daysLeft = daysBetween(today, clean.examDate);
  const hasResources = stored.resources.length > 0;
  const canSave = !saving && (dirty || planId === null);
  const resourceTitle = (id: string) => stored.resources.find((r) => r.id === id)?.title || 'Bloc';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ToolsMenu />
        </View>
        <Text style={styles.title}>Révisions</Text>
        <Text style={styles.subtitle}>
          Transforme ton programme en charge quotidienne réaliste. Le calcul est déterministe :
          rien n'est inventé, tu vois tout de suite si tu es dans les temps.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Mes plans */}
        {userId ? (
          <TouchableOpacity
            style={styles.plansToggle}
            onPress={() => setPlansOpen((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.plansToggleText}>
              {plansOpen ? '▾' : '▸'} Mes plans ({plans.length})
            </Text>
          </TouchableOpacity>
        ) : null}

        {plansOpen ? (
          <View style={styles.plansList}>
            {plans.length === 0 ? (
              <Text style={styles.plansEmpty}>Aucun plan enregistré pour le moment.</Text>
            ) : (
              plans.map((p) => (
                <View key={p.id} style={styles.planItem}>
                  <TouchableOpacity
                    style={styles.planItemBody}
                    onPress={() => void loadPlan(p.id)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.planItemTitle} numberOfLines={1}>
                      {p.title}
                    </Text>
                    <Text style={styles.planItemMeta}>
                      {EXAM_LABELS[p.exam_type]} · examen le {p.exam_date}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void handleDelete(p.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Supprimer ce plan"
                    style={styles.planDelete}
                  >
                    <Icon name="trash" size={15} color={tokens.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))
            )}
            <TouchableOpacity style={styles.newPlanButton} onPress={startNewPlan} accessibilityRole="button">
              <Icon name="plus" size={15} color={tokens.colors.accentDeep} />
              <Text style={styles.newPlanText}>Nouveau plan</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Réglages du plan */}
        <View key={`form-${formKey}`} style={styles.card}>
          <Text style={styles.cardTitle}>Le plan</Text>
          <Field label="Titre">
            <TextInput
              style={styles.input}
              defaultValue={title}
              onChangeText={(t) => {
                setTitle(t);
                setDirty(true);
              }}
              placeholder="Mon plan de révision"
              placeholderTextColor={tokens.colors.textMuted}
            />
          </Field>

          <Text style={styles.fieldLabel}>Type d'examen</Text>
          <View style={styles.examRow}>
            {EXAM_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.examChip, examType === t && styles.examChipActive]}
                onPress={() => {
                  setExamType(t);
                  setDirty(true);
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.examChipText, examType === t && styles.examChipTextActive]}>
                  {EXAM_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.dualRow}>
            <Field label="Début (AAAA-MM-JJ)">
              <TextInput
                style={styles.input}
                defaultValue={stored.startDate}
                onChangeText={(t) => patchStored({ startDate: t.trim() })}
                placeholder="2026-01-01"
                placeholderTextColor={tokens.colors.textMuted}
                autoCapitalize="none"
              />
            </Field>
            <Field label="Examen (AAAA-MM-JJ)">
              <TextInput
                style={styles.input}
                defaultValue={stored.examDate}
                onChangeText={(t) => patchStored({ examDate: t.trim() })}
                placeholder="2026-06-01"
                placeholderTextColor={tokens.colors.textMuted}
                autoCapitalize="none"
              />
            </Field>
          </View>

          <View style={styles.dualRow}>
            <NumberField
              label="Minutes / jour max"
              value={stored.dailyMaxMinutes}
              onChange={(n) => patchStored({ dailyMaxMinutes: n })}
            />
            <NumberField
              label="Pages / heure"
              value={stored.speed.pagesPerHour}
              onChange={(n) => patchStored({ speed: { ...stored.speed, pagesPerHour: n } })}
            />
          </View>
          <View style={styles.dualRow}>
            <NumberField
              label="Chapitres / heure"
              value={stored.speed.chaptersPerHour}
              onChange={(n) => patchStored({ speed: { ...stored.speed, chaptersPerHour: n } })}
            />
            <NumberField
              label="QCM / heure"
              value={stored.speed.qcmPerHour}
              onChange={(n) => patchStored({ speed: { ...stored.speed, qcmPerHour: n } })}
            />
          </View>
        </View>

        {/* Blocs de travail */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ce qu'il y a à réviser</Text>
          {stored.resources.length === 0 ? (
            <Text style={styles.hint}>
              Ajoute tes matières/collèges avec leur volume (pages, chapitres, QCM). Le moteur
              répartit la charge sur tes jours disponibles.
            </Text>
          ) : null}
          {stored.resources.map((r, index) => (
            <View key={r.id} style={styles.resource}>
              <View style={styles.resourceHead}>
                <TextInput
                  style={[styles.input, styles.resourceTitleInput]}
                  defaultValue={r.title}
                  onChangeText={(t) => patchResource(r.id, { title: t })}
                  placeholder={`Bloc ${index + 1} (ex. Cardiologie)`}
                  placeholderTextColor={tokens.colors.textMuted}
                />
                <TouchableOpacity
                  onPress={() => removeResource(r.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Retirer ce bloc"
                  style={styles.resourceRemove}
                >
                  <Icon name="x" size={15} color={tokens.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.resourceFields}>
                <NumberField small label="Pages" value={r.pages} onChange={(n) => patchResource(r.id, { pages: n })} />
                <NumberField
                  small
                  label="Chapitres"
                  value={r.chapters}
                  onChange={(n) => patchResource(r.id, { chapters: n })}
                />
                <NumberField small label="QCM" value={r.qcm} onChange={(n) => patchResource(r.id, { qcm: n })} />
                <NumberField
                  small
                  label="Priorité"
                  value={r.priority}
                  onChange={(n) => patchResource(r.id, { priority: n })}
                />
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addResource} onPress={addResource} accessibilityRole="button">
            <Icon name="plus" size={16} color={tokens.colors.accentDeep} />
            <Text style={styles.addResourceText}>Ajouter un bloc</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonIdle]}
          onPress={() => void persist(stored, title, examType)}
          disabled={!canSave}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={tokens.colors.onAccent} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>
              {planId === null
                ? 'Enregistrer le plan'
                : dirty
                  ? 'Enregistrer les modifications'
                  : 'Plan enregistré ✓'}
            </Text>
          )}
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Dashboard calculé */}
        {hasResources ? (
          <>
            <View style={styles.statsRow}>
              <StatTile label="Examen dans" value={`${daysLeft} j`} hint={`${result.usableDaysCount} jours dispo`} />
              <StatTile label="Reste à faire" value={formatMinutes(result.remainingWorkloadMinutes)} />
              <StatTile
                label="Charge / jour"
                value={
                  Number.isFinite(result.dailyAverageMinutes)
                    ? formatMinutes(result.dailyAverageMinutes)
                    : '—'
                }
                hint="moyenne nécessaire"
              />
              <StatTile label="Progression" value={`${Math.round(result.progressPercent)} %`} />
            </View>

            <PlanHealthGauge risk={result.risk} />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Aujourd'hui</Text>
              {todayTasks.length === 0 ? (
                <Text style={styles.hint}>
                  Rien de planifié aujourd'hui {result.usableDaysCount === 0 ? '(plus de jour avant l\'examen)' : ''}.
                </Text>
              ) : (
                todayTasks.map((t, i) => (
                  <View key={`${t.resourceId}-${i}`} style={styles.taskRow}>
                    <View style={styles.taskBody}>
                      <Text style={styles.taskTitle} numberOfLines={1}>
                        {resourceTitle(t.resourceId)}
                      </Text>
                      <Text style={styles.taskMeta}>{formatMinutes(t.minutes)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.taskDone}
                      onPress={() => markTaskDone(t.resourceId, t.minutes)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.taskDoneText}>Fait</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Prochains jours</Text>
              {result.dailyLoads.slice(0, UPCOMING_DAYS).map((load) => (
                <DailyLoadBar key={load.date} load={load} maxMinutes={clean.dailyMaxMinutes} />
              ))}
              {result.dailyLoads.length === 0 ? (
                <Text style={styles.hint}>Aucun jour disponible avant la date d'examen.</Text>
              ) : null}
            </View>
          </>
        ) : null}

        <Text style={styles.footerNote}>
          Outil d'organisation pédagogique. Il ne remplace ni les référentiels officiels ni la
          pratique encadrée, et ne traite aucune donnée de santé.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function NumberField({
  label,
  value,
  onChange,
  small,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  small?: boolean;
}) {
  const [text, setText] = useState(String(value));
  return (
    <View style={[styles.field, small ? styles.numberSmall : styles.numberHalf]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^0-9]/g, '');
          setText(cleaned);
          onChange(cleaned === '' ? 0 : Number(cleaned));
        }}
        keyboardType="numeric"
        inputMode="numeric"
        placeholder="0"
        placeholderTextColor={tokens.colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.xl,
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
  scrollContent: { padding: tokens.space.lg, gap: tokens.space.md },

  plansToggle: { alignSelf: 'flex-start' },
  plansToggleText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  plansList: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.sm,
    gap: 2,
  },
  plansEmpty: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    padding: tokens.space.sm,
  },
  planItem: { flexDirection: 'row', alignItems: 'center' },
  planItemBody: { flex: 1, paddingVertical: tokens.space.sm, paddingHorizontal: tokens.space.sm },
  planItemTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  planItemMeta: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginTop: 2,
  },
  planDelete: { padding: tokens.space.sm },
  newPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: tokens.space.sm,
    marginTop: 2,
  },
  newPlanText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },

  card: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
  },
  cardTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.type.h3.letterSpacing,
    marginBottom: 2,
  },
  hint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
  },
  field: { gap: 5 },
  fieldLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  input: {
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
  },
  dualRow: { flexDirection: 'row', gap: tokens.space.sm },
  numberHalf: { flex: 1 },
  numberSmall: { flexGrow: 1, flexBasis: '22%' },
  examRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  examChip: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  examChipActive: { borderColor: tokens.colors.accent, backgroundColor: tokens.colors.accentSurface },
  examChipText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  examChipTextActive: { color: tokens.colors.accentDeep },

  resource: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    padding: tokens.space.md,
    gap: tokens.space.sm,
  },
  resourceHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  resourceTitleInput: { flex: 1 },
  resourceRemove: { padding: 6 },
  resourceFields: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  addResource: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurface,
  },
  addResourceText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },

  saveButton: {
    height: 48,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
  },
  saveButtonIdle: { opacity: 0.55 },
  saveButtonText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  errorBox: {
    borderRadius: tokens.radius.md,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.danger,
    backgroundColor: tokens.colors.dangerBackground,
    padding: tokens.space.lg,
  },
  errorText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
  },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingVertical: tokens.space.xs,
  },
  taskBody: { flex: 1 },
  taskTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  taskMeta: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  taskDone: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.success,
    backgroundColor: tokens.colors.successBackground,
  },
  taskDoneText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.success,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
  },
  footerNote: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: tokens.space.sm,
  },
});
