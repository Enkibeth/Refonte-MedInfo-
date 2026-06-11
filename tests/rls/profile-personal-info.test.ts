/**
 * Gate `rls-isolation` — infos perso de profil (ADR-0021, migration 0017).
 *
 * Invariants :
 *   - un user peut écrire/lire SES propres first_name/last_name/age/sex (own-row) ;
 *   - il ne peut PAS modifier ceux d'un autre user ;
 *   - les contraintes de cohérence (âge, sexe) sont bien posées par la migration ;
 *   - mettre à jour ces colonnes ne déclenche PAS le verrou anti-élévation (persona intact).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;

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

describe('profiles — infos perso own-row', () => {
  it('user A renseigne SES infos perso', async () => {
    // Écriture + relecture dans la MÊME transaction asUser : le harness annule (ROLLBACK)
    // chaque appel asUser, une relecture séparée ne verrait pas l'update.
    await db.asUser(USER_A, async (q) => {
      const { rowCount } = await q(
        "UPDATE profiles SET first_name = 'Hugo', age = 34, sex = 'masculin' WHERE id = $1",
        [USER_A],
      );
      expect(rowCount).toBe(1);

      const { rows } = await q('SELECT first_name, age, sex, persona FROM profiles WHERE id = $1', [
        USER_A,
      ]);
      expect(rows[0]).toMatchObject({ first_name: 'Hugo', age: 34, sex: 'masculin' });
      // Mettre à jour les infos perso ne change pas la persona (verrou anti-élévation non déclenché).
      expect(rows[0].persona).toBe('public');
    });
  });

  it('user A NE PEUT PAS écrire les infos perso de user B', async () => {
    const { rowCount } = await db.asUser(USER_A, (q) =>
      q("UPDATE profiles SET first_name = 'pirate' WHERE id = $1", [USER_B]),
    );
    expect(rowCount).toBe(0);
  });

  it('rejette un âge hors bornes (contrainte CHECK)', async () => {
    await expect(
      db.asUser(USER_A, (q) => q('UPDATE profiles SET age = 999 WHERE id = $1', [USER_A])),
    ).rejects.toThrow();
  });

  it('rejette une valeur de sexe non autorisée (contrainte CHECK)', async () => {
    await expect(
      db.asUser(USER_A, (q) => q("UPDATE profiles SET sex = 'invalide' WHERE id = $1", [USER_A])),
    ).rejects.toThrow();
  });
});
