/**
 * Gate `rls-isolation` — article_documents (migration 0033, ADR-0031).
 *
 * Historique cloud du module Rédaction d'article médical : isolation own-row STRICTE.
 *   - un user lit/écrit/met à jour/supprime SES manuscrits ;
 *   - il ne voit ni ne modifie ceux d'un autre user.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

let db: RlsHarness;
let articleA: string;

beforeAll(async () => {
  db = await startRlsHarness();
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [
      USER_A,
      'a@medinfo.test',
      USER_B,
      'b@medinfo.test',
    ]);
    const article = await q(
      "INSERT INTO article_documents (user_id, title, doc_type, document) VALUES ($1, 'Article A', 'abstract', '{\"meta\":{\"title\":\"Article A\"}}'::jsonb) RETURNING id",
      [USER_A],
    );
    articleA = article.rows[0].id;
  });
}, 60_000);

afterAll(async () => {
  if (db) await db.stop();
});

describe('article_documents — isolation own-row', () => {
  it('user A crée SON article', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q(
        "INSERT INTO article_documents (user_id, title, document) VALUES ($1, 'Test', '{}'::jsonb) RETURNING id",
        [USER_A],
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('user A NE PEUT PAS créer un article au nom de user B', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO article_documents (user_id, document) VALUES ($1, '{}'::jsonb)", [USER_B]),
      ),
    ).rejects.toThrow();
  });

  it('la contrainte doc_type refuse un type inconnu', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO article_documents (user_id, doc_type, document) VALUES ($1, 'roman', '{}'::jsonb)", [USER_A]),
      ),
    ).rejects.toThrow();
  });

  it("user B NE PEUT PAS lire l'article de user A", async () => {
    const { rows } = await db.asUser(USER_B, (q) =>
      q('SELECT id FROM article_documents WHERE id = $1', [articleA]),
    );
    expect(rows).toHaveLength(0);
  });

  it("user B NE PEUT PAS modifier l'article de user A", async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q("UPDATE article_documents SET title = 'pirate' WHERE id = $1", [articleA]),
    );
    expect(rowCount).toBe(0);
  });

  it("user B NE PEUT PAS supprimer l'article de user A", async () => {
    const { rowCount } = await db.asUser(USER_B, (q) =>
      q('DELETE FROM article_documents WHERE id = $1', [articleA]),
    );
    expect(rowCount).toBe(0);
  });

  it('user A retrouve SON article', async () => {
    const { rows } = await db.asUser(USER_A, (q) =>
      q('SELECT title, doc_type FROM article_documents WHERE id = $1', [articleA]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Article A');
    expect(rows[0].doc_type).toBe('abstract');
  });
});
