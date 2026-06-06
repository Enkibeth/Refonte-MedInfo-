/**
 * Gate `rls-isolation` — ecos_cases (migration 0013).
 *
 * Invariants prouvés sur un vrai Postgres (harness éphémère, ADR-0009) :
 *   - lecture PUBLIQUE des cas publiés uniquement (is_published = true) ;
 *   - un cas brouillon (is_published = false) est INVISIBLE du client ;
 *   - le client (authenticated) ne peut PAS écrire (INSERT/UPDATE/DELETE) : seul le
 *     service_role édite le corpus (CRUD admin /api/admin/ecos-cases) ;
 *   - le service_role gère le corpus librement (seed + CRUD).
 *
 * Cas pédagogiques fictifs : aucune donnée de santé identifiable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const DRAFT_SLUG = 'cas-brouillon-test';

let db: RlsHarness;

beforeAll(async () => {
  db = await startRlsHarness();
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [USER_A, 'a@medinfo.test']);
    // Un cas brouillon (non publié) en plus du seed publié de la migration.
    await q(
      `INSERT INTO ecos_cases (slug, title, specialty, brief, is_published)
       VALUES ($1, 'Cas brouillon', 'Test', 'consigne', false)`,
      [DRAFT_SLUG],
    );
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('ecos_cases — lecture publique des cas publiés', () => {
  it('le seed de la migration a bien créé des cas publiés', async () => {
    const { rows } = await db.asService((q) =>
      q('SELECT count(*)::int AS n FROM ecos_cases WHERE is_published'),
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(4);
  });

  it('un client authentifié lit les cas PUBLIÉS', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT slug FROM ecos_cases WHERE is_published'),
    );
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it('un client authentifié NE VOIT PAS les cas brouillons (RLS filtre is_published)', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT slug FROM ecos_cases WHERE slug = $1', [DRAFT_SLUG]),
    );
    expect(rows).toHaveLength(0);
  });
});

describe('ecos_cases — écriture réservée au service_role', () => {
  it('un client authentifié NE PEUT PAS insérer un cas', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q(
          `INSERT INTO ecos_cases (slug, title, specialty, brief)
           VALUES ('hack', 'x', 'x', 'x')`,
        ),
      ),
    ).rejects.toThrow();
  });

  it('un client authentifié NE PEUT PAS modifier un cas publié', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("UPDATE ecos_cases SET title = 'pwned' WHERE is_published"),
      ),
    ).rejects.toThrow();
  });

  it('un client authentifié NE PEUT PAS supprimer un cas', async () => {
    await expect(
      db.asUser(USER_A, (q) => q('DELETE FROM ecos_cases WHERE is_published')),
    ).rejects.toThrow();
  });

  it('le service_role PEUT créer, publier puis supprimer un cas', async () => {
    await db.asService(async (q) => {
      const ins = await q(
        `INSERT INTO ecos_cases (slug, title, specialty, brief, is_published)
         VALUES ('crud-test', 'CRUD', 'Test', 'consigne', false) RETURNING id`,
      );
      const id = ins.rows[0].id;
      const upd = await q('UPDATE ecos_cases SET is_published = true WHERE id = $1', [id]);
      expect(upd.rowCount).toBe(1);
      const del = await q('DELETE FROM ecos_cases WHERE id = $1', [id]);
      expect(del.rowCount).toBe(1);
    });
  });
});
