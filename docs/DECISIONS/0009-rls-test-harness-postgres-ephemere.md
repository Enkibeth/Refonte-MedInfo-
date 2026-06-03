# ADR-0009 — Harness Postgres éphémère pour les tests d'isolation RLS

```yaml
status: Accepted
date: 2026-06-03
```

## Contexte
Le gate `rls-isolation` (03_SECURITY §1, §2) doit devenir **réellement actif** : prouver
qu'un user A authentifié ne peut ni lire ni écrire la ligne d'un user B. Les policies RLS
sont du SQL Postgres natif, non simulable en mémoire (pg-mem ne supporte pas la RLS).
Il faut donc un vrai Postgres, exécutable en local **et** en CI, sans dépendre de Docker
(daemon indisponible dans l'environnement de dev).

## Décision
Un harness de test (`tests/rls/helpers/pgHarness.ts`) démarre un cluster Postgres **jetable**
via `initdb` + `pg_ctl` (binaires serveur présents : PG 16), ou se connecte à `DATABASE_URL`
si fourni. Il applique, dans l'ordre : un **shim auth test-only** (`auth-shim.sql` : rôles
`anon`/`authenticated`/`service_role`, schéma `auth`, `auth.users`, `auth.uid()`), puis les
`supabase/migrations/*.sql`, puis les `supabase/policies/*.sql`. Il expose `asService()`
(superuser ≈ service_role, BYPASSRLS) et `asUser(uid)` (`SET ROLE authenticated` +
`request.jwt.claims.sub`).

Le shim auth N'EST PAS une migration : sur le vrai Supabase, `auth`/rôles existent déjà.
Si aucun binaire serveur ni `DATABASE_URL` n'est disponible, le gate **échoue bruyamment**
(jamais de skip silencieux — un gate RLS contourné est un incident, §8).

## Conséquences
- (+) `rls-isolation` teste les policies réelles, localement et en CI, coût 0 €, sans Docker.
- (+) Les migrations/policies sont exécutées telles quelles → fidélité au déploiement Supabase.
- (−) Le cluster tourne sous l'utilisateur `postgres` en local (Postgres refuse root) :
  géré par `runuser`. La CI (`ubuntu-latest`, runner non-root) exécute `initdb` directement.
- (−) Le shim auth doit rester synchronisé avec le contrat minimal de Supabase (`auth.uid()`).

## Statut
Accepted.
