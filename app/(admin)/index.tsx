/**
 * Panel d'administration IA — visible uniquement pour les comptes admin.
 *
 * ⚠️  CONVENTION : toute nouvelle fonctionnalité IA DOIT être déclarée dans
 * src/admin/index.ts (AI_FEATURES) et dans la migration SQL ai_model_config.
 * Ce panel la reflètera automatiquement.
 *
 * Fonctionnalités :
 *  - Onglet "Modèles" : changer le modèle IA par fonctionnalité
 *  - Onglet "Prompts" : éditer les system prompts en direct (Supabase override)
 */
import { useEffect, useState, useCallback } from 'react';
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
import { useRouter } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId, AI_FEATURES } from '@/admin/index';
import { tokens } from '@/ui/tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModelRow {
  key: string;
  model_id: string;
  provider: string;
  label: string;
  updated_at: string | null;
}

interface AvailableModel {
  id: string;
  provider: string;
  label: string;
}

interface PromptRow {
  key: string;
  label: string;
  scope: string;
  template: string;
  isOverridden: boolean;
  updated_at: string | null;
}

interface Config {
  models: ModelRow[];
  availableModels: AvailableModel[];
  prompts: PromptRow[];
}

type Tab = 'models' | 'prompts';

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#C96442',
  openai:    '#10A37F',
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai:    'OpenAI',
};

// ── Sous-composants ───────────────────────────────────────────────────────────

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[badgeStyles.wrap, { borderColor: color + '40', backgroundColor: color + '15' }]}>
      <Text style={[badgeStyles.text, { color }]}>{text}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={sectionStyles.header}>
      <Text style={sectionStyles.title}>{title}</Text>
    </View>
  );
}

// ── Onglet Modèles ────────────────────────────────────────────────────────────

