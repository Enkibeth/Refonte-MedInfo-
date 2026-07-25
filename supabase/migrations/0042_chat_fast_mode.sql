-- Mode « Rapide » du chat (2026-07, retour Hugo).
--
-- Le mode Rapide enchaînait DEUX modèles (agent chercheur puis rédacteur) avec un budget
-- de sortie de 1400 tokens raisonnement inclus : c'était en pratique le chemin le PLUS LENT
-- et la réponse pouvait revenir vide (« la réponse a peut-être été interrompue »).
--
-- Il devient UN SEUL appel direct, sans outil ni recherche web, sur un modèle bon marché
-- (feature `chat_fast`, gpt-5-mini). Le mode Classique/Approfondi reste inchangé sur la
-- feature `chat` (gpt-5.2) avec le workflow evidence-first.
--
-- Le POST admin fait un UPDATE : la ligne doit préexister (convention 0011).
-- Service role only comme le reste de la table. Aucune donnée de santé.
insert into public.ai_model_config (key, model_id, label, provider, web_search)
values ('chat_fast', 'gpt-5-mini', 'Chat — Mode rapide', 'openai', false)
on conflict (key) do nothing;
