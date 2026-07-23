-- Split orchestrateur / rédacteur du chat (audit 2026-07 — « inversion »).
--
-- Le poste de coût dominant du chat est l'ENTRÉE accumulée pendant la boucle d'outils
-- (contenu web injecté à chaque étape), portée par le modèle flagship. On confie la PHASE
-- DE RECHERCHE à un modèle bon marché (feature `chat_researcher`, gpt-5-mini) qui rassemble
-- un dossier de preuves vérifié ; la PHASE DE RÉDACTION clinique reste sur `chat` (gpt-5.2).
--
-- Activé par le flag serveur CHAT_ORCHESTRATOR_SPLIT (OFF par défaut). web_search ON (le
-- chercheur a besoin des recommandations en ligne). Le POST admin fait un UPDATE : la ligne
-- doit préexister (convention 0011). Service role only comme le reste de la table.
insert into public.ai_model_config (key, model_id, label, provider, web_search)
values ('chat_researcher', 'gpt-5-mini', 'Chat — Agent chercheur (orchestrateur)', 'openai', true)
on conflict (key) do nothing;
