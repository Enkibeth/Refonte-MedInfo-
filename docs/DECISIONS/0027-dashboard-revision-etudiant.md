# ADR-0027 — Dashboard de révision étudiant (planificateur déterministe)

```yaml
status: Proposed
date: 2026-06-28
owner: Hugo Bettembourg
linked_to: [ADR-0003, ADR-0018, ADR-0019, ADR-0026]
```

> Statut `Proposed` : décision soumise à l'arbitrage Hugo **avant** tout changement de
> schéma Supabase (règle #4 de CLAUDE.md). Le moteur déterministe et ses tests sont déjà
> livrés (logique pure, sans table) ; la persistance et l'UI ne seront branchées qu'après
> acceptation.

## Contexte
Les étudiants (en particulier PASS/LAS) échouent souvent non par manque de motivation mais
par incapacité à transformer un programme massif (« 1 200 pages avant le concours ») en une
charge quotidienne concrète et réaliste. Les outils existants (Anki, Notion, Excel, Google
Calendar, ChatGPT) ne calculent pas une charge réaliste sourcée sur le programme médical.

Risque produit : un dashboard « IA magique » qui hallucine volumes, items, collèges ou
priorités. Or la doctrine safe-box (ADR-0003) impose des sorties déterministes et vérifiables.
La feature est **pédagogique et organisationnelle**, jamais clinique : pas de symptôme, pas de
cas patient, pas de diagnostic, pas de CAT, pas de donnée de santé (RGPD/CNIL).

## Décision
1. **Le cœur est un moteur déterministe**, pas l'IA. `src/revision/engine/*` (modules purs,
   testés `tests/unit/revision-planner.test.ts`) : `workload` (volumes → minutes),
   `dates` (fenêtre de jours UTC), `riskScoring` (jauge vert/orange/rouge), `planner`
   (répartition **lissée** de la charge sur les jours disponibles) et `redistribution`
   (recalcul après avancement/report). **Règle d'or : tout chiffre vient de l'utilisateur,
   d'une base validée ou d'un calcul explicite — l'IA n'invente jamais un volume, un item,
   un collège, un rang ou une priorité.**
2. **Intégration conforme à l'archi réelle** (et non au scaffold supposé) : écran plat
   `app/(chat)/revision.tsx` gardé par `<RoleGate feature="revision">`, onglet ajouté dans
   `app/(chat)/_layout.tsx`, visibilité `personas: ['student']` dans
   `src/ai/routing/featureVisibility.ts`. Logique domaine dans `src/revision/`, UI dans
   `src/ui/revision/`. **Pas** de groupe `(student)`, **pas** de `src/features/` (n'existent
   pas dans ce repo).
3. **Dataviz native** (composants React Native token-driven : jauge, charge du jour,
   barres de progression) — pas d'iframe HTML autonome (web-only + token en URL, smell
   retiré de l'analyseur de partiel, ADR-0019).
4. **Persistance (à arbitrer)** : migration `0027_student_revision.sql`, RLS **own-row
   stricte**, tables MVP `revision_plans` / `revision_plan_resources` / `revision_tasks`
   (le rythme personnel vit dans `revision_plans.settings` jsonb plutôt qu'une table
   dédiée). CRUD via client Supabase **scopé au token** (RLS = barrière réelle), comme
   `/api/presentations` (ADR-0026). Test `tests/rls/revision.test.ts` **obligatoire avant
   merge**. Autosave type `presentation_decks` (debounce + `pagehide` keepalive).
5. **AI boost = PHASE 2**, optionnel et borné : nouvel appel LLM ⇒ respect intégral de la
   convention IA admin (feature key `revision_plan_assist` dans `AI_FEATURES`,
   `FEATURE_DEFAULTS`, seed `ai_model_config`, `PROMPT_DEFAULTS`, `getModelForFeature` +
   `getPromptTemplate` + `getRuntimeForFeature`, garde persona serveur, disclosure IA,
   sortie JSON structurée). L'IA propose, l'utilisateur valide ; elle ne modifie jamais le
   plan sans validation.
6. **Base de référentiels EDN = PHASE 3**, ADR séparé : aucune ingestion de contenu
   copyrighté (collèges, LiSA) ; on stocke taxonomie, métadonnées, liens et licences
   (cohérent avec la whitelist RAG, ADR-0014).

## Périmètre MVP (resserré)
Créer un plan en < 5 min (type d'examen, dates, jours indispo, minutes/jour, blocs de
travail, rythme) → le moteur calcule pages/jour, heures/jour, charge hebdo, avance/retard,
jours tampon, niveau de risque ; cocher/reporter une tâche recalcule le plan. **Hors MVP**
(phases suivantes) : burn-down, vue calendrier, AI boost, répétition espacée, référentiels.

## Conséquences
- **Positif** : feature différenciante et monétisable côté étudiant ; cœur fiable et testable
  indépendamment de l'IA ; safe-box préservée (aucune sortie clinique) ; aligné sur les
  patterns existants (RoleGate, RLS own-row, token-scoped CRUD, tokens design).
- **Négatif / coût** : nouvelles tables ⇒ RLS + tests + maintenance ; la répartition lissée
  est un choix par défaut (un mode « front-load » pourra être ajouté) ; la valeur pleine
  (pré-remplissage EDN) dépend de la phase 3, plus lourde juridiquement.
- **Ferme** : pas de bouton « j'ai eu ce cas en stage, aide-moi à faire la CAT » — ce serait
  une bascule MDSW interdite (ADR-0003).

## Statut
Proposed — en attente d'arbitrage Hugo pour la phase persistance (migration 0027 + RLS) et
l'UI. Le moteur déterministe + tests unitaires sont livrés indépendamment.
