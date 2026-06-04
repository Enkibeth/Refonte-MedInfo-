# RAG — étape 5 MVP

Objectif : brancher un premier RAG HAS/ANSM **cite-or-refuse** sans sortir de la safe-box non-MDSW.

## Livré

- `supabase/migrations/0006_rag_pgvector.sql` : extension `vector`, tables `rag_sources` / `rag_chunks`, index HNSW + GIN `tsvector`, RPC `match_rag_chunks` et seed minimal HAS/ANSM.
- `src/rag/corpus/has-ansm-mvp.*` : petit corpus officiel français validé (HAS diabète type 2, HAS obésité adulte, ANSM bon usage AINS).
- `src/rag/retrieval.ts` : retrieval Supabase via RPC, fallback local lexical verrouillé dev/test, section de prompt RAG et refus déterministe si aucune source.
- `scripts/embeddings/validate-rag-metadata.mjs` : gate `rag-license` réel sur `chunk_id`, source HTTPS, licence, date, hash et contenu.

## Invariant cite-or-refuse

Pour une question `general_info`, `/api/chat` récupère d'abord le contexte RAG. Si aucune source validée ne couvre la question, le LLM principal n'est pas appelé et la réponse est exactement :

> Les sources disponibles ne permettent pas de répondre avec certitude.

## Limites connues

- Les embeddings production (`voyage-3.5-lite` ou BGE-M3) ne sont pas encore intégrés : le MVP prépare pgvector sans envoyer de pseudo-embedding ; la RPC reste lexicale tant que de vrais vecteurs n'ont pas été ingérés.
- Pas encore de pipeline PDF/OCR complet ni reranker : à faire après validation de ce petit corpus.
- Le corpus est volontairement minuscule ; il sert à valider le contrat technique et réglementaire avant ingestion large.
