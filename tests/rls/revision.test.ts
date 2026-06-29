/**
 * Gate `rls-isolation` — revision_plans (migration 0027, ADR-0027).
 *
 * Dashboard de révision étudiant : isolation own-row STRICTE.
 *   - un user lit/écrit/met à jour/supprime SES plans ;
 *   - il ne voit ni ne modifie ceux d'un autre user.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;
let planA: string;

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
      "INSERT INTO revision_plans (user_id, title, exam_type, exam_date, plan) VALUES ($1, 'Plan A', 'pass_las', '2026-07-01', '{\"resources\":[]}'::jsonb) RETURNING id",
      [USER_A],
    );
    planA = plan.rows[0].id;
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('revision_plans — isolation own-row', () => {
  it('user A crée SON plan', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO revision_plans (user_id, exam_date, plan) VALUES ($1, '2026-06-30', '{}'::jsonb) RETURNING id",
        [USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('user A NE PEUT PAS créer un plan au nom de user B', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO revision_plans (user_id, exam_date, plan) VALUES ($1, '2026-06-30', '{}'::jsonb)", [
          USER_B,
        ]),
      ),
    ).rejects.toThrow();
  });

  it('user B NE PEUT PAS lire le plan de user A', async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM revision_plans WHERE id = $1', [planA]),
    );
    expect(rows).toHaveLength(0);
  });

  it('user B NE PEUT PAS modifier le plan de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q("UPDATE revision_plans SET title = 'pirate' WHERE id = $1", [planA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user B NE PEUT PAS supprimer le plan de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q('DELETE FROM revision_plans WHERE id = $1', [planA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user A retrouve SON plan', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT title FROM revision_plans WHERE id = $1', [planA]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Plan A');
  });

  it('la contrainte exam_type rejette une valeur hors liste', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q(
          "INSERT INTO revision_plans (user_id, exam_type, exam_date, plan) VALUES ($1, 'bogus', '2026-06-30', '{}'::jsonb)",
          [USER_A],
        ),
      ),
    ).rejects.toThrow();
  });
});
