/**
 * Gate `rls-isolation` — facturation (06_BILLING §6, ADR-0012).
 *
 * Invariants prouvés sur un vrai Postgres (harness éphémère, ADR-0009) :
 *   - un user lit UNIQUEMENT sa propre subscription, jamais celle d'un autre ;
 *   - le client ne peut PAS s'attribuer/modifier un plan payant (anti-auto-promotion,
 *     même doctrine qu'ADR-0011) → seul service_role (webhook) écrit le statut payant ;
 *   - `billing_events` (idempotence) n'est JAMAIS accessible au client.
 *
 * Écrits AVANT les policies (TDD) : rouge tant que tables/policies n'existent pas.
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
    // Écriture serveur (webhook) : chaque user a SA subscription. Aucune donnée santé.
    await q(
      `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
       VALUES ($1, 'cus_A', 'sub_A', 'public_mid', 'active'),
              ($2, 'cus_B', 'sub_B', 'student_mid', 'active')`,
      [USER_A, USER_B],
    );
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('subscriptions — isolation cross-user', () => {
  it('user A lit SA propre subscription', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT user_id, plan, status FROM subscriptions WHERE user_id = $1', [USER_A]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].plan).toBe('public_mid');
  });

  it('user A NE PEUT PAS lire la subscription de user B (SELECT filtré → 0 ligne)', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT * FROM subscriptions WHERE user_id = $1', [USER_B]),
    );
    expect(rows).toHaveLength(0);
  });

  // Anti-auto-promotion (ADR-0011/0012) : le client ne peut pas s'inventer un plan payant.
  it("user A NE PEUT PAS insérer une subscription (aucun GRANT d'écriture client → throw)", async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q(
          `INSERT INTO subscriptions (user_id, stripe_customer_id, plan, status)
           VALUES ($1, 'cus_self', 'student_premium', 'active')`,
          [USER_A],
        ),
      ),
    ).rejects.toThrow();
  });

  it("user A NE PEUT PAS modifier le statut/plan de SA subscription (anti-auto-promotion → throw)", async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("UPDATE subscriptions SET status = 'active', plan = 'student_premium' WHERE user_id = $1", [
          USER_A,
        ]),
      ),
    ).rejects.toThrow();
  });

  it('le service_role (webhook) PEUT écrire le statut payant', async () => {
    const { rowCount } = await db.asService((q) =>
      q("UPDATE subscriptions SET status = 'canceled' WHERE user_id = $1", [USER_A]),
    );
    expect(rowCount).toBe(1);
  });
});

describe('billing_events — service_role only (idempotence)', () => {
  it('un client authentifié NE PEUT PAS lire billing_events', async () => {
    await expect(db.asUser(USER_A, (q) => q('SELECT * FROM billing_events'))).rejects.toThrow();
  });

  it('un client authentifié NE PEUT PAS écrire billing_events', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO billing_events (stripe_event_id, type) VALUES ('evt_x', 'checkout.session.completed')"),
      ),
    ).rejects.toThrow();
  });

  it('le service_role PEUT enregistrer un événement traité', async () => {
    const { rowCount } = await db.asService((q) =>
      q("INSERT INTO billing_events (stripe_event_id, type) VALUES ('evt_seed', 'checkout.session.completed')"),
    );
    expect(rowCount).toBe(1);
  });
});
