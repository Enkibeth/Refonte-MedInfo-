/**
 * Gate `rls-isolation` — presentation_decks (migration 0026).
 *
 * Historique cloud du générateur de présentations : isolation own-row STRICTE.
 *   - un user lit/écrit/met à jour/supprime SES présentations ;
 *   - il ne voit ni ne modifie celles d'un autre user.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;
let deckA: string;

beforeAll(async () => {
  db = await startRlsHarness();
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
      USER_A,
      'a@medinfo.test',
      USER_B,
      'b@medinfo.test',
    ]);
    const deck = await q(
      "INSERT INTO presentation_decks (user_id, title, theme, deck) VALUES ($1, 'Deck A', 'v2', '{\"meta\":{\"title\":\"Deck A\"}}'::jsonb) RETURNING id",
      [USER_A],
    );
    deckA = deck.rows[0].id;
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('presentation_decks — isolation own-row', () => {
  it('user A crée SA présentation', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO presentation_decks (user_id, title, theme, deck) VALUES ($1, 'Test', 'v1', '{}'::jsonb) RETURNING id",
        [USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('user A NE PEUT PAS créer une présentation au nom de user B', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO presentation_decks (user_id, deck) VALUES ($1, '{}'::jsonb)", [USER_B]),
      ),
    ).rejects.toThrow();
  });

  it('user B NE PEUT PAS lire la présentation de user A', async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM presentation_decks WHERE id = $1', [deckA]),
    );
    expect(rows).toHaveLength(0);
  });

  it('user B NE PEUT PAS modifier la présentation de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q("UPDATE presentation_decks SET title = 'pirate' WHERE id = $1", [deckA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user B NE PEUT PAS supprimer la présentation de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q('DELETE FROM presentation_decks WHERE id = $1', [deckA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user A retrouve SA présentation', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT title FROM presentation_decks WHERE id = $1', [deckA]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Deck A');
  });
});
