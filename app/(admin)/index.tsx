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
import { useEffect, useState, useCallback, type ComponentProps } from 'react';
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
import { BlogEditorModal } from '@/ui/admin/BlogEditorModal';
import { tokens } from '@/ui/tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
type Verbosity = 'low' | 'medium' | 'high';

interface ModelRow {
  key: string;
  model_id: string;
  provider: string;
  label: string;
  temperature: number | null;
  reasoning_effort: ReasoningEffort | null;
  verbosity: Verbosity | null;
  web_search: boolean;
  updated_at: string | null;
}

interface ModelCapabilities {
  temperature: boolean;
  reasoning: boolean;
  verbosity: boolean;
  webSearch: boolean;
}

interface AvailableModel {
  id: string;
  provider: string;
  label: string;
  capabilities: ModelCapabilities;
}

interface FeatureSettingsDraft {
  model_id: string;
  provider: string;
  temperature: number | null;
  reasoning_effort: ReasoningEffort | null;
  verbosity: Verbosity | null;
  web_search: boolean;
}

const REASONING_OPTIONS: ReasoningEffort[] = ['minimal', 'low', 'medium', 'high'];
const VERBOSITY_OPTIONS: Verbosity[] = ['low', 'medium', 'high'];
const TEMPERATURE_PRESETS = [0, 0.3, 0.7, 1, 1.5, 2];

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

