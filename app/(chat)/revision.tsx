/**
 * Planificateur de révisions — outil étudiant (persona student, ADR-0027).
 *
 * Transforme un programme (matières, chapitres, pages, QCM) en charge quotidienne
 * réaliste et visuelle. Cœur = moteur DÉTERMINISTE (src/features/revision/engine) ;
 * aucune IA dans le MVP (l'« AI Boost » est différé). Persistance own-row via
 * /api/revision (RLS migration 0027).
 *
 * ⚠️ Safe-box non-MDSW : données pédagogiques uniquement. Aucun symptôme, cas patient,
 * diagnostic ni conduite à tenir. Voir docs/01_REGULATION.md.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons';
import { Reveal } from '@/ui/Reveal';
import { RoleGate } from '@/ui/RoleGate';
import { Skeleton } from '@/ui/Skeleton';
import { ToolsMenu } from '@/ui/ToolsMenu';
import { tokens } from '@/ui/tokens';
import {
  deletePlan,
  getPlan,
  listPlans,
  savePlan,
  type FullPlan,
  type PlanDraft,
  type PlanSummary,
} from '@/features/revision/api';
import { RevisionDashboard } from '@/features/revision/components/RevisionDashboard';
import { PlanEditor } from '@/features/revision/components/PlanEditor';
import { PressableScale } from '@/features/revision/components/AnimatedBits';

/** Confirmation cross-plateforme avant une suppression (action destructive). */
function confirmDelete(title: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`Supprimer « ${title} » ? Cette action est définitive.`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert('Supprimer ce plan ?', `« ${title} » sera définitivement supprimé.`, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: onConfirm },
  ]);
}

type ViewMode = 'loading' | 'list' | 'editor' | 'dashboard';

