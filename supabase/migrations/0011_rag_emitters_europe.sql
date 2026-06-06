-- 0011 — RAG : étendre l'allowlist d'émetteurs aux institutions européennes / internationales
-- (EMA, ECDC, OMS) pour le Lot C du corpus (CC-03). Aucune donnée utilisateur ni de santé :
-- on relâche uniquement la contrainte CHECK sur rag_sources.emitter. Idempotent.

do $$
declare cname text;
begin
  select c.conname into cname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'rag_sources'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%emitter%';
  if cname is not null then
    execute format('alter table public.rag_sources drop constraint %I', cname);
  end if;
end $$;

alter table public.rag_sources
  add constraint rag_sources_emitter_check
  check (emitter in ('HAS', 'ANSM', 'SPF', 'INCa', 'Orphanet', 'ameli.fr', 'CRAT', 'BDPM', 'EMA', 'ECDC', 'OMS'));
