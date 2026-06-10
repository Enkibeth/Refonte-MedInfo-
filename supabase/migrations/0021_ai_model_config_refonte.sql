-- Migration 0021 — Config modèles : refonte chat (2026-06).
--
--   1. Nouvelle feature "chat_meta" (titre + catégorie d'historique, /api/chat-meta) —
--      défaut Gemini 2.5 Flash (rapide, économique). Le POST admin fait un UPDATE :
--      la ligne doit préexister (convention 0011).
--   2. Modèle par défaut du chat → GPT-5.2 (choix Hugo, rapport coût/qualité) avec
--      recherche web activée (les prompts v3 exigent des sources réelles vérifiables).

insert into public.ai_model_config (key, model_id, label, provider)
values ('chat_meta', 'gemini-2.5-flash', 'Chat — Titre & catégorie', 'google')
on conflict (key) do nothing;

update public.ai_model_config
set model_id = 'gpt-5.2',
    provider = 'openai',
    web_search = true
where key = 'chat';