const EXAM_LABELS: Record<string, string> = {
  pass_las: 'PASS / LAS',
  dfgsm: 'DFGSM',
  edn: 'EDN',
  ecos: 'ECOS',
  custom: 'Personnalisé',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function RevisionInner() {
  const { session } = useSession();
  const token = session?.access_token ?? null;

  const [view, setView] = useState<ViewMode>('loading');
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [current, setCurrent] = useState<FullPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const list = await listPlans(token);
      setPlans(list);
      setView(list.length === 0 ? 'editor' : 'list');
      if (list.length === 0) setCurrent(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
      setView('list');
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openPlan(id: string) {
    if (!token) return;
    setView('loading');
    setError(null);
    try {
      const full = await getPlan(token, id);
      if (!full) {
        await refresh();
        return;
      }
      setCurrent(full);
      setView('dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
      setView('list');
    }
  }

  async function handleSave(draft: PlanDraft) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const id = await savePlan(token, draft);
      const full = await getPlan(token, id);
      setCurrent(full);
      setView('dashboard');
      const list = await listPlans(token);
      setPlans(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  // Modifs depuis le tableau de bord (tâche cochée, progression, suggestion appliquée) :
  // application LOCALE immédiate + persistance DÉBOUNCÉE (~700 ms) pour éviter un POST
  // par clic. La dernière version gagne ; on flush au démontage.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPlan = useRef<FullPlan | null>(null);

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const toSave = pendingPlan.current;
    pendingPlan.current = null;
    if (toSave && token) {
      savePlan(token, toSave).catch((e) =>
        setError(e instanceof Error ? e.message : 'Sauvegarde de la progression impossible.'),
      );
    }
  }, [token]);

  useEffect(() => () => flushSave(), [flushSave]);

  function handlePlanChange(next: FullPlan) {
    setCurrent(next);
    pendingPlan.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 700);
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      await deletePlan(token, id);
    } catch {
      /* la liste sera resynchronisée de toute façon */
    }
    setCurrent(null);
    await refresh();
  }

  if (view === 'loading') {
    return (
      <View style={styles.skeletonWrap}>
        <Skeleton height={150} radius={tokens.radius.xl} />
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={68} width="31%" radius={tokens.radius.md} />
          ))}
        </View>
        <Skeleton height={96} radius={tokens.radius.lg} />
      </View>
    );
  }

  if (view === 'editor') {
    return (
      <PlanEditor
        initial={current}
        saving={saving}
        error={error}
        onSave={handleSave}
        onCancel={() => (plans.length === 0 ? setView('list') : current ? setView('dashboard') : setView('list'))}
      />
    );
  }

  if (view === 'dashboard' && current) {
    return (
      <RevisionDashboard
        plan={current}
        today={todayIso()}
        token={token}
        onPlanChange={handlePlanChange}
        onEdit={() => {
          flushSave();
          setView('editor');
        }}
        onBack={() => {
          flushSave();
          setCurrent(null);
          void refresh();
        }}
      />
    );
  }

  // Liste des plans
  return (
    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.listTitle}>Mes plans de révision</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {plans.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Icon name="calendarCheck" size={26} color={tokens.colors.accentDeep} />
          </View>
          <Text style={styles.emptyText}>
            Aucun plan pour l’instant. Crée ton premier plan pour transformer ton programme en
            charge quotidienne réaliste.
          </Text>
        </View>
      ) : (
        plans.map((p, i) => (
          <Reveal key={p.id} delay={i * tokens.motion.revealStagger}>
            <PressableScale onPress={() => openPlan(p.id)} accessibilityLabel={`Ouvrir ${p.title || 'le plan'}`} style={styles.planRow}>
              <View style={styles.planIcon}>
                <Icon name="calendarCheck" size={18} color={tokens.colors.accentDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{p.title || 'Plan de révision'}</Text>
                <Text style={styles.planMeta}>
                  {EXAM_LABELS[p.examType] ?? p.examType} · examen le {p.examDate}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmDelete(p.title || 'Plan de révision', () => handleDelete(p.id))}
                style={styles.deleteBtn}
                accessibilityLabel={`Supprimer ${p.title || 'le plan'}`}
                hitSlop={8}
              >
                <Icon name="trash" size={16} color={tokens.colors.danger} />
              </Pressable>
            </PressableScale>
          </Reveal>
        ))
      )}
      <View style={styles.newBtnWrap}>
        <Button
          label="Nouveau plan"
          variant="primary"
          leftIcon={<Icon name="plus" size={16} color={tokens.colors.onAccent} />}
          onPress={() => {
            setCurrent(null);
            setView('editor');
          }}
        />
      </View>
    </ScrollView>
  );
}

export default function RevisionScreen() {
  return (
    <RoleGate feature="revision">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ToolsMenu />
          </View>
          <Text style={styles.title}>Révisions</Text>
          <Text style={styles.subtitle}>
            Transforme ton programme en charge quotidienne réaliste — calcul transparent, sans IA.
          </Text>
        </View>
        <RevisionInner />
      </View>
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
  skeletonWrap: { padding: tokens.space.lg, gap: tokens.space.md },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  listContent: { padding: tokens.space.lg, gap: tokens.space.sm },
  emptyCard: {
    alignItems: 'center',
    gap: tokens.space.md,
    padding: tokens.space.xl,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surface,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    textAlign: 'center',
    maxWidth: 360,
  },
  listTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
  },
  muted: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.body.fontSize },
  error: { fontFamily: tokens.font.sans, color: tokens.colors.danger, fontSize: tokens.type.caption.fontSize },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    padding: tokens.space.md,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    ...tokens.elevation.sm,
  },
  planIcon: {
    width: 38,
    height: 38,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: { fontFamily: tokens.font.sans, color: tokens.colors.text, fontSize: tokens.type.body.fontSize, fontWeight: tokens.weight.semibold },
  planMeta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  deleteBtn: {
    width: tokens.size.iconButton,
    height: tokens.size.iconButton,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.dangerBackground,
  },
  newBtnWrap: { marginTop: tokens.space.sm },
});
