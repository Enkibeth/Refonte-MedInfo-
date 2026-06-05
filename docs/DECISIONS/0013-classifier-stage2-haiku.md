# ADR-0013 — Câblage de l'étage 2 du classifieur (Claude Haiku 4.5)

```yaml
status: Accepted
date: 2026-06-05
owner: Hugo Bettembourg
linked_to: [07_CLASSIFIER §2 §3 §4, 01_REGULATION §4, 03_SECURITY §1, ADR-0003]
```

## Contexte
La couche 1 du safe-box (07_CLASSIFIER) est un classifieur hybride à deux étages. Seul l'étage 1
(regex/lexique déterministe) était câblé : il atteint 100 % de recall `emergency` et
`personal_symptoms`, mais une précision/recall `general_info` faible (regex seul ~28 % de recall).
Conséquence : beaucoup de questions générales légitimes retombaient sur le fail-safe `ambiguous`
(sur-refus), et les demandes personnelles **déguisées en questions générales** ne pouvaient être
captées que sémantiquement. 07_CLASSIFIER §2/§4 prévoit l'étage 2 (LLM léger, `temperature=0`,
sortie JSON) pour combler ce manque.

## Décision
1. **Câbler l'étage 2 avec Claude Haiku 4.5** (`claude-haiku-4-5`) via `@ai-sdk/anthropic`
   (`generateObject`, schéma Zod, `temperature=0`). C'est le modèle Claude **le moins cher et le
   plus rapide** (contexte 200K ; ~1 $/1M tokens entrée, ~5 $/1M sortie). 07_CLASSIFIER §3 chiffrait
   déjà le coût à **< 30 €/100 000 conversations** même avec Haiku — le poste budgétaire n'est pas là.
2. **Aucun nouveau sous-traitant ni nouvelle clé** : Haiku réutilise `ANTHROPIC_API_KEY` (déjà requise
   pour le LLM principal). Gemini Flash-Lite (envisagé en prod par 07_CLASSIFIER §3) imposerait un
   fournisseur supplémentaire, une clé et un DPA de plus ; il reste une **option de réduction de coût
   ultérieure**, activable sans changement de code via `CLASSIFIER_MODEL_ID`.
3. **L'étage 1 reste prioritaire et inchangé.** Le regex tranche d'abord ; un marqueur d'urgence ou
   personnel explicite court-circuite l'étage 2 (jamais d'appel LLM sur ces cas). L'étage 2 n'est
   consulté que lorsque le regex ne tranche pas.
4. **Garde-fous conservés.** Un verdict `general_info` de l'étage 2 reste rétrogradé en
   `personal_symptoms` si un marqueur personnel regex subsiste (ceinture + bretelles), et soumis au
   seuil `confidence ≥ 0,85` (`resolveDecision`).
5. **FAIL-CLOSED.** Toute erreur de l'étage 2 (réseau, quota, JSON non conforme) renvoie
   `ambiguous`/0 → refus canonique. Le doute non résolu n'atteint jamais le LLM principal.
6. **Activation conditionnelle.** L'étage 2 n'est branché que si `CLASSIFIER_STAGE2_ENABLED ≠ false`
   ET qu'une clé Anthropic est présente ; sinon, retour au fail-safe regex-seul (comportement
   antérieur, inchangé). Aucune ouverture par défaut.

## Conséquences
- **Positif** : récupère le recall `general_info` (moins de sur-refus) et capte les demandes
  personnelles déguisées que le regex ne couvre pas, sans assouplir la détection déterministe des
  urgences/cas personnels explicites.
- **Coût** : négligeable (cf §1). Latence ~quelques centaines de ms ajoutée uniquement sur les
  messages non tranchés par le regex.
- **Réglementaire** : aucune logique de triage/diagnostic/CAT introduite — l'étage 2 ne fait que
  **router** vers un refus déterministe ou vers le LLM principal (déjà sous safe-box 3 couches +
  RAG cite-or-refuse). Le prompt de classification est porté **verbatim** depuis 07_CLASSIFIER §4
  (source unique). La journalisation `classifier_decisions` (07_CLASSIFIER §7) reste à brancher
  ultérieurement (hors périmètre de cette décision).

## Rollback
`CLASSIFIER_STAGE2_ENABLED=false` (Vercel) désactive l'étage 2 sans déploiement. Pour retirer le
code : `git revert` (supprime `src/ai/classifier/llmStage2.ts`, le branchement dans
`app/api/chat+api.ts` et l'export d'index) ; le classifieur revient au regex-seul + fail-safe.
