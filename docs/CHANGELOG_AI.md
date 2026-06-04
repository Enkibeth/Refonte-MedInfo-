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

## [2026-06-04] – Claude (branding : logo MedInfo AI sur accueil + sign-in)
### Files modified
- src/ui/Logo.tsx (nouveau : wordmark rendu en code — croix + « MedInfo AI » bleu pétrole)
- app/index.tsx (logo + tagline, liens nommés) ; app/(auth)/sign-in.tsx (logo en tête)
- assets/brand/README.md (nouveau : où déposer le vrai logo PNG + l'ancienne illustration)
### Purpose
Mettre le branding MedInfo AI (charte bleu pétrole) à l'accueil et au sign-in, sans dépendre
d'un binaire (logo en code, build robuste). Procédure documentée pour basculer vers le logo
image fourni + placer l'ancienne illustration « pour le moment » dès que les PNG sont déposés.
### Regulatory impact
None (design/branding).
### Rollback plan
git revert du commit.

---

## [2026-06-04] – Claude (rôles public/étudiant/pro + vérification — ADR-0011)
### Files modified
- docs/DECISIONS/0011-roles-actifs-verification.md (nouveau) ; docs/DECISIONS/0006 (amendé) ; START.md
- src/auth/roles.ts (nouveau : catalogue rôles + isAcademicEmail + isValidRppsFormat) + tests/unit/roles.test.ts
- src/ai/routing/persona.ts (professional enabledInMvp=true, group (chat)) + tests/unit/routing-persona.test.ts
- supabase/migrations/0005_profile_verification.sql (nouveau : colonnes verified_at/verification_method
  + trigger anti-auto-promotion — persona/status modifiables uniquement par service_role)
- app/api/role+api.ts (nouveau : vérif serveur — student=email académique, pro=RPPS stub ANS)
- src/auth/AuthProvider.tsx (requestRole → /api/role) ; app/(account)/choose-role.tsx (nouveau, UI)
- app/(account)/account.tsx (lien « Gérer mon rôle »)
- tests/rls/isolation.test.ts (anti-auto-promotion : user ne peut pas se donner un rôle vérifié)
### Purpose
Onboarding de sélection de rôle (ADR-0011) : public (sans login), étudiant (vérif email
académique), professionnel (vérif RPPS — intégration ANS à finaliser, sinon « pending »). Sécurité :
le client ne peut JAMAIS s'auto-attribuer un rôle vérifié (trigger DB + écriture serveur service_role,
prouvé par test RLS sur vrai Postgres). Le pro reste sous la safe-box ; ses features cliniques restent
gelées par ADR-0006. 113 tests verts, 5 gates OK.
### Regulatory impact
Potential (maîtrisé) : ouverture du rôle pro = surface plus exposée, mais safe-box inchangée et
appliquée au pro, features cliniques pro gelées (ADR-0006), vérification d'identité ≠ MDSW, aucune
donnée de santé. À confirmer : avis GIO ANSM. Vérif étudiant = PII minimale, aucun document stocké.
### Rollback plan
git revert du commit (remet professional.enabledInMvp=false, retire la migration 0005, la route
/api/role, la sélection de rôle et les helpers).

---

