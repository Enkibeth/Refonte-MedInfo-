# ADR-0023 — Safe-box du chat neutralisée temporairement (interrupteur)

```yaml
status: Superseded (par ADR-0024 — refonte chat 2026-06)
date: 2026-06-08
owner: Hugo Bettembourg (arbitrage produit)
supersedes: aucun (relâche temporairement la doctrine 01_REGULATION §4 / 04_CHATBOT §4)
```

## Contexte

En production, le chat sur-refusait des questions pédagogiques légitimes. Exemple
constaté (capture du 2026-06-08) : « Cours sur l'HTA » renvoie le **refus canonique
d'urgence** au lieu d'une réponse informative.

Cause racine : la couche 1 (classifieur d'intention pré-LLM) ne route en `general_info`
que des formulations encyclopédiques explicites (« qu'est-ce que… », « définition de… »).
« Cours sur l'HTA » ne matche aucun marqueur → `null` → étage 2 (Gemini) non configuré en
prod (pas de `GOOGLE_GENERATIVE_AI_API_KEY`) → fail-safe `ambiguous` → **refus**. La
safe-box, pensée « fail-closed », bloque donc presque tout ce qui n'est pas parfaitement
formulé. Résultat : le chat n'est de fait pas utilisable.

## Décision

Priorité produit : **rétablir un chat fonctionnel d'abord, remettre la sécurité par-dessus
ensuite** (arbitrage Hugo). On introduit un **interrupteur global** de la safe-box :

- `src/ai/guardrails/config.ts` → `guardrailsEnabled()` (lit l'env `MEDINFO_GUARDRAILS`).
- **Par défaut : OFF** (safe-box neutralisée) tant que `MEDINFO_GUARDRAILS !== 'on'`.
- Gating au niveau de la **route** `app/api/chat+api.ts` :
  - Couche 1 : si OFF, `screenConversation` n'est pas appelée → conversation laissée passer.
  - Couche 3 : si OFF, le flux LLM est diffusé brut (pas de `gateUiMessageStream`).

Ce qui est **conservé** (non concerné par le flag) :
- La **disclosure passive** (bandeau « Information générale — ne remplace pas un avis médical
  individuel ») : information, pas barrière bloquante.
- Le **rate-limit** anti-abus.
- L'autorisation **persona côté serveur** (un public ne devient pas student).

Ce qui est **préservé pour la réactivation** :
- Le code des couches 1 & 3 reste en place, **jamais supprimé**.
- Les tests des couches (orchestrator, streamGate) restent verts (ils appellent les modules
  directement). Le test de la route qui vérifie le refus force `MEDINFO_GUARDRAILS=on`.

## Conséquences

- ⚠️ Régression de sûreté **assumée et temporaire** : pendant cette phase, le chat peut
  répondre à des messages que la safe-box aurait refusés (y compris formulations
  personnelles). C'est un choix produit explicite, pas un bug.
- La règle CLAUDE.md #2 (« ne jamais dégrader la safe-box ») est **relâchée par cet ADR**,
  qui sert d'arbitrage Hugo. À la réactivation, on rétablit la doctrine.
- Réactivation = `MEDINFO_GUARDRAILS=on` (env Vercel) **sans redéploiement de code**, puis
  travail sur la cause racine (élargir les marqueurs `general_info` / activer l'étage 2
  Gemini en prod) pour supprimer les sur-refus avant de rebasculer en « on » durable.

## Suivi (sécurité par-dessus, plus tard)

1. Élargir `GENERAL_INFO_MARKERS` (lexicon) pour les demandes pédagogiques (« cours sur »,
   « parle-moi de », « tout savoir sur »…).
2. Activer l'étage 2 (clé Gemini) en prod pour trancher les `null` au lieu du fail-safe.
3. Rebasculer `MEDINFO_GUARDRAILS=on` une fois les sur-refus résorbés, puis clore cet ADR.
