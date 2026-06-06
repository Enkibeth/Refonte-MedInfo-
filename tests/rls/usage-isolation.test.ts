/**
 * Gate `rls-isolation` — quotas d'usage par feature (06_BILLING §1, ADR-0012).
 *
 * Invariants prouvés sur un vrai Postgres (harness éphémère, ADR-0009) :
 *   - un user lit UNIQUEMENT ses propres compteurs (auth.uid() = user_id) ;
 *   - le client ne peut NI insérer NI modifier NI supprimer ses compteurs (anti-tampering :
 *     pas de remise à zéro de son quota) → seul service_role écrit, via consume_feature_quota ;
 *   - la RPC consume_feature_quota applique le check-and-consume atomique côté base.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const PERIOD = '2026-06-01';

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
    // Seed serveur (service_role) : chaque user a ses propres compteurs. Aucune donnée santé.
    await q(
      `INSERT INTO feature_usage_counters (user_id, feature_key, period_month, consumed)
       VALUES ($1, 'analyze', $3, 3),
              ($2, 'analyze', $3, 7)`,
      [USER_A, USER_B, PERIOD],
    );
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('feature_usage_counters — isolation cross-user', () => {
  it('user A lit SES propres compteurs', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT feature_key, consumed FROM feature_usage_counters WHERE user_id = $1', [USER_A]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].consumed).toBe(3);
  });

  it('user A NE PEUT PAS lire les compteurs de user B (SELECT filtré → 0 ligne)', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT * FROM feature_usage_counters WHERE user_id = $1', [USER_B]),
    );
    expect(rows).toHaveLength(0);
  });

  it("user A NE PEUT PAS insérer un compteur (aucun GRANT d'écriture client → throw)", async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q(
          `INSERT INTO feature_usage_counters (user_id, feature_key, period_month, consumed)
           VALUES ($1, 'ecos', $2, 0)`,
          [USER_A, PERIOD],
        ),
      ),
    ).rejects.toThrow();
  });

  it('user A NE PEUT PAS remettre son compteur à zéro (anti-tampering → throw)', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("UPDATE feature_usage_counters SET consumed = 0 WHERE user_id = $1", [USER_A]),
      ),
    ).rejects.toThrow();
  });

  it('user A NE PEUT PAS supprimer ses compteurs (→ throw)', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q('DELETE FROM feature_usage_counters WHERE user_id = $1', [USER_A]),
      ),
    ).rejects.toThrow();
  });
});

describe('consume_feature_quota — check-and-consume atomique (service_role)', () => {
  it('consomme tant que le plafond n\'est pas atteint, puis refuse sans sur-consommer', async () => {
    // Limite 5, déjà 3 consommés pour USER_A/analyze (seed).
    const first = await db.asService((q) =>
      q('SELECT * FROM consume_feature_quota($1, $2, $3, $4, $5)', [USER_A, 'analyze', PERIOD, 1, 5]),
    );
    expect(first.rows[0].allowed).toBe(true);
    expect(first.rows[0].consumed).toBe(4);

    const second = await db.asService((q) =>
      q('SELECT * FROM consume_feature_quota($1, $2, $3, $4, $5)', [USER_A, 'analyze', PERIOD, 1, 5]),
    );
    expect(second.rows[0].allowed).toBe(true);
    expect(second.rows[0].consumed).toBe(5);

    // 6e → dépasse la limite : refusé, compteur inchangé.
    const overflow = await db.asService((q) =>
      q('SELECT * FROM consume_feature_quota($1, $2, $3, $4, $5)', [USER_A, 'analyze', PERIOD, 1, 5]),
    );
    expect(overflow.rows[0].allowed).toBe(false);
    expect(overflow.rows[0].consumed).toBe(5);
    expect(overflow.rows[0].remaining).toBe(0);
  });

  it('le client NE PEUT PAS exécuter la RPC (EXECUTE réservé à service_role → throw)', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q('SELECT * FROM consume_feature_quota($1, $2, $3, $4, $5)', [USER_A, 'ecos', PERIOD, 1, 10]),
      ),
    ).rejects.toThrow();
  });
});
