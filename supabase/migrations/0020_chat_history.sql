-- Migration 0020 — Historique des conversations du chat (refonte 2026-06).
--
-- Deux tables own-row strictes :
--   - chat_conversations : une ligne par conversation (chatbot utilisé, titre + catégorie
--     générés par IA — feature "chat_meta", route /api/chat-meta) ;
--   - chat_messages      : les messages texte (user/assistant) de chaque conversation.
--
-- Contenu potentiellement sensible (questions de santé) : RLS STRICTE own-row, aucune
-- lecture croisée. CRUD complet par le propriétaire uniquement (client supabase-js).

create table if not exists public.chat_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  chatbot    text not null default 'public'
               check (chatbot in ('public', 'student', 'professional')),
  title      text,                                   -- généré par IA (chat_meta), éditable
  category   text,                                   -- catégorie auto (chat_meta)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_conversations_user_idx
  on public.chat_conversations (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at asc);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

grant select, insert, update, delete on public.chat_conversations to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_conversations' and policyname='chat_conv_select_own') then
    create policy chat_conv_select_own on public.chat_conversations
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_conversations' and policyname='chat_conv_insert_own') then
    create policy chat_conv_insert_own on public.chat_conversations
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_conversations' and policyname='chat_conv_update_own') then
    create policy chat_conv_update_own on public.chat_conversations
      for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_conversations' and policyname='chat_conv_delete_own') then
    create policy chat_conv_delete_own on public.chat_conversations
      for delete using ((select auth.uid()) = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_messages' and policyname='chat_msg_select_own') then
    create policy chat_msg_select_own on public.chat_messages
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_messages' and policyname='chat_msg_insert_own') then
    -- Le message doit appartenir à l'utilisateur ET à une de SES conversations
    -- (sinon un tiers pourrait insérer, sous son propre user_id, dans la conversation d'autrui).
    create policy chat_msg_insert_own on public.chat_messages
      for insert with check (
        (select auth.uid()) = user_id
        and exists (
          select 1 from public.chat_conversations c
          where c.id = conversation_id and c.user_id = (select auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_messages' and policyname='chat_msg_update_own') then
    create policy chat_msg_update_own on public.chat_messages
      for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_messages' and policyname='chat_msg_delete_own') then
    create policy chat_msg_delete_own on public.chat_messages
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;
