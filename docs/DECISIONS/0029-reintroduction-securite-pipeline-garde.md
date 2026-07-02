# ADR-0029 — Réintroduction de la sécurité du chat : pipeline gardé + sous-agents outils

```yaml
status: Proposed
date: 2026-07-02
owner: Hugo Bettembourg (arbitrage produit)
supersedes: complète ADR-0024 (suivi « sécurité à réintroduire ») ; s'inspire d'ADR-0023 (leçon du sur-refus)
```

## Contexte

L'ADR-0024 a fait de `/api/chat` un appel LLM direct et planifiait la réintroduction
de la sécurité « sans sur-refus » après validation de l'ébauche par Hugo. Demande
produit : un orchestrateur + sous-agents — base commune aux 3 chatbots (garde-fous,
vérificateur de liens/sources) + spécificités par persona (pro : recherche d'articles).
La conception a été validée par simulation sur le vrai code (golden set 500 messages,
modules ea616fc rejoués, tests réseau HAS/doi.org/Europe PMC).

## Décision

1. **Pipeline gardé streamé** (pas d'orchestrateur « composeur ») : garde d'entrée
   rapide → LLM principal streamé (sous-agents branchés en OUTILS) → validation de
   sortie incrémentale → vérification des liens non-bloquante. Le streaming et le
   contrat de sortie textuel v3 sont intacts. Orchestrateur = `src/ai/chat/pipeline.ts`
   (module pur, deps injectées), route mince.
2. **Garde d'entrée à 2 étages** (`src/ai/chat/guard/`, nouveau code — pas de flag) :
   lexiques regex repris de la safe-box ea616fc (+ trous corrigés : « mon médecin »,
   « dis-moi ce que j'ai », apostrophes typographiques ’ normalisées) ; étage 2 LLM
   (feature `chat_guard`, `gemini-2.5-flash-lite`, timeout 1,5 s) qui ne peut que
   DÉGRADER un hit personnel vers « passe » — jamais escalader.
3. **Inversion assumée du fail-closed** (leçon ADR-0023 : 71 % de sur-refus sur les
   questions légitimes du golden set) : seuls `emergency` (redirection 15/112, jamais
   soumis au LLM) et `personal_symptoms` manifestes bloquent ; `ambiguous`/
   `general_info`/`out_of_scope` passent — le prompt v3 est la couche de prudence.
   Erreur/timeout de l'étage 2 → verdict regex conservé (fail-closed sur la branche
   personnelle uniquement). Golden set rejoué : rappel urgences 100 %, symptômes
   personnels 100 %, sur-refus general_info 0/175.
4. **Exception pédagogique AVANT le verrou urgence** (persona étudiante vérifiée) :
   une vignette « cas clinique fictif ECOS : douleur thoracique » passe ; patient
   réel ou 1ʳᵉ personne → refus (repris de `screenConversation`). La garde n'évalue
   que le DERNIER message utilisateur (l'historique client n'est pas une source de
   vérité ; risque résiduel accepté, couvert par prompt v3 + validation de sortie).
5. **Refus = jamais un cul-de-sac (UX)** : texte pur au format v3 — refus canonique
   VERBATIM (`CANONICAL_REFUSAL`, source unique) + section INTERACTION d'options
   cliquables : reformulations de la question en questions d'INFORMATION GÉNÉRALE
   proposées par l'étage 2 (jamais de conseil, jamais « vous »), options génériques
   en repli ; urgence = bandeau 15/112 + options d'information. Un clic renvoie la
   question générale dans le pipeline normal. Aucun changement UI (parseur existant).
6. **La garde passe AVANT le rate-limit** : un refus ne consomme jamais le quota
   (cohérent avec « un refus ne devient pas une réponse payante », ADR-0016).
7. **Rate-limit rebranché sur le chat** (`checkChatRateLimit`) : 10/j public, 20/j
   étudiant, illimité pro (correction du `professional: 0` qui aurait bloqué tout
   message pro) et abonnés. 429 avec `reset_at` + `Retry-After` ; bannière client
   dédiée sans bouton Réessayer (réessayer reconsommerait le quota).
8. **Mode tri-état `MEDINFO_GUARDRAILS`** = `enforce` (défaut) / `log` (observation :
   verdicts journalisés dans `ai_interactions` sans bloquer — première semaine de
   déploiement) / `off` (kill-switch d'incident). En mode log,
   `guardrail_layer='classifier'` + `refusal_triggered=false` = « aurait refusé ».
9. **`ai_interactions` renseigné avec les vraies valeurs** (`intent_category`,
   `guardrail_layer`, `refusal_triggered`) — plus de valeurs figées.

## Phases suivantes (même ADR, PR distinctes)

- **PR2 — validation de sortie streaming** : `gateUiMessageStream`/`outputValidator`
  repris d'ea616fc, marqueurs avec gardes contextuelles anti-faux-positifs (pas de
  `\b` après un caractère accenté ; apostrophes `[e'’]` ; `(?<!si )vous souffrez…`),
  wrapping `createUIMessageStream`, re-validation dans `onFinish` avant archivage.
- **PR3 — vérificateur de sources non-bloquant** : module HTTP pur (`sourceCheck/`),
  endpoint `POST /api/chat-verify-sources` (pas une feature IA : aucun LLM), badges
  sur les cartes SOURCES. Verdicts affinés par tests réels : soft-404 HAS (200 sur
  page inexistante → jamais « vérifié » sur code seul), doi.org en redirect manual
  (30x = DOI résout ; suivre → 403 anti-bot), fallback Scholar jamais testé,
  cache 24 h par URL.
- **PR4 — sous-agents par persona (outils du LLM principal, HTTP purs)** :
  pro → `search_articles` (Europe PMC REST : PMID/DOI/titre/année structurés,
  filtrer les entrées sans PMID ni DOI) ; public → `search_official_guidance`
  (RAG HAS/ANSM existant, cite-or-refuse) ; étudiant → web_search seul, le corpus
  « 36 Collèges » promis par le prompt N'EXISTE PAS (droits d'auteur — chantier
  séparé, écart documenté). `stopWhen: stepCountIs(4)` obligatoire.
- **PR5 — clôture** : CLAUDE.md (règle #2 rétablie sous forme adaptée), statut
  Accepted, monitoring des taux de refus.

## Conséquences

- La couche 1 est rétablie sous une forme nouvelle (pas une résurrection du
  classifieur : politique inversée, chemins neufs `src/ai/chat/guard/`).
- Tant que PR2 n'est pas livrée, la validation de sortie reste absente (le prompt
  v3 est seul sur la couche 3) — le bandeau CLAUDE.md reste en vigueur.
- Nouveaux coûts : étage 2 LLM uniquement sur hit personnel non manifeste
  (minorité de messages, flash-lite) ; +0 appel sur le chemin nominal.
- Golden set versionné dans `tests/unit/golden/` (500 cas, attendus révisés).

## Suivi

- Déployer en `MEDINFO_GUARDRAILS=log` une semaine, mesurer
  `refusal_triggered`/`guardrail_layer` dans `ai_interactions`, puis basculer `enforce`.
- Appliquer la migration `0031_chat_guard.sql` (Supabase) avant activation.
- Statut → Accepted après validation Hugo + bascule enforce.