type Tab = 'models' | 'prompts' | 'ecos' | 'blog';

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
  const [local, setLocal] = useState<Record<string, FeatureSettingsDraft>>({});

  useEffect(() => {
    const init: Record<string, FeatureSettingsDraft> = {};
    for (const m of config.models) {
      init[m.key] = {
        model_id: m.model_id,
        provider: m.provider,
        temperature: m.temperature,
        reasoning_effort: m.reasoning_effort,
        verbosity: m.verbosity,
        web_search: m.web_search,
      };
    }
    setLocal(init);
  }, [config.models]);

  function patch(key: string, changes: Partial<FeatureSettingsDraft>) {
    setLocal((prev) => ({ ...prev, [key]: { ...prev[key], ...changes } }));
  }

  function capabilitiesFor(modelId: string): ModelCapabilities {
    return (
      config.availableModels.find((m) => m.id === modelId)?.capabilities ?? {
        temperature: false,
        reasoning: false,
        verbosity: false,
        webSearch: false,
      }
    );
  }

  async function save(key: string) {
    const entry = local[key];
    if (!entry) return;
    const caps = capabilitiesFor(entry.model_id);
    setSaving(key);
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        // On n'envoie que les réglages supportés par le modèle (sinon null/false).
        body: JSON.stringify({
          type: 'model',
          key,
          model_id: entry.model_id,
          provider: entry.provider,
          temperature: caps.temperature ? entry.temperature : null,
          reasoning_effort: caps.reasoning ? entry.reasoning_effort : null,
          verbosity: caps.verbosity ? entry.verbosity : null,
          web_search: caps.webSearch ? entry.web_search : false,
        }),
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
        Sélectionne le modèle IA et ses réglages (raisonnement, verbosité, température, recherche
        internet) pour chaque fonctionnalité. Les options affichées dépendent du modèle choisi. Les
        changements s'appliquent immédiatement (cache 60 s).
      </Text>

      {AI_FEATURES.map((feature) => {
        const current = local[feature.key];
        if (!current) return null;

        const featureModels = config.availableModels.filter((m) =>
          feature.providers.includes(m.provider as any),
        );
        const caps = capabilitiesFor(current.model_id);
        const hasParams = caps.temperature || caps.reasoning || caps.verbosity || caps.webSearch;

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
                    onPress={() => patch(feature.key, { model_id: m.id, provider: m.provider })}
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

            {hasParams ? (
              <View style={paramStyles.section}>
                <Text style={paramStyles.sectionTitle}>Réglages de génération</Text>

                {caps.reasoning ? (
                  <View style={paramStyles.row}>
                    <Text style={paramStyles.rowLabel}>Raisonnement</Text>
                    <View style={paramStyles.segments}>
                      {REASONING_OPTIONS.map((opt) => {
                        const active = current.reasoning_effort === opt;
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[paramStyles.segment, active && paramStyles.segmentActive]}
                            onPress={() =>
                              patch(feature.key, { reasoning_effort: active ? null : opt })
                            }
                          >
                            <Text style={[paramStyles.segmentText, active && paramStyles.segmentTextActive]}>
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {caps.verbosity ? (
                  <View style={paramStyles.row}>
                    <Text style={paramStyles.rowLabel}>Verbosité</Text>
                    <View style={paramStyles.segments}>
                      {VERBOSITY_OPTIONS.map((opt) => {
                        const active = current.verbosity === opt;
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[paramStyles.segment, active && paramStyles.segmentActive]}
                            onPress={() => patch(feature.key, { verbosity: active ? null : opt })}
                          >
                            <Text style={[paramStyles.segmentText, active && paramStyles.segmentTextActive]}>
                              {opt === 'low' ? 'court' : opt === 'medium' ? 'moyen' : 'long'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {caps.temperature ? (
                  <View style={paramStyles.row}>
                    <Text style={paramStyles.rowLabel}>
                      Température{current.temperature != null ? ` · ${current.temperature}` : ' · défaut'}
                    </Text>
                    <View style={paramStyles.segments}>
                      {TEMPERATURE_PRESETS.map((t) => {
                        const active = current.temperature === t;
                        return (
                          <TouchableOpacity
                            key={t}
                            style={[paramStyles.segment, active && paramStyles.segmentActive]}
                            onPress={() => patch(feature.key, { temperature: active ? null : t })}
                          >
                            <Text style={[paramStyles.segmentText, active && paramStyles.segmentTextActive]}>
                              {t}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {caps.webSearch ? (
                  <TouchableOpacity
                    style={paramStyles.toggleRow}
                    onPress={() => patch(feature.key, { web_search: !current.web_search })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={paramStyles.rowLabel}>🌐 Recherche internet</Text>
                      <Text style={paramStyles.toggleHint}>
                        Autorise le modèle à chercher sur le web pendant la génération.
                      </Text>
                    </View>
                    <View style={[paramStyles.switch, current.web_search && paramStyles.switchOn]}>
                      <View style={[paramStyles.knob, current.web_search && paramStyles.knobOn]} />
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

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

// ── Onglet Cas ECOS (CRUD) ──────────────────────────────────────────────────────

interface EcosCaseRow {
  id: string;
  slug: string;
  title: string;
  specialty: string;
  level: string;
  duration_minutes: number;
  brief: string;
  patient_profile: { role_brief?: string } | null;
  grading_grid: { markdown?: string } | null;
  is_published: boolean;
}

interface EcosDraft {
  id?: string;
  title: string;
  slug: string;
  specialty: string;
  level: string;
  duration_minutes: string;
  brief: string;
  role_brief: string;
  grading_markdown: string;
  is_published: boolean;
}

const EMPTY_DRAFT: EcosDraft = {
  title: '',
  slug: '',
  specialty: '',
  level: 'DFASM',
  duration_minutes: '10',
  brief: '',
  role_brief: '',
  grading_markdown: '',
  is_published: false,
};

function rowToDraft(row: EcosCaseRow): EcosDraft {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    specialty: row.specialty,
    level: row.level,
    duration_minutes: String(row.duration_minutes ?? 10),
    brief: row.brief,
    role_brief: row.patient_profile?.role_brief ?? '',
    grading_markdown: row.grading_grid?.markdown ?? '',
    is_published: row.is_published,
  };
}

function EcosTab({ session }: { session: { access_token: string } | null }) {
  const [cases, setCases] = useState<EcosCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EcosDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    }),
    [session?.access_token],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ecos-cases', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur');
      const data = await res.json();
      setCases(data.cases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublish(row: EcosCaseRow) {
    await fetch('/api/admin/ecos-cases', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'publish', id: row.id, is_published: !row.is_published }),
    });
    load();
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ecos-cases', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          case: {
            id: draft.id,
            title: draft.title,
            slug: draft.slug,
            specialty: draft.specialty,
            level: draft.level,
            duration_minutes: Number(draft.duration_minutes),
            brief: draft.brief,
            patient_profile: { role_brief: draft.role_brief },
            grading_grid: { markdown: draft.grading_markdown },
            is_published: draft.is_published,
          },
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? 'Échec de la sauvegarde.');
        return;
      }
      setDraft(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: EcosCaseRow) {
    await fetch('/api/admin/ecos-cases', {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ id: row.id }),
    });
    if (draft?.id === row.id) setDraft(null);
    load();
  }

  // ── Vue formulaire (création / édition) ──────────────────────────────────
  if (draft) {
    const field = (key: keyof EcosDraft, value: string) =>
      setDraft((d) => (d ? { ...d, [key]: value } : d));

    return (
      <ScrollView contentContainerStyle={tabStyles.content}>
        <Text style={tabStyles.intro}>
          {draft.id ? 'Édition du cas ECOS.' : 'Nouveau cas ECOS.'} Le slug est généré depuis le
          titre s'il est laissé vide. Un cas non publié reste invisible des étudiants.
        </Text>

        <EcosInput label="Titre" value={draft.title} onChangeText={(v) => field('title', v)} />
        <EcosInput
          label="Slug (optionnel)"
          value={draft.slug}
          onChangeText={(v) => field('slug', v)}
          placeholder="généré depuis le titre"
        />
        <EcosInput
          label="Spécialité"
          value={draft.specialty}
          onChangeText={(v) => field('specialty', v)}
          placeholder="ex. Cardiologie · Urgences"
        />
        <View style={ecosStyles.row}>
          <View style={{ flex: 1 }}>
            <EcosInput label="Niveau" value={draft.level} onChangeText={(v) => field('level', v)} />
          </View>
          <View style={{ width: 110 }}>
            <EcosInput
              label="Durée (min)"
              value={draft.duration_minutes}
              onChangeText={(v) => field('duration_minutes', v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />
          </View>
        </View>
        <EcosInput
          label="Consigne candidat (brief)"
          value={draft.brief}
          onChangeText={(v) => field('brief', v)}
          multiline
        />
        <EcosInput
          label="Consigne patient IA (jeu de rôle)"
          value={draft.role_brief}
          onChangeText={(v) => field('role_brief', v)}
          multiline
          tall
        />
        <EcosInput
          label="Grille de correction (markdown)"
          value={draft.grading_markdown}
          onChangeText={(v) => field('grading_markdown', v)}
          multiline
          tall
        />

        <TouchableOpacity
          style={ecosStyles.publishToggle}
          onPress={() => setDraft((d) => (d ? { ...d, is_published: !d.is_published } : d))}
        >
          <View style={[ecosStyles.checkbox, draft.is_published && ecosStyles.checkboxOn]}>
            {draft.is_published ? <Text style={ecosStyles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={ecosStyles.publishLabel}>Publié (visible des étudiants)</Text>
        </TouchableOpacity>

        <View style={ecosStyles.formActions}>
          <TouchableOpacity style={ecosStyles.cancelBtn} onPress={() => setDraft(null)} disabled={saving}>
            <Text style={ecosStyles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ecosStyles.saveBtn} onPress={saveDraft} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={tokens.colors.onAccent} size="small" />
            ) : (
              <Text style={ecosStyles.saveBtnText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── Vue liste ────────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={tabStyles.content}>
      <Text style={tabStyles.intro}>
        Banque de cas ECOS (table <Text style={{ fontFamily: tokens.font.mono }}>ecos_cases</Text>).
        Crée, édite et publie les cas proposés aux étudiants.
      </Text>

      <TouchableOpacity style={ecosStyles.newBtn} onPress={() => setDraft({ ...EMPTY_DRAFT })}>
        <Text style={ecosStyles.newBtnText}>+ Nouveau cas</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={tokens.colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : cases.length === 0 ? (
        <Text style={ecosStyles.empty}>Aucun cas pour le moment.</Text>
      ) : (
        cases.map((row) => (
          <View key={row.id} style={ecosStyles.card}>
            <View style={ecosStyles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={ecosStyles.cardTitle}>{row.title}</Text>
                <Text style={ecosStyles.cardMeta}>
                  {row.specialty} · {row.duration_minutes} min · {row.slug}
                </Text>
              </View>
              <View
                style={[ecosStyles.statusBadge, row.is_published && ecosStyles.statusBadgeOn]}
              >
                <Text
                  style={[ecosStyles.statusText, row.is_published && ecosStyles.statusTextOn]}
                >
                  {row.is_published ? 'Publié' : 'Brouillon'}
                </Text>
              </View>
            </View>
            <View style={ecosStyles.cardActions}>
              <TouchableOpacity style={ecosStyles.actionBtn} onPress={() => togglePublish(row)}>
                <Text style={ecosStyles.actionText}>
                  {row.is_published ? 'Dépublier' : 'Publier'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={ecosStyles.actionBtn}
                onPress={() => setDraft(rowToDraft(row))}
              >
                <Text style={ecosStyles.actionText}>Éditer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ecosStyles.actionBtn, ecosStyles.actionBtnDanger]}
                onPress={() => remove(row)}
              >
                <Text style={[ecosStyles.actionText, ecosStyles.actionTextDanger]}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function EcosInput({
  label,
  multiline,
  tall,
  ...props
}: {
  label: string;
  multiline?: boolean;
  tall?: boolean;
} & ComponentProps<typeof TextInput>) {
  return (
    <View style={ecosStyles.inputWrap}>
      <Text style={ecosStyles.inputLabel}>{label}</Text>
      <TextInput
        style={[
          ecosStyles.input,
          multiline && ecosStyles.inputMultiline,
          tall && ecosStyles.inputTall,
        ]}
        placeholderTextColor={tokens.colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

// ── Blog : génération d'articles IA + publication (audit landing 2026-06) ─────

interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  cover_image_url: string | null;
  status: 'draft' | 'published';
  created_at: string;
  published_at: string | null;
}

function BlogTab({ session }: { session: { access_token: string } | null }) {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    }),
    [session?.access_token],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/blog', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur');
      setPosts((await res.json()).posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'generate', topic: topic.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Échec de la génération.');
      setTopic('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la génération.');
    } finally {
      setGenerating(false);
    }
  }

  async function togglePublish(row: BlogPostRow) {
    await fetch('/api/admin/blog', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'publish', id: row.id, publish: row.status !== 'published' }),
    });
    load();
  }

  async function remove(row: BlogPostRow) {
    await fetch('/api/admin/blog', {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ id: row.id }),
    });
    load();
  }

  return (
    <ScrollView contentContainerStyle={tabStyles.content}>
      <Text style={tabStyles.intro}>
        Génère un article santé complet (titre, chapeau, sections « ## » pour le sommaire
        cliquable, image de couverture si la clé OpenAI est configurée). L'article arrive en
        brouillon : ouvre-le avec « Modifier » pour le relire en aperçu, ajuster le texte et
        les images (remplacer la couverture par une vraie photo, en insérer dans le corps),
        puis publie-le — seuls les articles publiés sont visibles sur le blog public. Un
        article reste modifiable après publication.
      </Text>

      <View style={blogStyles.generateCard}>
        <Text style={blogStyles.generateLabel}>Sujet (optionnel — sinon l'IA choisit)</Text>
        <TextInput
          style={blogStyles.topicInput}
          value={topic}
          onChangeText={setTopic}
          placeholder="ex. Le microbiote intestinal, les vaccins ARNm, le sommeil des ados…"
          placeholderTextColor={tokens.colors.textMuted}
          editable={!generating}
        />
        <TouchableOpacity
          style={[blogStyles.generateBtn, generating && blogStyles.generateBtnDisabled]}
          onPress={generate}
          disabled={generating}
          accessibilityRole="button"
        >
          {generating ? <ActivityIndicator size="small" color={tokens.colors.onAccent} /> : null}
          <Text style={blogStyles.generateBtnText}>
            {generating ? 'Génération en cours (1 à 2 min)…' : '📰 Générer un article'}
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={blogStyles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={tokens.colors.accent} style={{ marginTop: tokens.space.lg }} />
      ) : (
        posts.map((p) => (
          <View key={p.id} style={blogStyles.postRow}>
            <View style={blogStyles.postInfo}>
              <View style={blogStyles.postMetaRow}>
                <View
                  style={[
                    blogStyles.statusPill,
                    p.status === 'published' ? blogStyles.statusPublished : blogStyles.statusDraft,
                  ]}
                >
                  <Text
                    style={[
                      blogStyles.statusText,
                      p.status === 'published' ? blogStyles.statusTextPublished : blogStyles.statusTextDraft,
                    ]}
                  >
                    {p.status === 'published' ? 'Publié' : 'Brouillon'}
                  </Text>
                </View>
                {p.category ? <Text style={blogStyles.postCategory}>{p.category}</Text> : null}
                {!p.cover_image_url ? <Text style={blogStyles.noCover}>sans image</Text> : null}
              </View>
              <Text style={blogStyles.postTitle} numberOfLines={2}>
                {p.title}
              </Text>
            </View>
            <View style={blogStyles.postActions}>
              {/* La page publique ne voit que les articles publiés (RLS) : pour un
                  brouillon, la relecture passe par l'aperçu de l'éditeur admin. */}
              <TouchableOpacity style={blogStyles.actionBtn} onPress={() => setEditingId(p.id)}>
                <Text style={blogStyles.actionText}>
                  {p.status === 'published' ? 'Modifier' : 'Relire / modifier'}
                </Text>
              </TouchableOpacity>
              {p.status === 'published' ? (
                <TouchableOpacity
                  style={blogStyles.actionBtn}
                  onPress={() => router.push(`/(marketing)/blog/${p.slug}` as never)}
                >
                  <Text style={blogStyles.actionText}>Voir en ligne</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={blogStyles.actionBtn} onPress={() => togglePublish(p)}>
                <Text style={blogStyles.actionText}>
                  {p.status === 'published' ? 'Dépublier' : 'Publier'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={blogStyles.actionBtn} onPress={() => remove(p)}>
                <Text style={blogStyles.actionDanger}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
      {!loading && posts.length === 0 ? (
        <Text style={blogStyles.empty}>Aucun article pour l'instant — génère le premier !</Text>
      ) : null}

      {editingId && session?.access_token ? (
        <BlogEditorModal
          postId={editingId}
          accessToken={session.access_token}
          onClose={(changed) => {
            setEditingId(null);
            if (changed) load();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const blogStyles = StyleSheet.create({
  generateCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
  },
  generateLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  topicInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm + 2,
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.sm,
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentVivid,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.sm + 2,
  },
  generateBtnDisabled: { opacity: 0.7 },
  generateBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  error: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.label.fontSize,
    marginTop: tokens.space.sm,
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.md,
    marginTop: tokens.space.sm,
  },
  postInfo: { flex: 1, gap: 4 },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, flexWrap: 'wrap' },
  statusPill: { borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.sm, paddingVertical: 2 },
  statusPublished: { backgroundColor: tokens.colors.successBackground },
  statusDraft: { backgroundColor: tokens.colors.warningBackground },
  statusText: { fontFamily: tokens.font.sans, fontSize: 11, fontWeight: tokens.weight.bold },
  statusTextPublished: { color: tokens.colors.success },
  statusTextDraft: { color: tokens.colors.warningText },
  postCategory: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: 11.5 },
  noCover: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: 11.5, fontStyle: 'italic' },
  postTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  postActions: { gap: 4, alignItems: 'flex-end' },
  actionBtn: { paddingVertical: 2, paddingHorizontal: tokens.space.sm },
  actionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  actionDanger: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.danger,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  empty: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    marginTop: tokens.space.lg,
  },
});

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
            📝 Prompts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'ecos' && styles.tabBtnActive]}
          onPress={() => setTab('ecos')}
        >
          <Text style={[styles.tabLabel, tab === 'ecos' && styles.tabLabelActive]}>
            🩺 Cas ECOS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'blog' && styles.tabBtnActive]}
          onPress={() => setTab('blog')}
        >
          <Text style={[styles.tabLabel, tab === 'blog' && styles.tabLabelActive]}>
            📰 Blog
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'ecos' ? (
        <EcosTab session={session} />
      ) : tab === 'blog' ? (
        <BlogTab session={session} />
      ) : loading ? (
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

const paramStyles = StyleSheet.create({
  section: {
    paddingHorizontal: tokens.space.md,
    paddingBottom: tokens.space.md,
    gap: tokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.space.md,
  },
  sectionTitle: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  row: { gap: tokens.space.xs },
  rowLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  segments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.xs,
  },
  segment: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  segmentActive: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurface,
  },
  segmentText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 12,
    fontWeight: tokens.weight.medium,
  },
  segmentTextActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    marginTop: tokens.space.xs,
  },
  toggleHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.colors.borderStrong,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: tokens.colors.accent },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.onAccent,
    alignSelf: 'flex-start',
  },
  knobOn: { alignSelf: 'flex-end' },
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

const ecosStyles = StyleSheet.create({
  newBtn: {
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
  empty: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    textAlign: 'center',
    paddingVertical: tokens.space.xl,
  },
  card: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.md,
    ...tokens.elevation.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.md },
  cardTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  cardMeta: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  statusBadgeOn: {
    backgroundColor: tokens.colors.accentSurface,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  statusText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 10,
    fontWeight: tokens.weight.semibold,
  },
  statusTextOn: { color: tokens.colors.accentDeep },
  cardActions: { flexDirection: 'row', gap: tokens.space.sm },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDanger: { borderColor: tokens.colors.danger },
  actionText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  actionTextDanger: { color: tokens.colors.danger },
  row: { flexDirection: 'row', gap: tokens.space.md },
  inputWrap: { gap: tokens.space.xs },
  inputLabel: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: tokens.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    color: tokens.colors.text,
    minHeight: 44,
  },
  inputMultiline: { minHeight: 90, paddingTop: tokens.space.sm },
  inputTall: { minHeight: 160 },
  publishToggle: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: tokens.radius.sm,
    borderWidth: 2,
    borderColor: tokens.colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  checkboxMark: { color: tokens.colors.onAccent, fontSize: 14, fontWeight: tokens.weight.bold },
  publishLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
  },
  formActions: { flexDirection: 'row', gap: tokens.space.md, marginTop: tokens.space.sm },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontWeight: tokens.weight.medium,
    fontSize: tokens.type.label.fontSize,
  },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },
});
