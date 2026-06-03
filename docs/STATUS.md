# MedInfo AI — Statut projet

```yaml
title: Project Status
version: 1.0.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-03
```

## État courant

- Étape 1 — scaffold : **terminée et poussée sur GitHub**.
- Commit de référence : `745a4f3f6d74964ecc19f60783f4aabfef01f692`.
- Branches présentes : `main`, `dev`, `staging`, toutes initialisées depuis le commit de l'étape 1.
- Architecture documentaire : organisée dans `docs/` avec ADRs dans `docs/DECISIONS/`.
- Workflow GitHub Actions : présent dans `.github/workflows/compliance.yml`.

## Validations locales effectuées

Les commandes suivantes ont été exécutées localement sur le scaffold étape 1 :

```bash
npm run typecheck
npm run test
npm run compliance
```

Résultat local : **OK**.

## Limite de vérification distante

Au moment de la vérification initiale, GitHub ne renvoyait pas encore de run GitHub Actions exploitable pour le commit `745a4f3f6d74964ecc19f60783f4aabfef01f692`.

Conséquence : l'étape 1 est validée par les contrôles locaux et par la présence distante des fichiers critiques, mais le premier statut CI GitHub Actions reste à confirmer lors d'un prochain push ou d'une prochaine pull request.

Cette limite ne bloque pas l'étape 2, mais elle doit être levée avant de considérer la chaîne CI distante comme prouvée.

## Étape 2 — classifieur d'intention : **implémentée (couche 1)**

Réalisée en TDD (tests de refus écrits avant la logique).

Critère minimal de validation — **atteint** :

```txt
"j'ai mal au ventre" → refus canonique `01_REGULATION.md §4`   ✅
LLM principal non appelé (garanti par runClassifierGate)       ✅
Tests de refus verts                                           ✅
```

Périmètre livré :

- Étage 1 regex déterministe local (`src/ai/classifier/`) : 5 catégories
  `general_info` / `personal_symptoms` / `emergency` / `out_of_scope` / `ambiguous`.
- Refus canonique (source unique `src/compliance/disclosures.ts`) pour
  `personal_symptoms` / `emergency` / `ambiguous`. `general_info` seul → LLM principal.
- Étage 2 (LLM léger) : interface injectable **non câblée** à cette étape (fail-safe `ambiguous`).
- Ceinture + bretelles : un verdict `general_info` de l'étage 2 est rétrogradé si un
  marqueur personnel regex subsiste.

Validations locales : `npm run typecheck`, `npm run test`, `npm run compliance`
(5 gates) → **OK**.

### Golden set FR + calibration (Codex + Claude)

Golden set de 500 exemples (`tests/classifier/golden/golden-set.fr.jsonl`, produit par Codex)
+ harnais d'éval (`scripts/eval/classifier-goldenset.mjs`, `npm run eval:classifier`, **hors**
chaîne `compliance`). Audit : distribution 35/30/20/10/5 % conforme §5, 30 % adversariaux,
0 PII (dette qualité : 56 doublons exacts à diversifier).

Calibration du lexique (couche 1, regex seul, sans étage 2) :

| Classe | Recall | Précision | Cible §6 |
|---|---|---|---|
| emergency | **100 %** | 100 % | recall ≥99 % ✅ |
| personal_symptoms | **100 %** | 98 % | recall ≥97 % ✅ |
| general_info | 28,6 % | 90,9 % | précision ≥95 % ⚠️ |

**0 fuite vers le LLM principal** (aucun cas `emergency`/`personal_symptoms` routé `general_info`).
La précision `general_info` < 95 % et le faible recall `general_info`/`out_of_scope` sont une
limite **assumée du regex seul** : séparer « explique la différence entre un ETF » (non médical)
de « explique la différence entre angine et pharyngite » (médical) relève de l'**étage 2 (LLM
sémantique)**, reporté. `eval:classifier` sort donc en exit 1 sur la cible `general_info`
précision — informatif, non bloquant (hors `compliance`).

## Étape 3 — Auth Supabase + routing persona + RLS testées : **implémentée (TDD)**

Tests d'isolation RLS écrits AVANT les policies (rouge → vert).

Critères de validation START.md — **atteints** :

```txt
Login Supabase (magic link OTP, ADR-0007)                                  ✅ câblé
Routing par persona : public + student actifs                              ✅
  professional routable mais enabledInMvp=false (ADR-0006), 0 surface UI    ✅
RLS cross-user : user A lit/écrit la ligne de user B → ÉCHOUE              ✅ (gate rls-isolation)
ai_interactions service_role only, jamais accessible au client            ✅ testé
```

Périmètre livré :

- `supabase/migrations/` : `profiles` (RLS own-row, trigger handle_new_user, zéro donnée santé)
  et `ai_interactions` (audit §6, RLS activée SANS policy → client refusé).
- `supabase/policies/` : `profiles.sql` (4 policies auth.uid()=id) + `ai_interactions.sql`
  (REVOKE client, service_role only).
- `tests/rls/isolation.test.ts` (9 tests) sur **vrai Postgres** via harness éphémère
  (`tests/rls/helpers/`, ADR-0009) — le gate `rls-isolation` est désormais RÉELLEMENT actif.
- `src/ai/routing/persona.ts` + test unitaire ; `src/auth/AuthProvider.tsx` ; garde de
  navigation par persona dans `app/_layout.tsx` ; écrans `sign-in` / `account` minimaux
  fonctionnels (UI polie déléguée à Codex).

Validations locales : `npm run typecheck`, `npm run test` (67 tests), `npm run compliance`
(5 gates, dont `rls-isolation` réel) → **OK**.

Hors périmètre conservé (étapes ultérieures) : chat streaming, RAG, Stripe, historique/dossiers,
étage 2 du classifieur. Le classifieur couche 1 n'a pas été modifié.

## Étape suivante

Étape 4 — Chat streaming + prompt `public.v2` + tool-calling (`04_CHATBOT §5,§8`).
Pré-requis classifieur restants (post-MVP) : câblage étage 2 (Gemini Flash-Lite / Haiku 4.5),
persistance `classifier_decisions`, diversification du golden set, lexique `out_of_scope`.
