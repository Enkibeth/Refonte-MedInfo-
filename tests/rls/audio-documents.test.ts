/**
 * Gate `rls-isolation` — audio_documents (ADR-0022, migration 0019).
 *
 * Donnée sensible (consultation) : isolation own-row STRICTE.
 *   - un user lit/écrit/supprime SES documents ;
 *   - il ne voit ni ne modifie ceux d'un autre user.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;
let docA: string;

beforeAll(async () => {
  db = await startRlsHarness();
  // ⚠️ asUser() annule sa transaction à la fin (ROLLBACK, cf pgHarness) : le document
  // partagé entre tests est créé via asService (persisté).
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
      USER_A,
      'a@medinfo.test',
      USER_B,
      'b@medinfo.test',
    ]);
    const doc = await q(
      "INSERT INTO audio_documents (user_id, title, kind, transcription) VALUES ($1, 'CR fixture', 'report', 'texte') RETURNING id",
      [USER_A],
    );
    docA = doc.rows[0].id;
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('audio_documents — isolation own-row', () => {
  it('user A crée SON document', async () => {
    // Vérifie la policy INSERT own-row (ligne annulée par le ROLLBACK du harness ;
    // la fixture persistante docA vient du beforeAll).
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO audio_documents (user_id, title, kind, transcription) VALUES ($1, 'CR test', 'report', 'texte') RETURNING id",
        [USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('user B NE PEUT PAS lire le document de user A', async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM audio_documents WHERE id = $1', [docA]),
    );
    expect(rows).toHaveLength(0);
  });

  it('user B NE PEUT PAS modifier le document de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q("UPDATE audio_documents SET title = 'pirate' WHERE id = $1", [docA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user B NE PEUT PAS supprimer le document de user A', async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q('DELETE FROM audio_documents WHERE id = $1', [docA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user B NE PEUT PAS insérer un document au nom de user A (WITH CHECK)', async () => {
    await expect(
      db.asUser(USER_B, (q) =>
        q(
          "INSERT INTO audio_documents (user_id, title, kind, transcription) VALUES ($1, 'forge', 'report', 'x')",
          [USER_A],
        ),
      ),
    ).rejects.toThrow();
  });

  it('user A lit puis supprime SON document', async () => {
    // Lecture + suppression dans la MÊME transaction asUser (le harness annule à la fin).
    await db.asUser(USER_A, async (q) => {
      const read = await q('SELECT id FROM audio_documents WHERE id = $1', [docA]);
      expect(read.rows).toHaveLength(1);
      const del = await q('DELETE FROM audio_documents WHERE id = $1', [docA]);
      expect(del.rowCount).toBe(1);
    });
  });
});
