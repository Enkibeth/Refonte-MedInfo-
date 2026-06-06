/**
 * Versionnement des system prompts (table ai_prompts + ai_prompts_history, migrations
 * 0012 / 0016).
 *
 * Ce module contient la LOGIQUE PURE de snapshot / bump semver / restore, isolée de
 * Supabase via l'interface `PromptHistoryStore`. Cela permet de la tester sans réseau
 * (cf tests/unit/prompt-history.test.ts) et de réutiliser un adaptateur réel côté API.
 */

/** Version semver initiale d'un prompt (alignée sur le DEFAULT de ai_prompts, 0012). */
export const INITIAL_VERSION = '1.0.0';

/**
 * Incrémente le patch d'une version semver (`1.2.3` → `1.2.4`).
 * Tolère une version absente/malformée en repartant de la version initiale.
 */
export function bumpPatch(version: string | null | undefined): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec((version ?? '').trim());
  if (!match) {
    // Version inconnue : on bump le patch de la version initiale plutôt que d'échouer.
    const [major, minor, patch] = INITIAL_VERSION.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

// ── Types ───────────────────────────────────────────────────────────────────

/** Ligne courante d'un prompt (table ai_prompts). */
export interface PromptRecord {
  key: string;
  label: string;
  scope: string;
  template: string;
  version: string;
}

/** Snapshot immuable d'une version (table ai_prompts_history). */
export interface HistoryRecord {
  key: string;
  template: string;
  version: string;
  author: string | null;
  created_at?: string;
}

/**
 * Abstraction d'accès aux données. L'API fournit un adaptateur Supabase ;
 * les tests fournissent un store en mémoire.
 */
export interface PromptHistoryStore {
  getPrompt(key: string): Promise<PromptRecord | null>;
  upsertPrompt(record: PromptRecord): Promise<void>;
  insertHistory(record: HistoryRecord): Promise<void>;
  listHistory(key: string): Promise<HistoryRecord[]>;
}

export interface SavePromptInput {
  key: string;
  template: string;
  label: string;
  scope: string;
  author: string | null;
}

export interface SavePromptResult {
  version: string;
  snapshotted: boolean;
}

/**
 * Sauvegarde un prompt en versionnant :
 *  1. si une version existe déjà, on la snapshot dans l'historique (immuable) ;
 *  2. la nouvelle version courante reçoit un patch bump (ou la version initiale au 1er save).
 */
export async function savePromptWithHistory(
  store: PromptHistoryStore,
  input: SavePromptInput,
): Promise<SavePromptResult> {
  const existing = await store.getPrompt(input.key);

  let snapshotted = false;
  if (existing) {
    await store.insertHistory({
      key: existing.key,
      template: existing.template,
      version: existing.version,
      author: input.author,
    });
    snapshotted = true;
  }

  const nextVersion = existing ? bumpPatch(existing.version) : INITIAL_VERSION;

  await store.upsertPrompt({
    key: input.key,
    label: input.label,
    scope: input.scope,
    template: input.template,
    version: nextVersion,
  });

  return { version: nextVersion, snapshotted };
}

export interface RestorePromptInput {
  key: string;
  version: string;
  label: string;
  scope: string;
  author: string | null;
}

export interface RestorePromptResult {
  version: string;
  template: string;
}

/**
 * Restaure le template d'une version historique. Comme un revert git, on ne réutilise
 * pas l'ancien numéro : la version courante est d'abord snapshotée, puis le template
 * restauré devient une NOUVELLE version (patch bump) — l'historique reste monotone.
 */
export async function restorePromptVersion(
  store: PromptHistoryStore,
  input: RestorePromptInput,
): Promise<RestorePromptResult> {
  const history = await store.listHistory(input.key);
  const target = history.find((h) => h.version === input.version);
  if (!target) {
    throw new Error(`Version ${input.version} introuvable pour le prompt ${input.key}.`);
  }

  const current = await store.getPrompt(input.key);
  if (current) {
    await store.insertHistory({
      key: current.key,
      template: current.template,
      version: current.version,
      author: input.author,
    });
  }

  const nextVersion = bumpPatch(current?.version ?? target.version);

  await store.upsertPrompt({
    key: input.key,
    label: input.label,
    scope: input.scope,
    template: target.template,
    version: nextVersion,
  });

  return { version: nextVersion, template: target.template };
}
