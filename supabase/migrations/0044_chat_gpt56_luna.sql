-- Latence + coût du chat : les phases NON rédactionnelles passent sur GPT-5.6 Luna (2026-08).
--
-- Constat Hugo : « c'est trop long la génération d'une réponse ». L'audit latence 2026-07
-- avait déjà établi que le temps part dans la BOUCLE D'OUTILS (~15-18 s par étape), portée
-- par l'agent chercheur (feature `chat_researcher`), pas dans la rédaction. Luna est le tier
-- le plus rapide et le moins cher de la famille GPT-5.6 (0,20 $ / 1 M tokens d'entrée et
-- 1,20 $ / 1 M en sortie, contre 0,25 $ / 2,00 $ pour gpt-5-mini) : c'est exactement le
-- profil d'un modèle qui enchaîne des appels d'outils sur beaucoup de contexte web.
--
-- Périmètre VOLONTAIREMENT limité aux deux features sans enjeu rédactionnel clinique :
--   * `chat_researcher` — rassemble le dossier de preuves (recherche/lecture/vérification) ;
--   * `chat_fast`       — mode « Rapide », un appel direct sans outil.
-- La RÉDACTION de la réponse médicale reste sur la feature `chat` (gpt-5.2) : la basculer
-- sur un tier économique est un arbitrage QUALITÉ CLINIQUE qui appartient à Hugo, et se fait
-- en un clic depuis le panel admin (onglet Modèles) sans redéploiement.
--
-- Service role only comme le reste de la table. Aucune donnée de santé.
insert into public.ai_model_config (key, model_id, label, provider, web_search)
values
  ('chat_researcher', 'gpt-5.6-luna', 'Chat — Agent chercheur (orchestrateur)', 'openai', true),
  ('chat_fast',       'gpt-5.6-luna', 'Chat — Mode rapide',                     'openai', false)
on conflict (key) do nothing;

-- Les lignes préexistent (migrations 0041 / 0042) : c'est bien l'UPDATE qui bascule le
-- modèle. On ne touche QUE le model_id des deux features ci-dessus, et seulement si elles
-- sont encore sur l'ancien modèle (idempotent, et un choix admin plus récent est respecté).
update public.ai_model_config
   set model_id = 'gpt-5.6-luna', provider = 'openai'
 where key in ('chat_researcher', 'chat_fast')
   and model_id = 'gpt-5-mini';
