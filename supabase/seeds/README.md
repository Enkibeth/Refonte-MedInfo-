# Supabase seeds

Données de dev uniquement. Jamais de données santé identifiables.

## Ordre d'exécution

1. `00_dev_auth_profiles.sql` — crée trois comptes locaux déterministes (`public`, `student`, `professional`) et leurs lignes `profiles`.
2. `01_dev_usage_config.sql` — initialise des compteurs techniques de rate-limit par persona, sans contenu de conversation.
3. `02_dev_rag_corpus.sql` — upsert le corpus RAG dev dans `rag_sources` et `rag_chunks`.

## Corpus RAG et gate licence

La source de vérité du corpus est `src/rag/corpus/*.json`. Chaque chunk doit contenir les métadonnées exigées par le gate `rag-license` :

- `emitter` autorisé (`HAS`, `ANSM`, `ameli.fr`, etc.) ;
- `source_url` en HTTPS ;
- `publication_date` au format `YYYY-MM-DD` ;
- `license` déclarant une réutilisation publique avec attribution ;
- `validation_hash = sha256:<sha256 exact du champ content>`.

Le seed SQL RAG est généré de manière reproductible :

```bash
node supabase/seeds/generate-rag-seed.mjs
npm run validate:rag
```

Ne pas éditer `02_dev_rag_corpus.sql` à la main : modifier le JSON source, recalculer le hash, puis régénérer le seed.
