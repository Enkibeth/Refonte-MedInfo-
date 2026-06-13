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
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { Icon } from '@/ui/icons';
import { RoleGate } from '@/ui/RoleGate';
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
import type { RevisionItem } from '@/features/revision/engine/types';
import { RevisionDashboard } from '@/features/revision/components/RevisionDashboard';
import { PlanEditor } from '@/features/revision/components/PlanEditor';

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

  // Cocher une tâche : on met à jour l'état local immédiatement puis on persiste.
  async function handleItemsChange(items: RevisionItem[]) {
    if (!current || !token) return;
    const next = { ...current, items };
    setCurrent(next);
    try {
      await savePlan(token, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sauvegarde de la progression impossible.');
    }
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
      <View style={styles.center}>
        <ActivityIndicator color={tokens.colors.accent} />
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
        onItemsChange={handleItemsChange}
        onEdit={() => setView('editor')}
        onBack={() => {
          setCurrent(null);
          void refresh();
        }}
      />
    );
  }

  // Liste des plans
  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      <Text style={styles.listTitle}>Mes plans de révision</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {plans.length === 0 ? (
        <Text style={styles.muted}>Aucun plan pour l’instant.</Text>
      ) : (
        plans.map((p) => (
          <Pressable key={p.id} onPress={() => openPlan(p.id)} style={styles.planRow}>
            <View style={styles.planIcon}>
              <Icon name="calendarCheck" size={18} color={tokens.colors.accentDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>{p.title || 'Plan de révision'}</Text>
              <Text style={styles.planMeta}>
                {EXAM_LABELS[p.examType] ?? p.examType} · examen le {p.examDate}
              </Text>
            </View>
            <Pressable onPress={() => handleDelete(p.id)} style={styles.deleteBtn} accessibilityLabel="Supprimer">
              <Icon name="trash" size={16} color={tokens.colors.danger} />
            </Pressable>
          </Pressable>
        ))
      )}
      <Pressable
        onPress={() => {
          setCurrent(null);
          setView('editor');
        }}
        style={styles.newBtn}
      >
        <Icon name="plus" size={16} color={tokens.colors.onAccent} />
        <Text style={styles.newBtnText}>Nouveau plan</Text>
      </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: tokens.space.lg, gap: tokens.space.sm },
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
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    marginTop: tokens.space.sm,
  },
  newBtnText: { fontFamily: tokens.font.sans, color: tokens.colors.onAccent, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold },
});
