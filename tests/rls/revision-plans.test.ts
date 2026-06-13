/**
 * Gate `rls-isolation` — revision_plans + revision_plan_items (migration 0027).
 *
 * Planificateur de révisions étudiant : isolation own-row STRICTE.
 *   - un user lit/écrit/met à jour/supprime SES plans et leurs blocs ;
 *   - il ne voit ni ne modifie ceux d'un autre user ;
 *   - il ne peut pas insérer un bloc rattaché au plan d'autrui.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;
let planA: string;
let itemA: string;

beforeAll(async () => {
  db = await startRlsHarness();
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
      USER_A,
      'a@medinfo.test',
      USER_B,
      'b@medinfo.test',
    ]);
    const plan = await q(
      "INSERT INTO revision_plans (user_id, title, start_date, exam_date) VALUES ($1, 'EDN A', '2026-09-01', '2026-12-01') RETURNING id",
      [USER_A],
    );
    planA = plan.rows[0].id;
    const item = await q(
      "INSERT INTO revision_plan_items (plan_id, user_id, title, pages) VALUES ($1, $2, 'Cardio', 120) RETURNING id",
      [planA, USER_A],
    );
    itemA = item.rows[0].id;
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('revision_plans — isolation own-row', () => {
  it('user A crée SON plan', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO revision_plans (user_id, title, start_date, exam_date) VALUES ($1, 'Test', '2026-09-01', '2026-10-01') RETURNING id",
        [USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('user A NE PEUT PAS créer un plan au nom de user B', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q(
          "INSERT INTO revision_plans (user_id, start_date, exam_date) VALUES ($1, '2026-09-01', '2026-10-01')",
          [USER_B],
        ),
      ),
    ).rejects.toThrow();
  });

  it('user B NE PEUT PAS lire le plan de user A', async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM revision_plans WHERE id = $1', [planA]),
    );
    expect(rows).toHaveLength(0);
  });

  it('user B NE PEUT PAS modifier ni supprimer le plan de user A', async () => {
    const upd = await db.asUser(USER_B, (q) =>
      q("UPDATE revision_plans SET title = 'pirate' WHERE id = $1", [planA]),
    );
    expect(upd.rowCount).toBe(0);
    const del = await db.asUser(USER_B, (q) =>
      q('DELETE FROM revision_plans WHERE id = $1', [planA]),
    );
    expect(del.rowCount).toBe(0);
  });

  it('user A retrouve SON plan', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT title FROM revision_plans WHERE id = $1', [planA]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('EDN A');
  });
});

describe('revision_plan_items — isolation own-row + appartenance au plan', () => {
  it('user B NE PEUT PAS lire les blocs de user A', async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM revision_plan_items WHERE id = $1', [itemA]),
    );
    expect(rows).toHaveLength(0);
  });

  it("user B NE PEUT PAS insérer un bloc rattaché au plan de user A (même sous son propre user_id)", async () => {
    await expect(
      db.asUser(USER_B, (q) =>
        q(
          "INSERT INTO revision_plan_items (plan_id, user_id, title) VALUES ($1, $2, 'pirate')",
          [planA, USER_B],
        ),
      ),
    ).rejects.toThrow();
  });

  it('user A insère un bloc dans SON plan', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO revision_plan_items (plan_id, user_id, title, chapters) VALUES ($1, $2, 'Pneumo', 8) RETURNING id",
        [planA, USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('user B NE PEUT PAS modifier le bloc de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q("UPDATE revision_plan_items SET title = 'pirate' WHERE id = $1", [itemA]),
    );
    expect(rowCount).toBe(0);
  });
});
