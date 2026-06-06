import { describe, it, expect } from 'vitest';

/**
 * Tests de la logique pure de versionnement des prompts (migration 0016).
 * Aucun réseau : on utilise un store en mémoire qui implémente PromptHistoryStore.
 */
import {
  bumpPatch,
  savePromptWithHistory,
  restorePromptVersion,
  INITIAL_VERSION,
  type PromptHistoryStore,
  type PromptRecord,
  type HistoryRecord,
} from '@/ai/prompts/promptHistory';

/** Store en mémoire : une ligne courante par key + un tableau d'historique. */
function memoryStore(): PromptHistoryStore & { prompts: Map<string, PromptRecord>; history: HistoryRecord[] } {
  const prompts = new Map<string, PromptRecord>();
  const history: HistoryRecord[] = [];
  let clock = 0;
  return {
    prompts,
    history,
    async getPrompt(key) {
      return prompts.get(key) ?? null;
    },
    async upsertPrompt(record) {
      prompts.set(record.key, { ...record });
    },
    async insertHistory(record) {
      // created_at monotone pour un tri déterministe (récent → ancien).
      history.push({ ...record, created_at: new Date(++clock * 1000).toISOString() });
    },
    async listHistory(key) {
      return history
        .filter((h) => h.key === key)
        .sort((a, b) => (a.created_at! < b.created_at! ? 1 : -1));
    },
  };
}

const META = { label: 'L', scope: 'S', author: 'admin-1' };

describe('bumpPatch', () => {
  it('incrémente le patch', () => {
    expect(bumpPatch('1.0.0')).toBe('1.0.1');
    expect(bumpPatch('2.3.9')).toBe('2.3.10');
  });

  it('tolère une version absente ou malformée', () => {
    expect(bumpPatch(null)).toBe('1.0.1');
    expect(bumpPatch('')).toBe('1.0.1');
    expect(bumpPatch('abc')).toBe('1.0.1');
  });
});

describe('savePromptWithHistory', () => {
  it('premier save : version initiale, aucun snapshot', async () => {
    const store = memoryStore();
    const res = await savePromptWithHistory(store, { key: 'public', template: 'v1', ...META });

    expect(res.version).toBe(INITIAL_VERSION);
    expect(res.snapshotted).toBe(false);
    expect(store.history).toHaveLength(0);
    expect(store.prompts.get('public')!.template).toBe('v1');
  });

  it('save suivant : snapshot de l\'ancienne version + bump patch', async () => {
    const store = memoryStore();
    await savePromptWithHistory(store, { key: 'public', template: 'v1', ...META });
    const res = await savePromptWithHistory(store, { key: 'public', template: 'v2', ...META });

    expect(res.version).toBe('1.0.1');
    expect(res.snapshotted).toBe(true);
    // L'historique contient l'ancienne version (1.0.0 / v1), pas la nouvelle.
    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({ version: '1.0.0', template: 'v1', author: 'admin-1' });
    expect(store.prompts.get('public')!.template).toBe('v2');
    expect(store.prompts.get('public')!.version).toBe('1.0.1');
  });

  it('saves multiples : versions monotones et historique complet', async () => {
    const store = memoryStore();
    await savePromptWithHistory(store, { key: 'public', template: 'v1', ...META });
    await savePromptWithHistory(store, { key: 'public', template: 'v2', ...META });
    await savePromptWithHistory(store, { key: 'public', template: 'v3', ...META });

    expect(store.prompts.get('public')!.version).toBe('1.0.2');
    const versions = (await store.listHistory('public')).map((h) => h.version);
    expect(versions).toEqual(['1.0.1', '1.0.0']); // récent → ancien
  });
});

describe('restorePromptVersion', () => {
  it('restaure le template d\'une version historique sous un nouveau numéro', async () => {
    const store = memoryStore();
    await savePromptWithHistory(store, { key: 'public', template: 'v1', ...META }); // 1.0.0
    await savePromptWithHistory(store, { key: 'public', template: 'v2', ...META }); // 1.0.1
    await savePromptWithHistory(store, { key: 'public', template: 'v3', ...META }); // 1.0.2

    // Restaure le template de la v1.0.0 (« v1 »).
    const res = await restorePromptVersion(store, { key: 'public', version: '1.0.0', ...META });

    // Nouveau numéro (pas de réutilisation de l'ancien), template restauré.
    expect(res.version).toBe('1.0.3');
    expect(res.template).toBe('v1');
    expect(store.prompts.get('public')!.template).toBe('v1');
    expect(store.prompts.get('public')!.version).toBe('1.0.3');
  });

  it('snapshot la version courante avant de restaurer', async () => {
    const store = memoryStore();
    await savePromptWithHistory(store, { key: 'public', template: 'v1', ...META }); // 1.0.0
    await savePromptWithHistory(store, { key: 'public', template: 'v2', ...META }); // 1.0.1 (history: 1.0.0)

    await restorePromptVersion(store, { key: 'public', version: '1.0.0', ...META });

    // La version courante 1.0.1 (« v2 ») doit avoir été archivée.
    const archived = await store.listHistory('public');
    expect(archived.map((h) => h.version)).toContain('1.0.1');
    expect(archived.find((h) => h.version === '1.0.1')!.template).toBe('v2');
  });

  it('échoue si la version demandée n\'existe pas', async () => {
    const store = memoryStore();
    await savePromptWithHistory(store, { key: 'public', template: 'v1', ...META });

    await expect(
      restorePromptVersion(store, { key: 'public', version: '9.9.9', ...META }),
    ).rejects.toThrow(/introuvable/);
  });
});
