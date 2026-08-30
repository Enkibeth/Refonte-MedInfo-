-- Retour à la base du chat (2026-08, ADR-0037 — décision Hugo : « on a trop complexifié
-- le chatbot, revenons à la base »).
--
-- UN prompt par catégorie (public / student / professional), UN appel LLM sur gpt-5.6-luna
-- avec la recherche web du provider, puis la réponse. Sont retirés du produit :
--   * `chat_researcher` — split orchestrateur/rédacteur (2 appels LLM en série) ;
--   * `chat_fast`       — mode Rapide sur un second modèle (le chat entier est désormais
--                         sur le tier le plus rapide, le mode ne fait plus que couper la
--                         recherche web) ;
--   * `pubmed_agent`    — sous-agent PubMed délégué par le chatbot professionnel.
-- Les outils serveur (Europe PMC, ClinicalTrials.gov, plan_research, verify_source_links)
-- n'avaient pas de ligne de configuration : ils disparaissent avec le code.
--
-- Motif : la latence mesurée en prod était linéaire dans le nombre d'étapes LLM
-- (~15-18 s par étape) ; chaque couche ajoutait des étapes avant le premier mot affiché.
--
-- ⚠️ `ai_interactions` n'est PAS touchée : l'historique des coûts de ces features reste
-- lisible dans l'onglet Coûts (libellés conservés côté panel admin).
-- Service role only comme le reste de la table. Aucune donnée de santé.

-- 1. Le chat passe sur gpt-5.6-luna. `temperature` est remise à NULL : l'API OpenAI REFUSE
--    ce paramètre sur la famille 5.6 (« Unsupported parameter: 'temperature' »). Le code
--    ne l'envoie pas (capability à false), mais laisser 0.3 en base serait trompeur.
update public.ai_model_config
   set model_id = 'gpt-5.6-luna',
       provider = 'openai',
       web_search = true,
       temperature = null
 where key = 'chat';

-- 2. Suppression des lignes de configuration des features retirées.
delete from public.ai_model_config
 where key in ('chat_researcher', 'chat_fast', 'pubmed_agent');

-- 3. Suppression des éventuels overrides de prompts admin correspondants (la table est
--    vide par défaut : le fallback est PROMPT_DEFAULTS côté code, où ces clés n'existent
--    plus non plus).
delete from public.ai_prompts
 where key in ('chat_researcher', 'pubmed_agent');
