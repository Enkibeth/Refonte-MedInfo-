/**
 * Gate `rls-isolation` — document_analyses (migration 0023).
 *
 * Historique des analyses de documents (résultats potentiellement sensibles) :
 * isolation own-row STRICTE.
 *   - un user lit/crée/supprime SES analyses ;
 *   - il ne voit ni ne supprime celles d'un autre user ;
 *   - le document source n'est pas stocké (la table n'a pas de colonne pour lui).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;
let analysisA: string;

beforeAll(async () => {
  db = await startRlsHarness();
  // ⚠️ asUser() annule sa transaction à la fin (ROLLBACK, cf pgHarness) : les fixtures
  // partagées entre tests doivent être créées via asService (persistées).
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
      USER_A,
      'a@medinfo.test',
      USER_B,
      'b@medinfo.test',
    ]);
    const row = await q(
      "INSERT INTO document_analyses (user_id, mode, source_name, result) VALUES ($1, 'analysis', 'cr-cardio.pdf', '## Ce que dit ce document') RETURNING id",
      [USER_A],
    );
    analysisA = row.rows[0].id;
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('document_analyses — isolation own-row', () => {
  it('user A crée SA ligne d\'analyse', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO document_analyses (user_id, mode, source_name, target_language, result) VALUES ($1, 'translation', 'ordonnance.jpg', 'English', 'Translated content') RETURNING id",
        [USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('user A NE PEUT PAS créer une analyse au nom de user B', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO document_analyses (user_id, result) VALUES ($1, 'intrusion')", [USER_B]),
      ),
    ).rejects.toThrow();
  });

  it('user B NE PEUT PAS lire l\'analyse de user A', async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM document_analyses WHERE id = $1', [analysisA]),
    );
    expect(rows).toHaveLength(0);
  });

  it('user B NE PEUT PAS supprimer l\'analyse de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q('DELETE FROM document_analyses WHERE id = $1', [analysisA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user A retrouve SON analyse', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT source_name, result FROM document_analyses WHERE id = $1', [analysisA]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].source_name).toBe('cr-cardio.pdf');
  });

  it('un mode invalide est rejeté (CHECK)', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO document_analyses (user_id, mode, result) VALUES ($1, 'diagnostic', 'x')", [
          USER_A,
        ]),
      ),
    ).rejects.toThrow();
  });
});
