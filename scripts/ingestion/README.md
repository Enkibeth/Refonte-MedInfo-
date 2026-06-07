# Ingestion

Étape 1 : aucun corpus ingéré.
Étape 5 : ingestion contrôlée, métadonnées source/licence/hash obligatoires.

## Jeu de données dev

- La source de vérité RAG est `src/rag/corpus/*.json`.
- Le seed Supabase reproductible est généré par `node supabase/seeds/generate-rag-seed.mjs` vers `supabase/seeds/02_dev_rag_corpus.sql`.
- Le gate licence/hash à lancer avant toute ingestion est `npm run validate:rag`.
- L'ingestion avec embeddings réels reste hors CI et nécessite `OPENAI_API_KEY`, `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. Pour vérifier sans réseau ni écriture DB : `node scripts/embeddings/ingest-corpus.mjs --dry-run`.
