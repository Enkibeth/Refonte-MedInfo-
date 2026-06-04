-- Étape 5 (correctif audit) — recherche lexicale RAG en sémantique OU.
--
-- Problème corrigé : `match_rag_chunks` utilisait `plainto_tsquery`, qui combine TOUS les
-- lexèmes de la question en ET. Une vraie question (« Quels sont les conseils pour le diabète
-- de type 2 ? » → 'quel' & 'conseil' & 'diabet' & 'typ' & '2') ne matchait alors aucun extrait
-- (les mots « quel »/« conseil » sont absents du corpus), déclenchant un cite-or-refuse même sur
-- un sujet couvert. On bascule en OU (n'importe quel terme significatif) avec classement par
-- pertinence (`ts_rank_cd`), ce qui rétablit le rappel tout en gardant le refus hors corpus.
--
-- Aucune donnée utilisateur ni donnée de santé identifiable.

create or replace function public.match_rag_chunks(
  query_text text,
  query_embedding vector(1536) default null,
  match_count int default 4
)
returns table (
  chunk_id text,
  parent_doc_id text,
  title text,
  emitter text,
  section_path text,
  source_url text,
  publication_date date,
  has_grade text,
  edn_item_id text,
  edn_rang text,
  specialty text,
  license text,
  validation_hash text,
  content text,
  rank_score double precision
)
language sql
stable
as $$
  with q as (
    -- AND → OR : on remplace les ' & ' produits par plainto_tsquery par des ' | '.
    select nullif(replace(plainto_tsquery('french', query_text)::text, ' & ', ' | '), '')::tsquery as ts
  ),
  lexical as (
    select
      c.chunk_id,
      ts_rank_cd(c.content_tsv, (select ts from q))::double precision as score
    from public.rag_chunks c
    where (select ts from q) is not null and c.content_tsv @@ (select ts from q)
    order by score desc
    limit 50
  ),
  dense as (
    select
      c.chunk_id,
      (1 - (c.embedding <=> query_embedding))::double precision as score
    from public.rag_chunks c
    where query_embedding is not null and c.embedding is not null
    order by c.embedding <=> query_embedding
    limit 50
  ),
  fused as (
    select chunk_id, sum(score) as rank_score
    from (
      select chunk_id, 1.0 / (60 + row_number() over (order by score desc)) as score from lexical
      union all
      select chunk_id, 1.0 / (60 + row_number() over (order by score desc)) as score from dense
    ) scores
    group by chunk_id
  )
  select
    c.chunk_id,
    c.parent_doc_id,
    s.title,
    s.emitter,
    c.section_path,
    s.source_url,
    s.publication_date,
    c.has_grade,
    c.edn_item_id,
    c.edn_rang,
    c.specialty,
    c.license,
    c.validation_hash,
    c.content,
    f.rank_score
  from fused f
  join public.rag_chunks c on c.chunk_id = f.chunk_id
  join public.rag_sources s on s.id = c.parent_doc_id
  order by f.rank_score desc, c.chunk_id asc
  limit greatest(1, least(match_count, 8));
$$;
