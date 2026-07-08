# ADR-0032 — Dashboard ECOS : historique des passages et notes

```yaml
status: Accepted
date: 2026-07-08
owner: Hugo Bettembourg
supersedes: —
relates: ADR-0013 (cas ECOS en DB → 0017), ADR-0017, ADR-0026 (pattern own-row), ADR-0027
```

## Contexte

Le module ECOS (étudiants vérifiés) proposait une simple liste de cas : aucune trace des
stations déjà passées, aucune note conservée, aucun moyen de savoir quels thèmes retravailler.
Demande Hugo (2026-07) : refaire le dashboard ECOS avec les ECOS passés, des filtres, un
classement par thème, la note de chaque cas visible directement, le nombre d'ECOS disponibles
et la note globale.

## Décision

1. **Table `ecos_attempts` (migration `0035`)** — une ligne par passage : `case_slug`,
   `case_title`, `specialty`, `score numeric(4,1)` (nullable, CHECK 0–20), `evaluation`
   (markdown complet du feedback), `created_at`. RLS **own-row stricte** et passage
   **immuable** : policies select/insert/delete propriétaire, **aucun UPDATE** (ni policy ni
   grant) — une note ne se retouche pas après coup. CRUD client via la clé anon
   (`src/ecos/attemptsDb.ts`), même pattern que `revision_plans` (ADR-0027).
   La **transcription de la simulation n'est PAS conservée** : seuls la note et le feedback
   pédagogique le sont (minimisation ; les cas restent des vignettes fictives, ADR-0017).

2. **Note extraite DÉTERMINISTIQUEMENT, jamais inventée** — le prompt `ecos_evaluate`
   (promptStore, éditable panel admin) exige désormais la ligne « **Note : X/20** » en tête du
   Résultat global ; `src/ecos/score.ts` extrait la première fraction « x/20 » de façon
   tolérante (décimales point/virgule) et renvoie `null` si aucune note fiable n'est trouvée
   (affichée « —/20 », le passage est archivé quand même). Barème couleur : ≥ 14 vert,
   10–13,9 ambre, < 10 rouge.

3. **Dashboard** (`app/(chat)/ecos.tsx`, phase sélection refondue) — stats globales (cas
   disponibles, passages, note globale = moyenne des notes connues, meilleure note), filtres
   (recherche, thème = spécialité, statut fait/à faire), cas groupés par thème avec meilleure
   et dernière note sur chaque carte, historique des derniers passages avec reconsultation de
   l'évaluation (hero de note, export PDF/copie, suppression du passage, « repasser ce cas »).
   Logique de calcul/filtre/groupement en module pur `src/ecos/dashboard.ts`.

4. **Duplication de prompt supprimée** — le client n'envoie plus le gabarit d'examinateur en
   double : `systemPrompt` = contexte de la station seulement, le cadre d'évaluation vient du
   prompt serveur `ecos_evaluate` (source de vérité unique, admin-éditable).

## Sécurité / conformité

- Donnée pédagogique (notes d'entraînement sur cas fictifs) — jamais de patient réel,
  d'historique patient ni de donnée de santé ; la safe-box n'est pas concernée.
- Archivage best-effort côté client : un échec d'insert n'empêche jamais l'affichage de
  l'évaluation (bandeau discret « non enregistré »).
- Tests : `tests/rls/ecos-attempts.test.ts` (isolation own-row + immuabilité + contrainte de
  barème), `tests/unit/ecos-dashboard.test.ts` (extraction de note, stats, filtres, groupes).
- Aucune nouvelle feature IA : pas d'appel LLM ajouté, pas de ligne `ai_model_config`.

## Alternatives écartées

- **Archivage serveur (service role) dans `/api/ecos`** : l'évaluation revient en JSON au
  client présent à l'écran — l'insert client sous RLS suffit et évite d'élargir la route.
- **Note structurée renvoyée par l'IA (JSON)** : fragile multi-providers ; l'extraction
  regex sur un format imposé + repli `null` est déterministe et fail-safe.
- **Conserver la transcription** : refusée (minimisation ; le feedback référence déjà la
  grille).

## Suivi

- Si un jour la note doit devenir corrigeable (litige), passer par une nouvelle décision —
  pas d'UPDATE silencieux.
- Statistiques par thème (moyenne par spécialité) : extension naturelle de
  `src/ecos/dashboard.ts` si le besoin se confirme.
