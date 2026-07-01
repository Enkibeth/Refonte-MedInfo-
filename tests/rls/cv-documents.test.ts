/**
 * Gate `rls-isolation` — cv_documents (migration 0029, ADR-0028).
 *
 * Historique cloud du module CV Builder : isolation own-row STRICTE.
 *   - un user lit/écrit/met à jour/supprime SES CV ;
 *   - il ne voit ni ne modifie ceux d'un autre user.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;
let cvA: string;

beforeAll(async () => {
  db = await startRlsHarness();
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
      USER_A,
      'a@medinfo.test',
      USER_B,
      'b@medinfo.test',
    ]);
    const cv = await q(
      "INSERT INTO cv_documents (user_id, title, document) VALUES ($1, 'CV A', '{\"personalInfo\":{\"firstName\":\"A\"}}'::jsonb) RETURNING id",
      [USER_A],
    );
    cvA = cv.rows[0].id;
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('cv_documents — isolation own-row', () => {
  it('user A crée SON CV', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO cv_documents (user_id, title, document) VALUES ($1, 'Test', '{}'::jsonb) RETURNING id",
        [USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('user A NE PEUT PAS créer un CV au nom de user B', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO cv_documents (user_id, document) VALUES ($1, '{}'::jsonb)", [USER_B]),
      ),
    ).rejects.toThrow();
  });

  it('user B NE PEUT PAS lire le CV de user A', async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM cv_documents WHERE id = $1', [cvA]),
    );
    expect(rows).toHaveLength(0);
  });

  it('user B NE PEUT PAS modifier le CV de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q("UPDATE cv_documents SET title = 'pirate' WHERE id = $1", [cvA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user B NE PEUT PAS supprimer le CV de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q('DELETE FROM cv_documents WHERE id = $1', [cvA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user A retrouve SON CV', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT title FROM cv_documents WHERE id = $1', [cvA]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('CV A');
  });
});
