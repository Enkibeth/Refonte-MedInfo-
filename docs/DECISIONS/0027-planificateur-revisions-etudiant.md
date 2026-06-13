# ADR-0027 — Planificateur de révisions étudiant (dashboard)

```yaml
status: Accepted
date: 2026-06-13
owner: Hugo Bettembourg
linked_to: [ADR-0003, ADR-0011, ADR-0016, ADR-0018, 0027_revision_plans.sql]
```

## Contexte
Beaucoup d'étudiants (surtout PASS/LAS) ne manquent pas de motivation mais n'arrivent pas
à transformer un programme massif (« 1 200 pages avant le concours ») en charge quotidienne
concrète. Décision Hugo : ajouter un **planificateur de révisions** réservé au persona
**student**, pensé comme un **outil pédagogique d'organisation**, pas comme un « coach
médical ». Le cœur doit être un **moteur déterministe** fiable et testable, l'IA n'étant
qu'un « boost » optionnel ajouté **plus tard** (différé, voir « Suivi »).

## Périmètre réglementaire (safe-box non-MDSW, ADR-0003)
La feature manipule **uniquement** des données pédagogiques et d'organisation du travail :
volumes (pages/chapitres/QCM), dates, rythme personnel déclaré, progression d'apprentissage,
préférences de révision. Elle ne demande **jamais** de symptôme, n'analyse **aucun** cas
patient, ne produit **ni** diagnostic, **ni** conduite à tenir, **ni** prescription, **ni**
score clinique. Aucune donnée de santé personnelle n'est collectée. Reste donc hors
qualification dispositif médical (finalité purement organisationnelle/éducative).

## Décision
1. **Moteur déterministe** (`src/features/revision/engine/`, modules PURS, sans IA ni
   réseau) : `workload.ts` (volumes → minutes via la vitesse déclarée), `riskScoring.ts`
   (vert/orange/rouge selon charge/jour vs plafond, tampon, débordement), `planner.ts`
   (répartition lissée du **restant** sur les jours **restants**, tampon final réservé,
   détection de débordement, révision espacée optionnelle), `dates.ts` (calcul de dates
   UTC sans fuseau). **Règle d'or** : aucun chiffre n'est inventé — tout vient de
   l'utilisateur ou d'un calcul explicite. Tests :
   `tests/unit/revision-planner.test.ts` (13), `tests/unit/revision-workload.test.ts` (7).
   « Recalcul après retard » = rappeler le moteur avec une date `today` avancée et des
   compteurs `completed_*` à jour ; la redistribution est automatique (moteur idempotent).
2. **Persistance own-row** (migration `0027_revision_plans.sql`, RLS **stricte**) :
   - `revision_plans` : période (dates, plafond/jour), vitesse perso, ratio tampon,
     révision espacée, repos/indispos, statut. CRUD propriétaire seul.
   - `revision_plan_items` : blocs de travail (matière/collège/chapitre, volumes,
     `completed_*`, priorité, maîtrise). Policies own-row **+** appartenance à UN plan du
     même utilisateur à l'insert (pattern `chat_messages`, migration 0020).
   Les **tâches quotidiennes ne sont PAS stockées** : elles sont **dérivées** du plan + des
   blocs par le moteur, à la volée. Test `tests/rls/revision-plans.test.ts`.
3. **Route CRUD `/api/revision`** (≠ feature IA, aucun LLM) : GET liste, GET `?id=`,
   POST upsert (remplace les blocs — le client tient l'état complet), DELETE. Client
   Supabase **scopé au token** → la RLS est la barrière réelle (jamais `service_role`,
   jamais le body pour l'autorisation). Bornage pur et testé : `src/features/revision/plans.ts`
   (`tests/unit/revision-plans-payload.test.ts`).
4. **Écran natif** `app/(chat)/revision.tsx` (Expo Router, groupe `(chat)`), gardé par
   `<RoleGate feature="revision">`. Visibilité persona **student** (+ admin) via
   `featureVisibility.ts` (onglet, ToolsMenu, RoleGate) — jamais l'unique barrière, la
   route reste protégée côté serveur par le token. Tableau de bord visuel « anti-panique » :
   statut couleur, cartes de charge, tâches du jour cochables, timeline des prochains jours,
   blocs avec progression ; éditeur de création/édition (dates, rythme, blocs).
   Composants : `RevisionDashboard.tsx`, `PlanEditor.tsx`.

## Conséquences
- Nouvel outil étudiant à forte valeur, découplé du chatbot (séparation nette du médical).
- Le moteur précède l'IA : la fiabilité ne dépend d'aucun appel LLM.
- Donnée stockée = pédagogique uniquement ; protégée own-row comme les autres tables user.
- Quotas/abonnement (gratuit vs premium étudiant) : **non décidés**, à brancher via la
  matrice d'entitlements (ADR-0016) si besoin — non bloquant pour l'ébauche.

## Suivi (différé, hors de cet ADR)
- **AI Boost** (optimiser/rééquilibrer/expliquer un plan) : outil IA **borné** qui *propose*
  sans jamais modifier sans validation, n'invente aucun volume/source, ne donne aucun conseil
  médical. À introduire derrière un prompt versionné dédié + registre `AI_FEATURES`.
- **Base de référentiels** (items EDN, collèges, rangs A/B/C, pages) pour pré-remplir les
  blocs : **aucune ingestion de contenu copyrighté** ; uniquement taxonomie/métadonnées/liens
  + statut de licence. ADR + pipeline d'import séparés.

## Rollback
Masquer l'onglet (`personas: []` dans `featureVisibility.ts`) ou retirer la `Tabs.Screen`
`revision`. Désactiver `/api/revision`. La table `revision_plans`/`revision_plan_items` peut
rester inerte ou être supprimée par une migration descendante. Aucune autre feature n'en dépend.
