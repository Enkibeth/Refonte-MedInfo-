-- Étape 5 — RAG pgvector HAS/ANSM.
-- Tables documentaires sans donnée utilisateur ni donnée de santé identifiable.

create extension if not exists vector;

create table if not exists public.rag_sources (
  id text primary key,
  title text not null,
  emitter text not null check (emitter in ('HAS', 'ANSM', 'SPF', 'INCa', 'Orphanet', 'ameli.fr', 'CRAT', 'BDPM')),
  source_url text not null check (source_url ~ '^https://'),
  publication_date date not null,
  license text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rag_chunks (
  chunk_id text primary key,
  parent_doc_id text not null references public.rag_sources(id) on delete cascade,
  section_path text not null,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('french', content || ' ' || section_path)) stored,
  embedding vector(1536),
  has_grade text not null default 'NA' check (has_grade in ('A', 'B', 'C', 'NA')),
  edn_item_id text,
  edn_rang text not null default 'NA' check (edn_rang in ('A', 'B', 'C', 'NA')),
  specialty text not null,
  license text not null,
  validation_hash text not null check (validation_hash ~ '^sha256:'),
  created_at timestamptz not null default now()
);

create index if not exists rag_chunks_content_tsv_idx on public.rag_chunks using gin (content_tsv);
create index if not exists rag_chunks_embedding_hnsw_idx on public.rag_chunks using hnsw (embedding vector_cosine_ops) where embedding is not null;
create index if not exists rag_chunks_parent_doc_id_idx on public.rag_chunks (parent_doc_id);

alter table public.rag_sources enable row level security;
alter table public.rag_chunks enable row level security;

-- Lecture publique du corpus validé ; écritures réservées au service_role/BYPASSRLS.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rag_sources' and policyname = 'rag_sources_select_public'
  ) then
    create policy rag_sources_select_public on public.rag_sources for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rag_chunks' and policyname = 'rag_chunks_select_public'
  ) then
    create policy rag_chunks_select_public on public.rag_chunks for select using (true);
  end if;
end $$;

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
  with lexical as (
    select
      c.chunk_id,
      ts_rank_cd(c.content_tsv, plainto_tsquery('french', query_text))::double precision as score
    from public.rag_chunks c
    where c.content_tsv @@ plainto_tsquery('french', query_text)
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

insert into public.rag_sources (id, title, emitter, source_url, publication_date, license)
values
  ('has-dt2-parcours-2025', 'Parcours de soins du patient adulte vivant avec un diabète de type 2', 'HAS', 'https://www.has-sante.fr/jcms/p_3634754/fr/parcours-de-soins-du-patient-adulte-vivant-avec-un-diabete-de-type-2', '2025-07-16', 'HAS réutilisation publique avec attribution'),
  ('has-obesite-adulte-parcours-2023', 'Guide du parcours de soins : surpoids et obésité de l''adulte', 'HAS', 'https://www.has-sante.fr/jcms/p_3408871/fr/guide-du-parcours-de-soins-surpoids-et-obesite-de-l-adulte', '2023-02-09', 'HAS réutilisation publique avec attribution'),
  ('ansm-ains-bon-usage-2013', 'Rappel des règles de bon usage des anti-inflammatoires non stéroïdiens', 'ANSM', 'https://ansm.sante.fr/uploads/2021/01/07/rappel-bonusageains130821.pdf', '2013-07-01', 'ANSM réutilisation publique avec attribution')
on conflict (id) do update set
  title = excluded.title,
  emitter = excluded.emitter,
  source_url = excluded.source_url,
  publication_date = excluded.publication_date,
  license = excluded.license;

insert into public.rag_chunks (chunk_id, parent_doc_id, section_path, content, has_grade, edn_item_id, edn_rang, specialty, license, validation_hash)
values
  ('has-dt2-parcours-2025-prevention-001', 'has-dt2-parcours-2025', 'Mesure de prévention en cas de prédiabète', 'La HAS décrit le parcours de soins de l''adulte vivant avec un diabète de type 2. En cas de prédiabète, elle recommande une sensibilisation au risque de diabète de type 2 ultérieur, des mesures de prévention centrées sur le mode de vie et une surveillance annuelle.', 'NA', '245', 'A', 'Endocrinologie-diabétologie', 'HAS réutilisation publique avec attribution', 'sha256:34b359eb773d1b10927eb31e1c0127e7c73aa7863622505dae1c3c5a90b5b6d8'),
  ('has-dt2-parcours-2025-prise-en-charge-002', 'has-dt2-parcours-2025', 'Prise en charge thérapeutique globale', 'La HAS place la prise en charge non médicamenteuse au premier plan après le bilan initial du diabète de type 2 : diminution de la sédentarité, activité physique régulière et plan de soins diététique personnalisé sans restriction alimentaire excessive.', 'NA', '245', 'A', 'Endocrinologie-diabétologie', 'HAS réutilisation publique avec attribution', 'sha256:1794022af3a7f42803bf92030696d26a0ccd53e705e1ab1ff893f955ccb096f8'),
  ('has-obesite-adulte-parcours-2023-001', 'has-obesite-adulte-parcours-2023', 'Parcours de soins et accompagnement', 'La HAS présente le surpoids et l''obésité de l''adulte comme des situations nécessitant une évaluation globale, un accompagnement gradué et une coordination entre professionnels selon les besoins, sans réduire la prise en charge au seul poids.', 'NA', '251', 'A', 'Nutrition', 'HAS réutilisation publique avec attribution', 'sha256:3c4c3db9e3cc6c78217310d069185a07d42b6fe0bd487698f21626f4bb855a79'),
  ('ansm-ains-bon-usage-2013-001', 'ansm-ains-bon-usage-2013', 'Lors de la prescription', 'L''ANSM rappelle que les anti-inflammatoires non stéroïdiens doivent être utilisés à la dose minimale efficace et pendant la durée la plus courte possible. Elle insiste sur le respect des indications, l''information sur les risques et les contre-indications.', 'NA', '326', 'A', 'Pharmacologie', 'ANSM réutilisation publique avec attribution', 'sha256:b4134a91ce4fffa113e12675d46e9a6968b9d6f74ac2a8e600e70c0e65bb91e8')
on conflict (chunk_id) do update set
  parent_doc_id = excluded.parent_doc_id,
  section_path = excluded.section_path,
  content = excluded.content,
  has_grade = excluded.has_grade,
  edn_item_id = excluded.edn_item_id,
  edn_rang = excluded.edn_rang,
  specialty = excluded.specialty,
  license = excluded.license,
  validation_hash = excluded.validation_hash;