function ModelsTab({
  config,
  session,
  onSaved,
}: {
  config: Config;
  session: { access_token: string } | null;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, { model_id: string; provider: string }>>({});

  useEffect(() => {
    const init: Record<string, { model_id: string; provider: string }> = {};
    for (const m of config.models) init[m.key] = { model_id: m.model_id, provider: m.provider };
    setLocal(init);
  }, [config.models]);

  async function save(key: string) {
    const entry = local[key];
    if (!entry) return;
    setSaving(key);
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ type: 'model', key, ...entry }),
      });
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
      onSaved();
    } finally {
      setSaving(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={tabStyles.content}>
      <Text style={tabStyles.intro}>
        Sélectionne le modèle IA pour chaque fonctionnalité. Les changements s'appliquent immédiatement
        (cache 60 s).
      </Text>

      {AI_FEATURES.map((feature) => {
        const current = local[feature.key];
        if (!current) return null;

        const featureModels = config.availableModels.filter((m) =>
          feature.providers.includes(m.provider as any),
        );

        return (
          <View key={feature.key} style={cardStyles.card}>
            <View style={cardStyles.cardHeader}>
              <Text style={cardStyles.emoji}>{feature.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={cardStyles.cardTitle}>{feature.label}</Text>
                <Text style={cardStyles.cardDesc}>{feature.description}</Text>
              </View>
              <Badge
                text={PROVIDER_LABELS[current.provider] ?? current.provider}
                color={PROVIDER_COLORS[current.provider] ?? tokens.colors.accent}
              />
            </View>

            <View style={cardStyles.models}>
              {featureModels.map((m) => {
                const isSelected = current.model_id === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[modelStyles.option, isSelected && modelStyles.selected]}
                    onPress={() =>
                      setLocal((prev) => ({
                        ...prev,
                        [feature.key]: { model_id: m.id, provider: m.provider },
                      }))
                    }
                  >
                    <View style={[modelStyles.radio, isSelected && modelStyles.radioSelected]} />
                    <View>
                      <Text style={[modelStyles.label, isSelected && modelStyles.labelSelected]}>
                        {m.label}
                      </Text>
                      <Text style={modelStyles.provider}>
                        {PROVIDER_LABELS[m.provider] ?? m.provider}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                cardStyles.saveBtn,
                saving === feature.key && cardStyles.saveBtnLoading,
                saved === feature.key && cardStyles.saveBtnSaved,
              ]}
              onPress={() => save(feature.key)}
              disabled={saving !== null}
            >
              {saving === feature.key ? (
                <ActivityIndicator color={tokens.colors.onAccent} size="small" />
              ) : (
                <Text style={cardStyles.saveBtnText}>
                  {saved === feature.key ? '✓ Sauvegardé' : 'Appliquer'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Onglet Prompts ────────────────────────────────────────────────────────────

function PromptsTab({
  config,
  session,
  onSaved,
}: {
  config: Config;
  session: { access_token: string } | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const p of config.prompts) init[p.key] = p.template;
    setDrafts(init);
  }, [config.prompts]);

  async function savePrompt(key: string) {
    setSaving(key);
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ type: 'prompt', key, template: drafts[key] }),
      });
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
      onSaved();
    } finally {
      setSaving(null);
    }
  }

  async function resetPrompt(key: string) {
    setSaving(key);
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ type: 'reset_prompt', key }),
      });
      onSaved();
    } finally {
      setSaving(null);
      setEditing(null);
    }
  }

  // Group by scope
  const grouped: Record<string, PromptRow[]> = {};
  for (const p of config.prompts) {
    if (!grouped[p.scope]) grouped[p.scope] = [];
    grouped[p.scope].push(p);
  }

  return (
    <ScrollView contentContainerStyle={tabStyles.content}>
      <Text style={tabStyles.intro}>
        Édite les system prompts directement. Les modifications sont stockées dans Supabase et s'appliquent
        immédiatement (cache 60 s). Le code source sert de valeur par défaut.
      </Text>

      {Object.entries(grouped).map(([scope, prompts]) => (
        <View key={scope}>
          <SectionHeader title={scope} />
          {prompts.map((p) => {
            const isOpen = editing === p.key;
            return (
              <View key={p.key} style={promptStyles.card}>
                <TouchableOpacity
                  style={promptStyles.header}
                  onPress={() => setEditing(isOpen ? null : p.key)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={promptStyles.label}>{p.label}</Text>
                    <Text style={promptStyles.meta}>
                      {p.isOverridden
                        ? `Modifié ${p.updated_at ? new Date(p.updated_at).toLocaleDateString('fr') : ''}`
                        : 'Valeur par défaut (code)'}
                    </Text>
                  </View>
                  <View style={[promptStyles.badge, p.isOverridden && promptStyles.badgeOverridden]}>
                    <Text style={promptStyles.badgeText}>
                      {p.isOverridden ? 'Personnalisé' : 'Défaut'}
                    </Text>
                  </View>
                  <Text style={promptStyles.chevron}>{isOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isOpen ? (
                  <View style={promptStyles.editor}>
                    <TextInput
                      style={promptStyles.textarea}
                      value={drafts[p.key] ?? p.template}
                      onChangeText={(v) => setDrafts((prev) => ({ ...prev, [p.key]: v }))}
                      multiline
                      textAlignVertical="top"
                      autoCorrect={false}
                      spellCheck={false}
                      placeholderTextColor={tokens.colors.textMuted}
                    />
                    <View style={promptStyles.actions}>
                      {p.isOverridden ? (
                        <TouchableOpacity
                          style={promptStyles.resetBtn}
                          onPress={() => resetPrompt(p.key)}
                          disabled={saving !== null}
                        >
                          <Text style={promptStyles.resetBtnText}>↩ Remettre défaut</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={[
                          promptStyles.saveBtn,
                          saved === p.key && promptStyles.saveBtnSaved,
                        ]}
                        onPress={() => savePrompt(p.key)}
                        disabled={saving !== null}
                      >
                        {saving === p.key ? (
                          <ActivityIndicator color={tokens.colors.onAccent} size="small" />
                        ) : (
                          <Text style={promptStyles.saveBtnText}>
                            {saved === p.key ? '✓ Sauvegardé' : 'Sauvegarder'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────

export default function AdminScreen() {
  const { user, session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('models');
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vérification admin côté client (le serveur revérifie dans chaque API call)
  const isAdmin = user ? isAdminUserId(user.id) : false;

  const loadConfig = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/config', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur');
      setConfig(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (isAdmin) loadConfig();
  }, [isAdmin, loadConfig]);

  if (!isAdmin) {
    return (
      <View style={styles.notAdmin}>
        <Text style={styles.notAdminText}>Accès réservé aux administrateurs.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Panel Admin IA</Text>
          <Text style={styles.headerSub}>Configuration des modèles et prompts</Text>
        </View>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'models' && styles.tabBtnActive]}
          onPress={() => setTab('models')}
        >
          <Text style={[styles.tabLabel, tab === 'models' && styles.tabLabelActive]}>
            🤖 Modèles IA
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'prompts' && styles.tabBtnActive]}
          onPress={() => setTab('prompts')}
        >
          <Text style={[styles.tabLabel, tab === 'prompts' && styles.tabLabelActive]}>
            📝 Prompts système
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={tokens.colors.accent} size="large" />
          <Text style={styles.loadingText}>Chargement de la configuration…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadConfig} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : config ? (
        tab === 'models' ? (
          <ModelsTab config={config} session={session} onSaved={loadConfig} />
        ) : (
          <PromptsTab config={config} session={session} onSaved={loadConfig} />
        )
      ) : null}
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.xl,
    paddingBottom: tokens.space.md,
    backgroundColor: tokens.colors.accentDarker,
  },
  backBtn: { padding: tokens.space.xs },
  backBtnText: { color: tokens.colors.onAccent, fontSize: 22 },
  headerTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.type.h3.letterSpacing,
  },
  headerSub: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.6)',
    fontSize: tokens.type.caption.fontSize,
    marginTop: 2,
  },
  adminBadge: {
    marginLeft: 'auto',
    borderRadius: tokens.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  adminBadgeText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.onAccent,
    fontSize: 11,
    fontWeight: tokens.weight.bold,
    letterSpacing: 1,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: tokens.space.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: tokens.colors.accent },
  tabLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  tabLabelActive: { color: tokens.colors.accent, fontWeight: tokens.weight.semibold },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.space.lg },
  loadingText: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.label.fontSize },
  errorBox: {
    margin: tokens.space.lg,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.dangerBackground,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.danger,
    padding: tokens.space.lg,
    gap: tokens.space.md,
  },
  errorText: { fontFamily: tokens.font.sans, color: tokens.colors.danger, fontSize: tokens.type.label.fontSize },
  retryBtn: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.danger,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
  },
  retryText: { fontFamily: tokens.font.sans, color: tokens.colors.onAccent, fontWeight: tokens.weight.semibold, fontSize: tokens.type.label.fontSize },
  notAdmin: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.space.lg },
  notAdminText: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.body.fontSize },
  back: { fontFamily: tokens.font.sans, color: tokens.colors.accent, fontSize: tokens.type.label.fontSize, fontWeight: tokens.weight.semibold },
});

const tabStyles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.md },
  intro: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
    backgroundColor: tokens.colors.accentSurface,
    borderRadius: tokens.radius.md,
    padding: tokens.space.md,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.accent,
  },
});

