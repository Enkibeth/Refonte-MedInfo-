/**
 * Gate `rls-isolation` — ecos_attempts (migration 0034, ADR-0032).
 *
 * Historique des passages ECOS : isolation own-row STRICTE + immuabilité.
 *   - un user lit/crée/supprime SES passages ;
 *   - il ne voit ni ne supprime ceux d'un autre user ;
 *   - AUCUN update possible (une note ne se retouche pas après coup) ;
 *   - la contrainte de barème rejette une note hors [0, 20].
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;
let attemptA: string;

beforeAll(async () => {
  db = await startRlsHarness();
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
      USER_A,
      'a@medinfo.test',
      USER_B,
      'b@medinfo.test',
    ]);
    const attempt = await q(
      "INSERT INTO ecos_attempts (user_id, case_slug, case_title, specialty, score, evaluation) VALUES ($1, 'douleur-thoracique', 'Douleur thoracique aiguë', 'Cardiologie', 14.5, '## Résultat global') RETURNING id",
      [USER_A],
    );
    attemptA = attempt.rows[0].id;
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('ecos_attempts — isolation own-row + immuabilité', () => {
  it('user A crée SON passage', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO ecos_attempts (user_id, case_slug, case_title, score) VALUES ($1, 'cephalees', 'Céphalées', 11) RETURNING id",
        [USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('user A NE PEUT PAS créer un passage au nom de user B', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO ecos_attempts (user_id, case_slug, case_title) VALUES ($1, 'x', 'X')", [
          USER_B,
        ]),
      ),
    ).rejects.toThrow();
  });

  it('user B NE PEUT PAS lire le passage de user A', async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM ecos_attempts WHERE id = $1', [attemptA]),
    );
    expect(rows).toHaveLength(0);
  });

  it('user B NE PEUT PAS supprimer le passage de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q('DELETE FROM ecos_attempts WHERE id = $1', [attemptA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user A NE PEUT PAS modifier sa note après coup (aucun UPDATE)', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q('UPDATE ecos_attempts SET score = 20 WHERE id = $1', [attemptA]),
      ),
    ).rejects.toThrow();
  });

  it('user A retrouve SON passage avec sa note', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT case_title, score FROM ecos_attempts WHERE id = $1', [attemptA]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].case_title).toBe('Douleur thoracique aiguë');
    expect(Number(rows[0].score)).toBe(14.5);
  });

  it('la contrainte de barème rejette une note > 20', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO ecos_attempts (user_id, case_slug, case_title, score) VALUES ($1, 'x', 'X', 21)", [
          USER_A,
        ]),
      ),
    ).rejects.toThrow();
  });
});
