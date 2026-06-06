# RAG — étape 5 MVP

Objectif : brancher un premier RAG HAS/ANSM **cite-or-refuse** sans sortir de la safe-box non-MDSW.

## Livré

- `supabase/migrations/0006_rag_pgvector.sql` : extension `vector`, tables `rag_sources` / `rag_chunks`, index HNSW + GIN `tsvector`, RPC `match_rag_chunks` et seed minimal HAS/ANSM.
- `src/rag/corpus/has-ansm-mvp.*` : petit corpus officiel français validé (HAS diabète type 2, HAS obésité adulte, ANSM bon usage AINS).
- `src/rag/corpus/lot-b-*.json` : **corpus élargi (Lot B, CC-03)** — 28 chunks réellement sourcés (→ 32 au total) sur 8 émetteurs whitelistés (HAS, ANSM, SPF, INCa, ameli.fr, CRAT, Orphanet, BDPM), résumés fidèles attribués (zéro contenu inventé, pas de verbatim intégral).
- `src/rag/retrieval.ts` : retrieval Supabase via RPC, fallback local lexical verrouillé dev/test, section de prompt RAG et refus déterministe si aucune source.
- `scripts/embeddings/validate-rag-metadata.mjs` : gate `rag-license` réel sur `chunk_id`, source HTTPS, licence, date, hash et contenu.

## Invariant cite-or-refuse

Pour une question `general_info`, `/api/chat` récupère d'abord le contexte RAG. Si aucune source validée ne couvre la question, le LLM principal n'est pas appelé et la réponse est exactement :

> Les sources disponibles ne permettent pas de répondre avec certitude.

## Limites connues

- Le modèle d'embedding est câblé (`text-embedding-3-small`, 1536, ADR-0014) mais les **vecteurs ne sont pas encore peuplés** : sur décision Hugo (2026-06-06), aucun appel OpenAI tant que la résidence EU + ZDR + DPA/SCC du projet OpenAI n'est pas confirmée (01_REGULATION §5). Sans pseudo-embedding, la RPC reste lexicale tant que de vrais vecteurs n'ont pas été ingérés. Le benchmark `voyage-3.5-lite`/BGE-M3 reste prévu sur corpus de masse.
- Pas encore de pipeline PDF/OCR complet ni reranker : à faire après validation de ce petit corpus.
- Le corpus compte désormais 32 chunks sourcés (MVP + Lot B) ; il valide le contrat technique et réglementaire et reste à embedder avant la mesure du recall dense.
