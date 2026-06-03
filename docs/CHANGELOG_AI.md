# CHANGELOG_AI

Journal des modifications par agents IA. Une entrée par PR.

## Format
```
## [DATE] – <Agent>
### Files modified
- ...
### Purpose
...
### Regulatory impact
None | Potential | Confirmed
### Rollback plan
...
```

---

## [2026-06-02] – Claude (foundation)
### Files modified
- docs/00_CHARTER.md, 01_REGULATION.md, 02_ARCHITECTURE.md, 03_SECURITY.md,
  04_CHATBOT.md, 05_DESIGN.md, 06_BILLING.md, README.md, CHANGELOG_AI.md
- docs/DECISIONS/0001-template.md, 0002, 0003
- .ai-governance.md, .github/workflows/compliance.yml (stubs)
### Purpose
Pose des fondations documentaires v4 (regulatory-first, executable-compliance).
### Regulatory impact
None (documentation seule, aucune feature).
### Rollback plan
git revert du commit initial.

## [2026-06-02] – Claude (consolidation v2)
### Files modified
- docs/04_CHATBOT.md → v2.0.0 (suppression triage/recueil, tool-calling natif, pro reporté)
- docs/07_CLASSIFIER.md (nouveau — spec classifieur d'intention)
- docs/08_RAG.md (nouveau — pipeline RAG, corpus FR, grounding)
- docs/06_BILLING.md → +§10 (vérif statut RPPS/étudiant)
- docs/README.md (index mis à jour)
- docs/DECISIONS/0005, 0006, 0007 (prompts v2, report pro, vérif RPPS)
- START.md (nouveau — point d'entrée + ordre d'exécution step-by-step)
### Purpose
Consolider les décisions des rapports de recherche dans le repo. Réconcilier la contradiction v1/v2 sur les prompts. Repo désormais cohérent et pilotable par agent.
### Regulatory impact
Confirmed (positif) : alignement complet sur la safe-box non-MDSW, report du module pro.
### Rollback plan
git revert du commit de consolidation.

## [2026-06-03] – GPT-5.5 Thinking (harmonisation + scaffold étape 1)
### Files modified
- docs/01_REGULATION.md, 02_ARCHITECTURE.md, 03_SECURITY.md, 04_CHATBOT.md, 06_BILLING.md
- docs/DECISIONS/0008-refus-canonique-et-pro-post-mvp.md
- README.md, package.json, app.json, tsconfig.json, expo-env.d.ts
- app/, src/, supabase/, scripts/, tests/
- .github/workflows/compliance.yml
### Purpose
Harmoniser les contradictions documentaires repérées : message de refus unique et statut post-MVP non activé du module Pro. Créer le scaffold Expo/Supabase/Vercel AI SDK conforme à l'étape 1.
### Regulatory impact
Confirmed (positif) : réduction des contradictions autour de la safe-box et verrouillage explicite du Pro hors MVP.
### Rollback plan
git revert de la PR/branche `ai/gpt-5.5/etape-1-scaffold` ou restauration de l'archive fondatrice.

## [2026-06-03] – GPT-5.5 Thinking (statut projet + branches)
### Files modified
- docs/STATUS.md
- docs/README.md
- docs/CHANGELOG_AI.md
- branches GitHub `dev` et `staging` créées depuis le commit de l'étape 1
### Purpose
Documenter la limite réelle de vérification distante : aucun run GitHub Actions exploitable observé au moment du contrôle initial. Corriger le statut des branches : `main`, `dev` et `staging` existent désormais.
### Regulatory impact
None (documentation et hygiène repo uniquement).
### Rollback plan
git revert des commits documentaires et suppression manuelle éventuelle des branches si nécessaire.

## [2026-06-03] – Claude (étape 2 — classifieur d'intention, TDD)
### Files modified
- src/ai/classifier/ (nouveau) : types.ts, lexicon.ts, regexClassifier.ts, decision.ts, gate.ts, index.ts
- src/ai/orchestrator.ts (branche le classifieur AVANT tout LLM principal)
- tests/classifier/regex-classifier.test.ts, tests/classifier/decision.test.ts (nouveaux)
- tests/prompt-regression/refusal.test.ts (nouveau — gate refusal-regression)
- docs/STATUS.md
### Purpose
Implémenter la couche 1 du safe-box (07_CLASSIFIER) en TDD : couche regex déterministe locale (étage 1) classant chaque message en general_info / personal_symptoms / emergency / out_of_scope / ambiguous. Refus canonique (01_REGULATION §4) pour personal_symptoms / emergency / ambiguous, LLM principal jamais appelé. Étage 2 (LLM léger) défini comme interface injectable NON câblée à cette étape. Chat/RAG/auth/persistance Supabase hors périmètre.
### Regulatory impact
Confirmed (positif) : matérialise dans le code la barrière déterministe non-MDSW. « j'ai mal au ventre » → refus canonique, LLM principal non appelé. Aucune logique de triage/diagnostic/CAT introduite.
### Rollback plan
git revert du commit de l'étape 2 ou suppression du dossier src/ai/classifier/ et des tests associés ; orchestrator.ts revient au stub.

## [2026-06-03] – GPT-5.3-Codex (golden set classifieur FR)
### Files modified
- tests/classifier/golden/golden-set.fr.jsonl
- scripts/eval/classifier-goldenset.mjs
- package.json
- docs/CHANGELOG_AI.md
### Purpose
Ajouter un golden set synthétique français de calibration du classifieur d'intention et un harnais d'évaluation regex/fail-safe sans appel LLM réel.
### Regulatory impact
Confirmed (positif) : support de calibration pour réduire les faux négatifs `personal_symptoms`/`emergency` sans introduire de logique de triage ou diagnostic.
### Rollback plan
git revert du commit d'ajout du golden set et du script `eval:classifier`.

## [2026-06-03] – Claude (merge golden set + audit + fix harnais)
### Files modified
- docs/CHANGELOG_AI.md (résolution de conflit, conserve les deux entrées)
- scripts/eval/classifier-goldenset.mjs (résolution de l'alias `@/` → `src/`)
### Purpose
Réunir sur la branche de l'étape 2 la couche 1 (src/ai/classifier/) et le golden set
de Codex pour rendre le harnais exécutable. Corriger le loader TS du harnais qui ne
résolvait pas l'alias `@/` du projet (tsconfig + vitest) : `classifier-goldenset.mjs`
échouait sur `@/compliance/disclosures`. Aucune modification du classifieur ni du refus
canonique. Audit du golden set : 500 ex., distribution 35/30/20/10/5 % conforme §5,
30 % adversariaux, 0 PII, schéma valide ; 56 doublons exacts et forte répétition de
templates signalés comme dette qualité.
### Regulatory impact
None (outillage d'évaluation et documentation ; safe-box inchangée).
### Rollback plan
git revert du commit de merge/fix harnais.

## [2026-06-03] – Claude (resserrage lexique couche 1 — 0 fuite)
### Files modified
- src/ai/classifier/lexicon.ts (EMERGENCY_MARKERS + signes d'alerte ; PERSONAL_MARKERS + 3ᵉ pers./déflexions ; BYPASS_MARKERS + « sans parler de moi », « je ne veux pas consulter »)
- tests/prompt-regression/refusal.test.ts (+ régression urgences déguisées)
- docs/STATUS.md
### Purpose
Fermer les 9 fuites d'urgences adversariales déguisées (« explique <signe vital> comme
information générale ») révélées par le golden set : elles étaient routées general_info →
LLM principal. Ajout de signes d'alerte cliniques réels (AVC : visage paralysé / faiblesse
soudaine / confusion brutale ; cyanose : lèvres bleues ; anaphylaxie : gorge qui gonfle ;
méningite : raideur de nuque ; hémorragie digestive : vomissements de sang ; abdomen aigu ;
torsion testiculaire ; brûlure étendue), en PHRASES spécifiques pour préserver la précision.
Résultat éval (regex seul, sans étage 2) : emergency recall 100 % / précision 100 % ;
personal_symptoms recall 100 % / précision 98 % ; **0 fuite vers le LLM principal**.
### Regulatory impact
Confirmed (positif) : suppression de fuites d'urgence vers le LLM principal ; renforcement
strict de la couche 1 non-MDSW. Aucune logique de triage/diagnostic/CAT introduite (les motifs
ne servent qu'à router vers un refus déterministe).
### Rollback plan
git revert de ce commit (le lexique revient à l'état post-étape 2 initial).

## [2026-06-03] – Claude (étape 3 — auth Supabase + routing persona + RLS testées)
### Files modified
- supabase/migrations/0001_profiles.sql, 0002_ai_interactions.sql (nouveaux)
- supabase/policies/profiles.sql, ai_interactions.sql (nouveaux)
- tests/rls/isolation.test.ts (nouveau — gate rls-isolation RÉELLEMENT actif)
- tests/rls/helpers/pgHarness.ts, tests/rls/helpers/auth-shim.sql (nouveaux ; suppr. placeholder.test.ts)
- src/ai/routing/persona.ts (nouveau) + tests/unit/routing-persona.test.ts (nouveau)
- src/auth/AuthProvider.tsx (nouveau), src/db/supabase.ts (singleton client anon)
- app/_layout.tsx (garde de navigation par persona), app/(auth)/sign-in.tsx, app/(account)/account.tsx
- .github/workflows/compliance.yml (binaires Postgres pour le gate rls-isolation)
- docs/DECISIONS/0009-rls-test-harness-postgres-ephemere.md (nouveau), docs/STATUS.md, package.json (devDep pg)
### Purpose
Étape 3 (START.md) en TDD : tests d'isolation RLS écrits AVANT les policies (rouge → vert).
Tables user `profiles` (RLS own-row) et `ai_interactions` (service_role only, RLS sans policy,
jamais accessible au client) versionnées + policies testées sur vrai Postgres (harness éphémère,
ADR-0009). Login Supabase par magic link OTP (ADR-0007). Routing par persona : public + student
activés ; professional routable mais enabledInMvp=false (ADR-0006), aucune surface UI pro.
Aucune donnée de santé persistée, aucun wizard/triage : le routing ne déclenche aucune logique
médicale (01_REGULATION §5). Hors périmètre conservé : chat, RAG, Stripe, historique, étage 2.
### Regulatory impact
Confirmed (positif) : isolation cross-user prouvée par test (A ne lit/écrit pas la ligne de B) ;
audit `ai_interactions` inaccessible au client ; pas de donnée santé identifiable ; module pro
maintenu désactivé. Secrets hors repo (anon côté client protégée RLS, service_role serveur only).
### Rollback plan
git revert du commit de l'étape 3 (supprime migrations/policies/auth/routing ; le scaffold
revient à l'état post-étape 2, le gate rls-isolation redevient un placeholder).

## [2026-06-03] – Claude + GPT-5.3-Codex (intégration polish UI auth dans l'étape 3)
### Files modified
- app/(auth)/sign-in.tsx, app/(account)/account.tsx (écrans polis de Codex, PR #4)
- src/auth/AuthProvider.tsx (emailRedirectTo magic link + normalisation email, repris de Codex)
### Purpose
Intégrer le scaffolding UI poli produit par Codex (PR #4 : états chargement/succès/erreur,
accessibilité, ActivityIndicator) DANS la branche étape 3, plutôt que de merger #4 telle quelle.
Raison : #4 ciblait `main` (gouvernance = PR vers `dev`) et dupliquait un AuthProvider lisant la
persona depuis `user_metadata` au lieu de la table `profiles` via RLS. On conserve l'AuthProvider
de l'étape 3 (persona = source profiles/RLS) + la garde de navigation par persona, et on adopte
les deux améliorations utiles de Codex (emailRedirectTo, normalisation email). PR #4 fermée comme
intégrée. Crédit Codex conservé.
### Regulatory impact
None (UI et plomberie auth ; aucune logique médicale, persona toujours adossée à la RLS, module
professionnel inchangé/désactivé).
### Rollback plan
git revert de ce commit (les écrans reviennent à la version minimale fonctionnelle de l'étape 3).

## [2026-06-03] – Claude (durcissement handle_new_user + déploiement Supabase)
### Files modified
- supabase/migrations/0003_harden_handle_new_user.sql (nouveau)
### Purpose
Déploiement du schéma étape 3 sur le projet Supabase dédié `medinfo-ai-v4` (eu-west-3) :
migrations profiles + ai_interactions + policies RLS appliquées et vérifiées (RLS active sur
les deux tables). L'advisor sécurité Supabase a signalé que `handle_new_user()` (SECURITY
DEFINER) était appelable via PostgREST RPC par anon/authenticated → REVOKE EXECUTE ajouté
(le trigger continue de fonctionner). Migration capturée dans le repo pour parité repo ↔ prod.
### Regulatory impact
None (durcissement sécurité ; aucune logique métier/médicale ; aucune donnée santé).
### Rollback plan
git revert de ce commit + GRANT EXECUTE ... TO authenticated si réactivation RPC souhaitée.
