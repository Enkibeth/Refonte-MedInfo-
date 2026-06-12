/**
 * Gate `rls-isolation` — blog_posts (migration 0022).
 *
 * Blog public : seuls les articles PUBLIÉS sont lisibles par les clients
 * (anonymes ou connectés) ; les brouillons restent invisibles et AUCUNE
 * écriture client n'est possible (pas de policy INSERT/UPDATE/DELETE —
 * tout passe par /api/admin/blog en service role).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRlsHarness, type RlsHarness } from './helpers/pgHarness';

const USER_A = '31111111-1111-1111-1111-111111111111';

let db: RlsHarness;
let draftId: string;
let publishedId: string;

beforeAll(async () => {
  db = await startRlsHarness();
  await db.asService(async (q) => {
    await q('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [USER_A, 'blog@medinfo.test']);
    const draft = await q(
      "INSERT INTO blog_posts (slug, title, content_md, status) VALUES ('brouillon-test', 'Brouillon', '## Intro', 'draft') RETURNING id",
    );
    draftId = draft.rows[0].id;
    const pub = await q(
      "INSERT INTO blog_posts (slug, title, content_md, status, published_at) VALUES ('publie-test', 'Publié', '## Intro', 'published', now()) RETURNING id",
    );
    publishedId = pub.rows[0].id;
  });
});

afterAll(async () => {
  await db?.stop();
});

describe('RLS blog_posts', () => {
  it('un client ne lit que les articles publiés (le brouillon est invisible)', async () => {
    await db.asUser(USER_A, async (q) => {
      const res = await q('SELECT id, slug FROM blog_posts ORDER BY slug');
      expect(res.rows.map((r: { slug: string }) => r.slug)).toEqual(['publie-test']);
      expect(res.rows[0].id).toBe(publishedId);
    });
  });

  it("aucune écriture client : INSERT refusé", async () => {
    await db.asUser(USER_A, async (q) => {
      await expect(
        q("INSERT INTO blog_posts (slug, title, content_md) VALUES ('hack', 'Hack', 'x')"),
      ).rejects.toThrow();
    });
  });

  it('aucune écriture client : UPDATE refusé (pas de GRANT)', async () => {
    await db.asUser(USER_A, async (q) => {
      await expect(
        q("UPDATE blog_posts SET status = 'published' WHERE id = $1", [draftId]),
      ).rejects.toThrow();
    });
  });

  it('aucune écriture client : DELETE refusé (pas de GRANT)', async () => {
    await db.asUser(USER_A, async (q) => {
      await expect(q('DELETE FROM blog_posts WHERE id = $1', [publishedId])).rejects.toThrow();
    });
  });
});
