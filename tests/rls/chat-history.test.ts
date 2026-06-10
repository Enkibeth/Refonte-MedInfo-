/**
 * Gate `rls-isolation` — chat_conversations / chat_messages (migration 0020).
 *
 * Historique de chat (questions de santé potentiellement sensibles) :
 * isolation own-row STRICTE sur les deux tables.
 *   - un user lit/écrit/supprime SES conversations et messages ;
 *   - il ne voit ni ne modifie ceux d'un autre user.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;
let convA: string;
let msgA: string;

beforeAll(async () => {
  db = await startRlsHarness();
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
      USER_A,
      'a@medinfo.test',
      USER_B,
      'b@medinfo.test',
    ]);
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('chat_conversations — isolation own-row', () => {
  it('user A crée SA conversation', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO chat_conversations (user_id, chatbot, title, category) VALUES ($1, 'public', 'Titre test', 'Autre') RETURNING id",
        [USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
    convA = rows[0].id;
  });

  it('user A NE PEUT PAS créer une conversation au nom de user B', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO chat_conversations (user_id, chatbot) VALUES ($1, 'public')", [USER_B]),
      ),
    ).rejects.toThrow();
  });

  it('user B NE PEUT PAS lire la conversation de user A', async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM chat_conversations WHERE id = $1', [convA]),
    );
    expect(rows).toHaveLength(0);
  });

  it('user B NE PEUT PAS renommer la conversation de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q("UPDATE chat_conversations SET title = 'pirate' WHERE id = $1", [convA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user B NE PEUT PAS supprimer la conversation de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q('DELETE FROM chat_conversations WHERE id = $1', [convA]),
    );
    expect(rowCount).toBe(0);
  });
});

describe('chat_messages — isolation own-row', () => {
  it('user A écrit un message dans SA conversation', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO chat_messages (conversation_id, user_id, role, content) VALUES ($1, $2, 'user', 'Bonjour') RETURNING id",
        [convA, USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
    msgA = rows[0].id;
  });

  it('user B NE PEUT PAS lire les messages de user A', async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM chat_messages WHERE conversation_id = $1', [convA]),
    );
    expect(rows).toHaveLength(0);
  });

  it('user B NE PEUT PAS insérer un message dans la conversation de user A', async () => {
    await expect(
      db.asUser(USER_B, (q) =>
        q(
          "INSERT INTO chat_messages (conversation_id, user_id, role, content) VALUES ($1, $2, 'user', 'intrusion')",
          [convA, USER_B],
        ),
      ),
    ).rejects.toThrow();
  });

  it('user B NE PEUT PAS supprimer un message de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q('DELETE FROM chat_messages WHERE id = $1', [msgA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user A retrouve SES messages', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT content FROM chat_messages WHERE conversation_id = $1', [convA]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('Bonjour');
  });
});
