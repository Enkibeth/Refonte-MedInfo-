-- Coût par conversation (panel admin, 2026-07).
--
-- Attribue les tokens d'une interaction chat à SA conversation, pour un tableau
-- « quelle conversation a coûté combien » côté admin. Colonne NULLABLE : les
-- features hors chat (analyse, ECOS, audio, chat_meta…) et les essais anonymes
-- restent NULL. Aucun contenu de message n'est stocké (seulement l'identifiant de
-- conversation + les compteurs de tokens déjà présents). Service role only comme
-- le reste de la table (RLS sans policy, migration 0002).
alter table public.ai_interactions
  add column if not exists conversation_id uuid;

comment on column public.ai_interactions.conversation_id is
  'Conversation chat associée (chat_conversations.id) — NULL hors chat / anonyme. Diagnostic de coût, jamais de contenu.';
