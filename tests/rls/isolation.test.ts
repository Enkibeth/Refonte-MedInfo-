/**
 * Gate `rls-isolation` (03_SECURITY §1, §2) — RÉELLEMENT actif.
 *
 * Invariant testé : un user A authentifié qui lit/écrit une ligne de user B DOIT échouer.
 * Et `ai_interactions` n'est JAMAIS accessible au client (service_role only).
 *
 * Ces tests tournent contre un vrai Postgres (harness éphémère ou DATABASE_URL) sur lequel
 * on a appliqué les migrations + policies versionnées. Ils sont écrits AVANT les policies
 * (TDD) : ils échouent tant que `profiles`/`ai_interactions` et leurs policies n'existent pas.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;

beforeAll(async () => {
  db = await startRlsHarness();
  // Seed en service_role : deux comptes auth → le trigger crée leurs profils.
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
      USER_A,
      'a@medinfo.test',
      USER_B,
      'b@medinfo.test',
    ]);
    // Persona distincte pour vérifier le routing côté données.
    await q("UPDATE profiles SET persona = 'student' WHERE id = $1", [USER_B]);
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('profiles — isolation cross-user', () => {
  it('le seed a bien créé un profil par user (via trigger)', async () => {
    const { rows } = await db.asService((q) =>
      q('SELECT id, persona FROM profiles ORDER BY persona'),
    );
    expect(rows).toHaveLength(2);
  });

  it('user A NE PEUT PAS lire la ligne de user B (SELECT filtré → 0 ligne)', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT * FROM profiles WHERE id = $1', [USER_B]),
    );
    expect(rows).toHaveLength(0);
  });

  it('user A peut lire SA propre ligne', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT id FROM profiles WHERE id = $1', [USER_A]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(USER_A);
  });

  it('user A NE PEUT PAS modifier la ligne de user B (UPDATE → 0 ligne affectée)', async () => {
    const { rowCount } = await db.asUser(USER_A, (q) =>
      q("UPDATE profiles SET persona = 'public' WHERE id = $1", [USER_B]),
    );
    expect(rowCount).toBe(0);
  });

  it('user A NE PEUT PAS supprimer la ligne de user B (DELETE → 0 ligne affectée)', async () => {
    const { rowCount } = await db.asUser(USER_A, (q) =>
      q('DELETE FROM profiles WHERE id = $1', [USER_B]),
    );
    expect(rowCount).toBe(0);
  });

  it("user A NE PEUT PAS insérer un profil au nom de user B (WITH CHECK)", async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q('INSERT INTO profiles (id, persona) VALUES ($1, $2)', [
          '33333333-3333-3333-3333-333333333333',
          'public',
        ]),
      ),
    ).rejects.toThrow();
  });
});

describe('ai_interactions — service_role only (jamais accessible au client)', () => {
  it('un client authentifié NE PEUT PAS lire ai_interactions', async () => {
    await expect(
      db.asUser(USER_A, (q) => q('SELECT * FROM ai_interactions')),
    ).rejects.toThrow();
  });

  it('un client authentifié NE PEUT PAS écrire dans ai_interactions', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO ai_interactions (persona, model_used) VALUES ('public', 'test')"),
      ),
    ).rejects.toThrow();
  });

  it('le service_role PEUT écrire dans ai_interactions (audit)', async () => {
    const { rowCount } = await db.asService((q) =>
      q("INSERT INTO ai_interactions (persona, model_used) VALUES ('public', 'gpt-5.4-mini')"),
    );
    expect(rowCount).toBe(1);
  });
});
