# ADR-0014 — Embeddings RAG : OpenAI text-embedding-3-small (1536) + taille de chunk

```yaml
status: Accepted
date: 2026-06-05
owner: Hugo Bettembourg
linked_to: [08_RAG.md §3 §9 §12, 01_REGULATION §5 §6 §10, START.md, ADR-0003, COUNCIL_AUDIT_2026-06 R1/CC-03]
```

## Contexte
Risque **R1** de l'audit Council (« le produit refuse l'essentiel ») : le retrieval est
**lexical-only**, les `rag_chunks.embedding` ne sont **pas peuplés**, et `retrieval.ts` envoyait
`query_embedding: null`. Pourtant `match_rag_chunks` (migration 0009 / ledger 0007) **fait déjà** la
fusion lexical+dense (RRF k=60) dès qu'un vecteur de requête est fourni, et la colonne est typée
`vector(1536)`. Activer le dense = peupler les vecteurs + envoyer un vrai vecteur de requête.

`START.md` prévoyait de benchmarker l'embedding (voyage-3.5-lite vs BGE-M3) avant de figer. Pour
débloquer R1 sans attendre ce benchmark, il faut un modèle **disponible immédiatement, sans nouveau
sous-traitant ni changement de schéma**, et **réversible**.

## Décision
1. **Modèle : OpenAI `text-embedding-3-small`, 1536 dimensions.** Il tient exactement dans
   `rag_chunks.embedding vector(1536)` → **aucun `ALTER`**. Réutilise `OPENAI_API_KEY` (déjà requise,
   second provider AI Act §6) et `@ai-sdk/openai` (déjà en dépendances) → **zéro nouvelle dépendance,
   zéro nouveau sous-traitant**.
2. **Coût négligeable** : ~**0,02 USD / 1M tokens** (entrée). Un corpus de plusieurs dizaines de chunks
   sourcés ≈ quelques milliers de tokens → ingestion **< 0,01 USD** ; l'embedding par requête est
   marginal. Le poste de coût LLM reste le modèle principal (cf ADR-0013), pas l'embedding.
3. **ZÉRO pseudo-embedding (CC-03)** : clé absente → `throw` à l'ingestion (jamais de vecteur factice
   en base) ; échec à la requête → **dégradation lexical-only** (`query_embedding = null`). Le modèle
   est **isolé** dans `src/rag/embeddings.ts` (source de vérité applicative).
4. **Taille de chunk (recette 08_RAG §3, figée ici)** :
   - **Recommandations** (HAS, parcours de soins) : découpe **section-aware** H1/H2/H3.
   - **Monographies médicamenteuses** (ANSM/BDPM) : **chunk entier 800–1200 tokens** ; **ne jamais
     fragmenter une posologie ou un tableau** d'interactions/contre-indications.
   - **Narratif** : 512 tokens, overlap 64.
   - La fenêtre d'entrée de `text-embedding-3-small` (8191 tokens) **couvre largement** le plus gros
     chunk (1200 tokens) → aucune troncature de monographie.
5. **Exigence résidence/rétention (01_REGULATION §5)** : le projet OpenAI doit être en **EU Data
   Residency + Zero Data Retention + DPA/SCC Module 2** **avant toute ingestion de production**
   (action **hors code**, côté Hugo). Aucune **donnée de santé identifiable** n'est envoyée à OpenAI :
   le corpus est de la **littérature publique** (HAS/ANSM/émetteurs whitelistés), et les requêtes
   utilisateur passent d'abord par le classifieur safe-box (refus déterministe des cas personnels).
6. **Alternatives reportées, choix réversible** : la voie **souveraine Mistral La Plateforme**
   (01_REGULATION §5/§10) et le benchmark `voyage-3.5-lite` vs `BGE-M3` (START.md) restent **ouverts**
   et seront tranchés par un **benchmark recall@k sur corpus de masse**. Changer de modèle = éditer
   `EMBEDDING_MODEL` dans `src/rag/embeddings.ts` + ré-ingérer (`npm run rag:ingest`).

## Conséquences
- **Positif** : active la fusion dense+lexical (RRF) déjà présente côté DB ; débloque R1 ; démarrage
  immédiat ; pas de nouveau sous-traitant/DPA à ouvrir au-delà de l'existant OpenAI.
- **Négatif / limites** : dépendance à un fournisseur **US** → impose la configuration EU residency+ZDR
  et garde ouverte la bascule Mistral (risque Schrems, 01_REGULATION §10). Le **recall dense** n'est
  **pas encore mesuré** (l'allowlist réseau de l'environnement bloque `api.openai.com` ; embeddings non
  encore peuplés). Baseline **lexical** sur le corpus actuel (4 chunks) = recall@1/@3 **100 %** mais
  **non informatif** (corpus trop petit : le lexical sature ; le gain du dense ne se mesure que sur un
  corpus élargi — Lot B).
- **Réglementaire : none.** Aucune donnée de santé stockée/transmise ; corpus public ; la disclosure
  AI Act (§6) et l'intended purpose (§1) sont inchangés. Le rappel EU residency+ZDR est une action de
  configuration externe, pas une modification produit.

## Rollback
- Désactivation du dense sans déploiement : laisser `rag_chunks.embedding` vide **ou** retirer la clé →
  `retrieval.ts` dégrade automatiquement en lexical-only (comportement antérieur, inchangé).
- Changement de modèle : éditer `EMBEDDING_MODEL` (`src/rag/embeddings.ts`) + `npm run rag:ingest`.
- Retrait du code : `git revert` (supprime `src/rag/embeddings.ts`, le câblage `retrieval.ts`, les
  scripts `rag:ingest`/`rag:recall`) ; le RAG revient au lexical-only `query_embedding: null`.
```
