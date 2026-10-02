/**
 * Archivage serveur de la réponse du chat (src/chat/serverHistory.ts) — surtout `replaceLast`.
 *
 * Régression corrigée (2026-10) : « Réessayer » après un tour resté SANS réponse envoie
 * `regenerate`. L'ancien code supprimait alors « la dernière réponse assistant » de la
 * conversation… c'est-à-dire celle du tour PRÉCÉDENT, perdue définitivement.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { saveAssistantMessageServer } from '@/chat/serverHistory';

type Row = Record<string, unknown> & { id: string };

/** Client Supabase en mémoire : juste les requêtes qu'emploie saveAssistantMessageServer. */
function fakeSupabase(tables: Record<string, Row[]>) {
  let clock = 0;
  const client = {
    from(table: string) {
      const rows = tables[table];
      const filters: Array<[string, unknown]> = [];
      let order: { column: string; ascending: boolean } | null = null;
      let limit = Infinity;
      let mode: 'select' | 'delete' | 'update' = 'select';
      let patch: Record<string, unknown> = {};
      const matching = () => {
        let found = rows.filter((row) => filters.every(([column, value]) => row[column] === value));
        if (order) {
          const { column, ascending } = order;
          found = [...found].sort((a, b) => ((a[column] as number) - (b[column] as number)) * (ascending ? 1 : -1));
        }
        return found.slice(0, limit);
      };
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => (filters.push([column, value]), builder),
        order: (column: string, { ascending }: { ascending: boolean }) => ((order = { column, ascending }), builder),
        limit: (n: number) => ((limit = n), builder),
        maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
        delete: () => ((mode = 'delete'), builder),
        update: (values: Record<string, unknown>) => ((mode = 'update'), (patch = values), builder),
        insert: async (row: Record<string, unknown>) => {
          rows.push({ id: `new-${rows.length}`, created_at: ++clock + 1000, ...row });
          return { error: null };
        },
        then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => {
          for (const row of matching()) {
            if (mode === 'delete') rows.splice(rows.indexOf(row), 1);
            if (mode === 'update') Object.assign(row, patch);
          }
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

const CONV = 'c0a99d20-0000-4000-8000-000000000001';

function conversation(messages: Array<[string, 'user' | 'assistant']>) {
  return {
    chat_conversations: [{ id: CONV, user_id: 'hugo' }],
    chat_messages: messages.map(([id, role], i) => ({ id, conversation_id: CONV, role, created_at: i + 1 })),
  } as Record<string, Row[]>;
}

const ids = (tables: Record<string, Row[]>) => tables.chat_messages.map((m) => `${m.role}:${m.content ?? m.id}`);

describe('saveAssistantMessageServer — replaceLast ne remplace que la réponse du dernier tour', () => {
  it('régénérer une réponse existante la remplace (pas de doublon dans l’historique)', async () => {
    const db = conversation([['u1', 'user'], ['a1', 'assistant'], ['u2', 'user'], ['a2', 'assistant']]);
    await saveAssistantMessageServer(fakeSupabase(db), {
      conversationId: CONV, userId: 'hugo', content: 'Nouvelle réponse', replaceLast: true,
    });
    expect(ids(db)).toEqual(['user:u1', 'assistant:a1', 'user:u2', 'assistant:Nouvelle réponse']);
  });

  it('cas de production : réessayer un tour resté sans réponse ne supprime PAS la réponse du tour d’avant', async () => {
    const db = conversation([['u1', 'user'], ['a1', 'assistant'], ['u2', 'user']]);
    await saveAssistantMessageServer(fakeSupabase(db), {
      conversationId: CONV, userId: 'hugo', content: 'Réponse enfin rédigée', replaceLast: true,
    });
    expect(ids(db)).toEqual(['user:u1', 'assistant:a1', 'user:u2', 'assistant:Réponse enfin rédigée']);
  });

  it('n’écrit rien dans la conversation d’un autre utilisateur', async () => {
    const db = conversation([['u1', 'user'], ['a1', 'assistant']]);
    await saveAssistantMessageServer(fakeSupabase(db), {
      conversationId: CONV, userId: 'quelqu-un-d-autre', content: 'Intrusion', replaceLast: true,
    });
    expect(ids(db)).toEqual(['user:u1', 'assistant:a1']);
  });

  it('une réponse vide n’est jamais archivée', async () => {
    const db = conversation([['u1', 'user']]);
    await saveAssistantMessageServer(fakeSupabase(db), { conversationId: CONV, userId: 'hugo', content: '  ' });
    expect(ids(db)).toEqual(['user:u1']);
  });
});
