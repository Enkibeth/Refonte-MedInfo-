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

  // ADR-0011 : anti-auto-promotion. Le client ne peut pas se donner un rôle vérifié.
  it("user A NE PEUT PAS s'auto-promouvoir (UPDATE de SA persona en professional → throw)", async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("UPDATE profiles SET persona = 'professional' WHERE id = $1", [USER_A]),
      ),
    ).rejects.toThrow();
  });

  it('le service_role PEUT attribuer un rôle vérifié (UPDATE persona côté serveur)', async () => {
    const { rowCount } = await db.asService((q) =>
      q("UPDATE profiles SET persona = 'professional', status = 'verified' WHERE id = $1", [
        USER_A,
      ]),
    );
    expect(rowCount).toBe(1);
  });

  // Migration 0016 : multi-rôles vérifiés. Le client ne peut pas s'ajouter un rôle vérifié.
  it("user A NE PEUT PAS s'ajouter un rôle dans verified_personas (anti-auto-promotion)", async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q(
          "UPDATE profiles SET verified_personas = ARRAY['public','professional']::persona[] WHERE id = $1",
          [USER_A],
        ),
      ),
    ).rejects.toThrow();
  });

  it('le service_role PEUT agréger des rôles vérifiés (UPDATE verified_personas)', async () => {
    const { rowCount } = await db.asService((q) =>
      q(
        "UPDATE profiles SET verified_personas = ARRAY['public','student','professional']::persona[] WHERE id = $1",
        [USER_A],
      ),
    );
    expect(rowCount).toBe(1);
  });

  it('verified_personas vaut [public] par défaut à la création du profil', async () => {
    // Cast en text[] : node-pg ne sait pas parser un tableau d'enum custom (persona[])
    // et renverrait la chaîne brute '{public}'.
    const { rows } = await db.asService((q) =>
      q('SELECT verified_personas::text[] AS verified_personas FROM profiles WHERE id = $1', [
        USER_B,
      ]),
    );
    expect(rows[0].verified_personas).toEqual(['public']);
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


describe('ai_model_config — service_role only (config admin, jamais exposée au client)', () => {
  it('le seed a bien créé les 20 lignes de fonctionnalités (6 initiales + chat_meta 0021 + blog_generate 0022 + blog_topic/blog_review 0024 + presentation_generate 0025 + revision_plan_assist 0028 + cv_review 0029 + cv_import 0030 + pubmed_agent 0031 + blog_fact_check/blog_copyedit 0032 + article_assist/article_reduce/article_originality 0033)', async () => {
    const { rows } = await db.asService((q) => q('SELECT key FROM ai_model_config'));
    expect(rows).toHaveLength(20);
    expect(rows.map((r: { key: string }) => r.key)).toContain('chat_meta');
    expect(rows.map((r: { key: string }) => r.key)).toContain('blog_generate');
    expect(rows.map((r: { key: string }) => r.key)).toContain('blog_topic');
    expect(rows.map((r: { key: string }) => r.key)).toContain('blog_review');
    expect(rows.map((r: { key: string }) => r.key)).toContain('presentation_generate');
    expect(rows.map((r: { key: string }) => r.key)).toContain('revision_plan_assist');
    expect(rows.map((r: { key: string }) => r.key)).toContain('cv_review');
    expect(rows.map((r: { key: string }) => r.key)).toContain('cv_import');
    expect(rows.map((r: { key: string }) => r.key)).toContain('blog_fact_check');
    expect(rows.map((r: { key: string }) => r.key)).toContain('blog_copyedit');
    expect(rows.map((r: { key: string }) => r.key)).toContain('article_assist');
    expect(rows.map((r: { key: string }) => r.key)).toContain('article_reduce');
    expect(rows.map((r: { key: string }) => r.key)).toContain('article_originality');
  });

  it('un client authentifié NE PEUT PAS lire ai_model_config', async () => {
    await expect(
      db.asUser(USER_A, (q) => q('SELECT * FROM ai_model_config')),
    ).rejects.toThrow();
  });

  it('un client authentifié NE PEUT PAS modifier ai_model_config', async () => {
    await expect(
      db.asUser(USER_A, (q) => q("UPDATE ai_model_config SET model_id = 'hack' WHERE key = 'chat'")),
    ).rejects.toThrow();
  });

  it('le service_role PEUT mettre à jour la config (modèle + réglages)', async () => {
    const { rowCount } = await db.asService((q) =>
      q(
        "UPDATE ai_model_config SET model_id = 'gpt-5.5', provider = 'openai', reasoning_effort = 'high', web_search = true WHERE key = 'chat'",
      ),
    );
    expect(rowCount).toBe(1);
  });
});

describe('ai_prompts — service_role only (overrides admin, jamais exposés au client)', () => {
  it('un client authentifié NE PEUT PAS lire ai_prompts', async () => {
    await expect(db.asUser(USER_A, (q) => q('SELECT * FROM ai_prompts'))).rejects.toThrow();
  });

  it('un client authentifié NE PEUT PAS écrire dans ai_prompts', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q("INSERT INTO ai_prompts (key, label, template, scope) VALUES ('chat', 'x', 'y', 'z')"),
      ),
    ).rejects.toThrow();
  });

  it('le service_role PEUT upserter un override de prompt', async () => {
    const { rowCount } = await db.asService((q) =>
      q("INSERT INTO ai_prompts (key, label, template, scope) VALUES ('analyze', 'Analyse', 'override', 'Outils')"),
    );
    expect(rowCount).toBe(1);
  });
});

describe('usage_counters — service_role only + isolation compteur', () => {
  it('le service_role PEUT incrémenter un compteur journalier user/persona sans donnée santé', async () => {
    const { rows } = await db.asService((q) =>
      q(
        `SELECT * FROM increment_usage_counter(
          'user:11111111-1111-1111-1111-111111111111',
          'user',
          $1,
          NULL,
          'public',
          CURRENT_DATE,
          10
        )`,
        [USER_A],
      ),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].allowed).toBe(true);
    expect(rows[0].daily_count).toBe(1);
    expect(rows[0].daily_limit).toBe(10);
  });

  it('un client authentifié NE PEUT PAS lire usage_counters', async () => {
    await expect(
      db.asUser(USER_A, (q) => q('SELECT * FROM usage_counters')),
    ).rejects.toThrow();
  });

  it('un client authentifié NE PEUT PAS écrire usage_counters', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q(
          `INSERT INTO usage_counters (counter_key, identity_type, user_id, persona, window_date, daily_count)
           VALUES ('user:11111111-1111-1111-1111-111111111111', 'user', $1, 'public', CURRENT_DATE, 1)`,
          [USER_A],
        ),
      ),
    ).rejects.toThrow();
  });

  it('un client authentifié NE PEUT PAS appeler le RPC compteur', async () => {
    await expect(
      db.asUser(USER_A, (q) =>
        q(
          `SELECT * FROM increment_usage_counter(
            'user:11111111-1111-1111-1111-111111111111',
            'user',
            $1,
            NULL,
            'public',
            CURRENT_DATE,
            10
          )`,
          [USER_A],
        ),
      ),
    ).rejects.toThrow();
  });
});
