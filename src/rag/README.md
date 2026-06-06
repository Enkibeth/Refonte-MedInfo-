# RAG — étape 5 MVP

Objectif : brancher un premier RAG HAS/ANSM **cite-or-refuse** sans sortir de la safe-box non-MDSW.

## Livré

- `supabase/migrations/0006_rag_pgvector.sql` : extension `vector`, tables `rag_sources` / `rag_chunks`, index HNSW + GIN `tsvector`, RPC `match_rag_chunks` et seed minimal HAS/ANSM.
- `src/rag/corpus/has-ansm-mvp.*` : petit corpus officiel français validé (HAS diabète type 2, HAS obésité adulte, ANSM bon usage AINS).
- `src/rag/corpus/lot-b-*.json` + `lot-c-europe.json` : **corpus élargi (Lot B/C, CC-03)** — 38 chunks réellement sourcés (→ 42 au total) sur 11 émetteurs (HAS, ANSM, SPF, INCa, ameli.fr, CRAT, Orphanet, BDPM + EMA, ECDC, OMS), résumés fidèles attribués (zéro contenu inventé, pas de verbatim intégral).
- `src/rag/retrieval.ts` : retrieval Supabase via RPC, fallback local lexical verrouillé dev/test, section de prompt RAG et refus déterministe si aucune source.
- `scripts/embeddings/validate-rag-metadata.mjs` : gate `rag-license` réel sur `chunk_id`, source HTTPS, licence, date, hash et contenu.

## Invariant cite-or-refuse

Pour une question `general_info`, `/api/chat` récupère d'abord le contexte RAG. Si aucune source validée ne couvre la question, le LLM principal n'est pas appelé et la réponse est exactement :

> Les sources disponibles ne permettent pas de répondre avec certitude.

## Limites connues

- Le modèle d'embedding (`text-embedding-3-small`, 1536, ADR-0014) est câblé **et les vecteurs sont peuplés** (42/42, ingestion 2026-06-06 après confirmation OpenAI EU/ZDR/DPA) : la fusion dense+lexical (RRF) est active, recall dense @3 = 100 % (50 questions). Le benchmark `voyage-3.5-lite`/BGE-M3 (et l'alternative souveraine Mistral) reste prévu sur corpus de masse.
- Pas encore de pipeline PDF/OCR complet ni reranker : à faire après validation de ce petit corpus.
- Le corpus compte **42 chunks sourcés** (MVP + Lot B FR + Lot C européen), **11 émetteurs**, embeddings peuplés ; recall dense mesuré (chunk@3 / doc@3 = 100 %).