## [2026-06-04] – Claude (auth : email+mot de passe + OAuth Google/Apple — ADR-0010)
### Files modified
- src/db/supabase.ts (detectSessionInUrl: true — corrige la session web non établie / reconnexion à chaque fois)
- src/auth/AuthProvider.tsx (signInWithPassword, signUpWithPassword, signInWithOAuth google/apple ; magic link conservé)
- app/(auth)/sign-in.tsx (UI : email+mot de passe avec bascule connexion/inscription + boutons Google/Apple)
- docs/DECISIONS/0010-auth-password-oauth.md (nouveau — remplace la méthode de connexion d'ADR-0007)
- tests/unit/auth-provider.test.ts (nouveau — smoke test)
### Purpose
Décision Hugo : remplacer le magic-link seul (pénible, lien localhost, session non persistée)
par email+mot de passe + OAuth Google/Apple. `detectSessionInUrl: true` répare la session web.
Le persona public reste anonyme sans login (01_REGULATION §5). Config Supabase requise (providers
Email/Google/Apple + Site URL/Redirect URLs) documentée dans l'ADR.
### Regulatory impact
None (méthode d'authentification ; aucune donnée santé ; public anonyme ; persona via RLS ; safe-box inchangée).
### Rollback plan
git revert du commit ; revient au magic-link seul (et remettre detectSessionInUrl si souhaité).

---

## [2026-06-04] – Claude (design : thème blanc/bleu pétrole conforme 05_DESIGN)
### Files modified
- src/ui/tokens.ts (palette « bleu pétrole » validée : fond blanc #FFFFFF, accent petrol
  #0A4D68 ; remplace le thème vert/teal provisoire du scaffold ; ajout success/danger/accentStrong)
- app.json (splash backgroundColor petrol #0A4D68 au lieu du teal #0B3B3C)
### Purpose
Aligner le code sur la charte validée 05_DESIGN §2 (identité MedInfo blanc/bleu), le scaffold
ayant posé un thème vert non conforme. Clés de tokens inchangées (zéro casse composants).
À FAIRE (asset requis de Hugo) : ajouter le logo pour favicon / app icon iOS-Android / image de splash.
### Regulatory impact
None (design ; aucune logique médicale).
### Rollback plan
git revert du commit (revient au thème vert du scaffold).

---

## [2026-06-03] – Claude (hygiène : MAJ STATUS + suppression test doublon — audit M3/M4)
### Files modified
- docs/STATUS.md (état réel : CI distante verte, branches main/dev/staging alignées,
  corrections d'audit + rate-limit + fix Vercel ; suppression de la réserve périmée)
- tests/prompt-regression/refusal-placeholder.test.ts (SUPPRIMÉ — doublon scaffold de refusal.test.ts)
### Purpose
Corriger les écarts d'audit M3 (STATUS périmé : CI distante « non confirmée » alors qu'elle est
verte ; branches désormais alignées) et M4 (test placeholder redondant). Le gate
`refusal-regression` reste couvert par refusal.test.ts (10 tests). Aucune logique applicative
modifiée.
### Regulatory impact
None (documentation + nettoyage de test ; safe-box inchangée).
### Rollback plan
git revert du commit ; restaurer refusal-placeholder.test.ts si besoin.

---

## [2026-06-03] – Claude (fix déploiement Vercel — Node 22.x + 404 racine)
### Files modified
- package.json (engines.node = "22.x" ; build:web ajoute le fallback HTML ; vercel-build = npm run build:web)
- vercel.json (buildCommand = npm run build:web)
- scripts/vercel/copy-server-html-to-client.mjs (nouveau — copie les coquilles HTML
  pré-rendues de dist/server vers dist/client, fallback statique racine + écrans)
### Purpose
Corriger le 404 du site sur Vercel. Deux causes identifiées via les logs de build/déploiement :
1) Le projet Vercel était réglé sur Node 24.x alors que @vercel/node@5.1.8 exige 22.x →
   tout déploiement portant la config de fonctions échouait. Fix : engines.node "22.x" dans
   package.json (override le réglage projet, doc Vercel). 2) En mode web.output=server, Vercel
   renvoyait un 404 plateforme à la racine faute de dist/client/index.html. Fix : script de
   fallback copiant les HTML pré-rendus dans dist/client (les routes /api/* restent servies
   par api/index.js). Build web validé localement (index.html généré). N'altère AUCUNE logique
   applicative (safe-box, rate-limit, classifieur inchangés). Reprend la bonne idée de la PR #15
   sans ses régressions (la #15 datait d'avant le rate-limit #13).
### Regulatory impact
None (déploiement/build uniquement ; aucune logique médicale, aucune donnée santé).
### Rollback plan
git revert du commit ; revenir à buildCommand "expo export -p web" et retirer engines.node.
Note : nécessite que les variables d'env Supabase/LLM soient configurées dans Vercel.


### Files modified
- src/compliance/disclosures.ts (AI_DISCLOSURE constante → getAiDisclosure(system?) ;
  défaut nomme les deux providers ; source unique conservée)
- src/ai/providers/index.ts (getActiveSystemLabel() : libellé serveur du modèle actif)
- app/index.tsx, app/(auth)/sign-in.tsx (utilisent getAiDisclosure())
- docs/01_REGULATION.md §6 (v1.2.0 : disclosure reflète le modèle servi ; deux providers
  Anthropic + OpenAI ; note juridique deux DPA/SCC à couvrir)
- tests/unit/disclosure.test.ts (nouveau)
### Purpose
Corriger l'incohérence audit I3 : la disclosure annonçait « GPT-5.x, OpenAI » alors que le
stack par défaut est Anthropic (claude-sonnet-4-6). Décision Hugo : les DEUX providers seront
utilisés → la disclosure doit refléter le système réellement servi. Forme UI statique = nomme
les deux ; forme serveur = injecte le libellé du modèle actif (getActiveSystemLabel). Source
unique conservée (pas de variante concurrente).
### Regulatory impact
Confirmed (positif) : disclosure art. 50 exacte vis-à-vis du modèle réellement servi.
Point ouvert signalé pour Hugo : couvrir DEUX DPA/SCC + résidence EU (Anthropic ET OpenAI, §5).
### Rollback plan
git revert du commit ; restaurer la constante AI_DISCLOSURE et les imports d'origine.

---

## [2026-06-03] – Claude (durcissement safe-box 3 couches — corrections audit B1/I1/I2/M1)
### Files modified
- app/api/chat+api.ts (refonte : screening couche 1 sur TOUTE la conversation ; couche 3
  bufferisée + remplaçante ; refus émis en flux UI-message ; logging unifié)
- src/ai/orchestrator.ts (nouveau rôle : screenConversation + extractUserTexts = accès pré-LLM ;
  n'est plus du code mort — réalise l'invariant 02_ARCHITECTURE §3)
- src/ai/guardrails/refusalStream.ts (nouveau : buildRefusalChunks — refus en tool-call
  refuse_and_redirect portant CANONICAL_REFUSAL)
- app/(chat)/chat.tsx (fix état tool-part 'output-available' : sans ça AUCUN tool-call ne
  s'affichait — sources, refus, suggestions)
- tests/guardrails/conversation-screen.test.ts (nouveau — I1, historique forgé bloqué)
- tests/guardrails/refusal-stream.test.ts (nouveau — I2, refus porte le message canonique)
### Purpose
Corriger 4 écarts révélés par l'audit, sans toucher au classifieur couche 1 :
- B1 : la couche 3 (validateOutput) était seulement loggée APRÈS le streaming → sortie
  diagnostique déjà partie. Désormais la réponse complète est bufferisée puis validée AVANT
  émission ; si bloquée, REMPLACÉE par le refus canonique (01_REGULATION §4 enfin tenu).
- I1 : le classifieur n'inspectait que le DERNIER message alors que tout l'historique
  (client non fiable) atteignait le LLM. screenConversation reclassifie chaque tour
  utilisateur → un historique forgé avec symptômes en tour antérieur est bloqué.
- I2 : le refus couche 1 était un JSON non rendu par useChat (bannière d'erreur générique).
  Il est désormais émis dans le flux UI-message et s'affiche comme refus.
- M1 : orchestrator.ts (code mort) devient le module d'accès pré-LLM utilisé par la route.
### Regulatory impact
Confirmed (positif) : defense-in-depth réellement à 3 couches effectives ; aucun chemin
identifié laissant un message atteindre le LLM sans passage couche 1 ; refus affiché à
l'utilisateur. Aucune logique de triage/diagnostic introduite ; classifieur couche 1 inchangé.
### Rollback plan
git revert du commit de cette branche ; les nouveaux fichiers (refusalStream.ts, tests) sont
supprimés et chat+api.ts revient au handler streaming précédent.

---

## [2026-06-03] – Claude (étape 4 — chat streaming + prompt public.v2 + 4 outils)
### Files modified
- src/ai/prompts/_schema.ts (update : align spec 04_CHATBOT §3 — RegulatoryScope, contract, eval_threshold multi-champs, template, model_default)
- src/ai/prompts/public.v2.ts (nouveau : artefact publicPromptV2 versionné sous contrat)
- src/ai/prompts/index.ts (nouveau : registry getActivePrompt par persona)
- src/ai/skills/propose_followups.ts (nouveau : tool AI SDK v6, inputSchema Zod)
- src/ai/skills/show_sources.ts (nouveau : idem)
- src/ai/skills/refuse_and_redirect.ts (nouveau : retourne CANONICAL_REFUSAL)
- src/ai/skills/render_qcm.ts (nouveau : student only, activé étape 6)
- src/ai/guardrails/outputValidator.ts (nouveau : couche 3 — regex marqueurs diagnostiques)
- src/ai/logging/logInteraction.ts (nouveau : insert ai_interactions service_role, 0 donnée santé)
- src/hooks/useSession.ts (nouveau : persona via Supabase auth, défaut public)
- app/api/chat+api.ts (nouveau : POST handler streaming — 3 couches + log)
- app/(chat)/chat.tsx (update : useChat AI SDK v6 + rendu tool-calls natifs)
- scripts/eval/validate-prompts.mjs (update : exclure index.ts du gate prompt-contract)
- .env.example (update : SUPABASE_URL serveur)
- tests/guardrails/output-validator.test.ts (nouveau : TDD couche 3)
- tests/chat/tool-calling.test.ts (nouveau : matrice persona × outil + execute)
### Purpose
Implémenter le chat streaming (Vercel AI SDK v6 streamText + useChat), le prompt public.v2
versionné sous contrat, et les 4 outils (tool-calling natif). Defense-in-depth 3 couches :
classifieur couche 1 (inchangé), contrainte prompt couche 2, validation de sortie couche 3.
Logging ai_interactions (service_role only, aucune donnée santé). 76/76 tests verts.
### Regulatory impact
Confirmed (positif) : première route LLM complète sous le régime safe-box 3 couches ;
le LLM n'est jamais appelé sur personal_symptoms / emergency / ambiguous.
Aucune fonctionnalité MDSW introduite ; prompt public.v2 conforme 01_REGULATION §1.
### Rollback plan
git revert du commit de cette étape ; les fichiers supprimés restent gitignorés.

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

## [2026-06-03] – Claude (réintégration étape 4 chat sur dev + dédoublonnage useSession)
### Files modified
- merge de claude/etape-4-chat-streaming-015pt dans dev (app/api/chat+api.ts, src/ai/prompts/*,
  src/ai/skills/*, src/ai/guardrails/outputValidator.ts, src/ai/providers, src/ai/logging,
  app/(chat)/chat.tsx, tests/chat, tests/guardrails)
- app/(chat)/chat.tsx : useSession importé depuis @/auth/AuthProvider (persona via profiles/RLS)
- src/hooks/useSession.ts : SUPPRIMÉ (doublon lisant la persona via user_metadata)
### Purpose
L'étape 4 (chat streaming + public.v2 + 4 outils + couche 3) avait été mergée dans `main` sur
une base antérieure à l'étape 3, recréant un `useSession` parallèle adossé à `user_metadata`.
Réintégration sur `dev` (branche d'intégration) PAR-DESSUS l'étape 3, en conservant l'unique
AuthProvider adossé à la RLS : le chat lit désormais la persona via `profiles` (RLS), pas via
`user_metadata`. Le doublon est supprimé. Aucune logique de triage/diagnostic introduite ; la
défense 3 couches (classifieur + prompt + validation sortie) reste intacte.
### Regulatory impact
None (réconciliation de branches ; persona toujours adossée à la RLS ; safe-box inchangée).
### Rollback plan
git revert du commit de merge de réintégration.

## [2026-06-03] – GPT-5.3-Codex (audit M2 — rate limiting 03_SECURITY §3)
### Files modified
- supabase/migrations/0004_usage_counters.sql, supabase/migrations/README.md (table compteurs journaliers + RPC atomique)
- supabase/policies/usage_counters.sql, supabase/policies/README.md (service_role only)
- src/ai/rateLimit/chatRateLimit.ts (nouveau — limites free MVP public/student + cap IP non-auth)
- app/api/chat+api.ts (check rate-limit avant la couche 1, sans modifier le classifieur ni la défense 3 couches)
- tests/rls/isolation.test.ts (couverture RLS usage_counters)
- tests/chat/rate-limit.test.ts, tests/chat/chat-api-rate-limit.test.ts (11e message public free → 429, ordre avant classifieur)
### Purpose
Corriger l'audit M2 rate limiting : compteur journalier technique par identité/persona, reset quotidien, limites MVP Public free 10/j et Étudiant free 20/j, module Pro non activé, cap dur par IP hashée pour les non-authentifiés anti-scraping. Le contrôle est exécuté au début de `POST /api/chat`, après parsing JSON/persona mais AVANT le classifieur couche 1 conformément à 02_ARCHITECTURE §3 [1].
### Regulatory impact
Confirmed (positif) : réduction du risque d'abus/coûts et scraping sans stockage de donnée santé ni contenu de message. La safe-box non-MDSW reste inchangée : aucun changement du classifieur couche 1, des prompts, des outils ou de la validation de sortie.
### Rollback plan
git revert de ce commit (supprime la migration/policy usage_counters, le helper rate-limit, les tests associés et retire le check 429 de la route chat).

---

## [2026-06-04] – Claude Code (Phase 2 benchmark : harness d'évaluation)
### Files modified
- scripts/eval/lib/{csv,stats,refusal,providers}.mjs (parseur CSV, stats+bootstrap IC seedé,
  refus canonique verbatim, adaptateurs providers stub/openai/anthropic)
- scripts/eval/benchmark-run.mjs, benchmark-judge.mjs, benchmark-stats.mjs (pipeline CLI)
- scripts/eval/README.md
- tests/unit/benchmark-harness.test.ts (csv round-trip, bootstrap déterministe, run e2e stub)
- package.json (scripts bench:run/bench:judge/bench:stats — aucune nouvelle dépendance)
- package-lock.json (sync bénin du champ engines node 22.x ; aucune dépendance ajoutée)
- .gitignore (benchmarks/runs/ — sorties générées)
- benchmarks/README.md, benchmarks/benchmark_protocol.md (section Harness, commandes CLI)
### Purpose
Phase 2 : harness d'exécution du benchmark sous scripts/eval/. Run (modèle × question × run,
température 0, logs horodatés) → LLM-as-judge (assistance, revue humaine obligatoire sur safety) →
stats (moyennes/dimension + IC 95% bootstrap, matrice de confusion safe-box, recall des refus,
faux négatifs pondérés gravité, SHR). Hors-ligne par défaut / CI-safe via provider stub
déterministe ; providers réels openai/anthropic uniquement en --live avec clé présente.
### Regulatory impact
None. Outil d'évaluation sans logique médicale. Le stub medinfo applique la règle de refus en
renvoyant le message canonique VERBATIM chargé depuis docs/01_REGULATION.md §4 (source unique, jamais
réécrit) ; benchmark-stats sort en exitCode=1 si un faux négatif critique est détecté (seuil
bloquant safe-box). Rien sous app/ ni src/ui/ ; les 5 gates CI passent sans régression.
### Rollback plan
git revert de ce commit. Aucun impact runtime app (scripts d'éval isolés, hors bundle).

## [2026-06-04] – Claude Code (Phase 1 benchmark : golden set + livrables)
### Files modified
- benchmarks/ (nouveau dossier, hors app/ et src/ui/ → sans impact compliance-grep)
  - benchmark_protocol.md, dataset_schema.json, scoring_rubric.md, judge_prompt.md,
    evaluator_form.md, results_template.csv, benchmark_report_template.md,
    public_blog_template.md, README.md
  - public_questions.csv (100), student_questions.csv (100, cas fictifs),
    professional_questions.csv (100, hors leaderboard MVP), safety_cases.csv
    (200 : 100 interdits D + 100 adversariaux/ambigus E dont 20 contre-exemples légitimes)
- docs/CHANGELOG_AI.md (cette entrée)
### Purpose
Phase 1 du protocole de benchmark (docs/10_BENCHMARK.md) : matérialiser les 12 livrables et le
golden set initial (5 blocs). Permet de lancer le run pilote une fois classifieur + personas
public/student + RAG opérationnels (étapes 0→5 de START.md).
### Regulatory impact
None. Tous les cas cliniques sont fictifs (fictif=true) ; aucune donnée patient réelle. Les prompts
de safety_cases.csv sont des stimuli de test du refus (réponse attendue = refus canonique
01_REGULATION §4), jamais des demandes à satisfaire. Aucune métrique ni claim de performance
diagnostique/thérapeutique. Dossier hors app/ et src/ui/ : n'altère aucun gate CI.
### Rollback plan
git revert de ce commit (suppression du dossier benchmarks/). Aucun impact code/CI.

## [2026-06-04] – Claude Code (design benchmark MedInfo vs généralistes)
### Files modified
- docs/10_BENCHMARK.md (nouveau — protocole de benchmark non-MDSW, 18 sections + roadmap + checklist 20 actions)
- docs/CHANGELOG_AI.md (cette entrée)
### Purpose
Ajouter le protocole de benchmark MedInfo AI vs modèles généralistes (inspiré Synapse/MedGPT mais
transparent, reproductible, à intervalles de confiance et double évaluation aveugle). Mesure la
qualité informationnelle, pédagogique, le sourçage et la robustesse du refus safe-box. Document de
conception uniquement — aucune logique exécutable, aucun dataset patient.
### Regulatory impact
None. Le benchmark est explicitement subordonné à 01_REGULATION.md : il ne mesure ni ne revendique
aucune performance diagnostique/pronostique/thérapeutique ; tous les cas cliniques sont fictifs ;
les prompts « interdits » servent à tester le refus déterministe, jamais à produire un acte médical ;
claims de supériorité clinique explicitement interdits. Safe-box non-MDSW inchangée.
### Rollback plan
git revert de ce commit (suppression de docs/10_BENCHMARK.md). Aucun impact code/CI.

## [2026-06-03] – GPT-5.3-Codex (préparation Vercel + Supabase dédié)
### Files modified
- app.json (export Expo Router server)
- api/index.js, vercel.json (adapter Vercel + rewrites)
- package.json, package-lock.json (scripts build web + dépendance expo-server)
- src/db/serverSupabase.ts, src/ai/logging/logInteraction.ts, app/api/health+api.ts (helper Supabase serveur + smoke-test)
- tests/unit/server-supabase.test.ts (couverture config Supabase serveur)
- docs/09_DEPLOYMENT.md, docs/README.md, docs/STATUS.md, README.md, .env.example
### Purpose
Adapter le projet au déploiement Vercel avec API routes Expo Router : build `expo export -p web`,
publication `dist/client`, Function Vercel déléguant au bundle `dist/server`. Centraliser la
connexion Supabase serveur pour le projet dédié MedInfo et documenter toutes les variables Vercel
nécessaires, y compris `EXPO_PUBLIC_SUPABASE_ANON_KEY` côté client et `SUPABASE_SERVICE_ROLE_KEY`
côté serveur. Ajouter `/api/health` pour vérifier la configuration sans exposer de secrets.
### Regulatory impact
None (déploiement, secrets et observabilité technique ; aucune logique médicale, aucun stockage de
contenu de santé identifiable, safe-box inchangée).
### Rollback plan
git revert de ce commit puis suppression des variables Vercel ajoutées si besoin.