const sectionStyles = StyleSheet.create({
  header: {
    marginTop: tokens.space.md,
    marginBottom: tokens.space.xs,
    paddingHorizontal: tokens.space.xs,
  },
  title: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    overflow: 'hidden',
    ...tokens.elevation.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space.md,
    padding: tokens.space.lg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  emoji: { fontSize: 22, marginTop: 2 },
  cardTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  cardDesc: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  models: { padding: tokens.space.md, gap: tokens.space.sm },
  saveBtn: {
    margin: tokens.space.md,
    marginTop: 0,
    height: 40,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnLoading: { opacity: 0.7 },
  saveBtnSaved: { backgroundColor: tokens.colors.success },
  saveBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
});

const modelStyles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    padding: tokens.space.md,
  },
  selected: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurface,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: tokens.colors.borderStrong,
  },
  radioSelected: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accent,
  },
  label: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  labelSelected: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  provider: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
});

const promptStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    overflow: 'hidden',
    ...tokens.elevation.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
  },
  label: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  meta: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  badgeOverridden: {
    backgroundColor: tokens.colors.accentSurface,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  badgeText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 10,
    fontWeight: tokens.weight.semibold,
  },
  chevron: { color: tokens.colors.textMuted, fontSize: 12 },
  editor: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  textarea: {
    fontFamily: tokens.font.mono,
    fontSize: 13,
    color: tokens.colors.text,
    lineHeight: 20,
    padding: tokens.space.lg,
    minHeight: 260,
    maxHeight: 480,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    ...Platform.select({ web: { resize: 'vertical' } as any, default: {} }),
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.space.sm,
    padding: tokens.space.md,
  },
  resetBtn: {
    height: 36,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    paddingHorizontal: tokens.space.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  saveBtn: {
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
  },
  saveBtnSaved: { backgroundColor: tokens.colors.success },
  saveBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
});

const badgeStyles = StyleSheet.create({
  wrap: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  text: {
    fontFamily: tokens.font.mono,
    fontSize: 10,
    fontWeight: tokens.weight.bold,
  },
});
