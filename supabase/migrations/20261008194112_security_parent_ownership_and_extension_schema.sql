-- Ownership of a child row is not enough: UPDATE must also keep its parent
-- owned by the caller (INSERT already enforces this).
alter policy chat_msg_update_own on public.chat_messages
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

-- This table exists in production but not in the original 0027 schema. Keep
-- migration replay on fresh databases valid while hardening the deployed table.
do $$
begin
  if to_regclass('public.revision_plan_items') is not null then
    execute $policy$
      alter policy revision_items_update_own on public.revision_plan_items
      using ((select auth.uid()) = user_id)
      with check (
        (select auth.uid()) = user_id
        and exists (
          select 1 from public.revision_plans p
          where p.id = plan_id and p.user_id = (select auth.uid())
        )
      )
    $policy$;
  end if;
end $$;

-- Supabase security advisor: extensions should live outside the exposed public
-- schema. Moving the extension preserves column types, values and indexes (OIDs).
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
alter extension vector set schema extensions;
-- SQL RAG body uses the vector distance operator: preserve its lookup explicitly.
alter function public.match_rag_chunks(text, extensions.vector, integer)
  set search_path = public, extensions;
notify pgrst, 'reload schema';
