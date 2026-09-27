-- Chat sur GPT-6 Luna (2026-09, décision Hugo : « je valide gpt 6 Luna »).
--
-- GPT-6 Luna remplace GPT-5.6 Luna comme modèle UNIQUE des 3 chatbots (ADR-0037 inchangé :
-- un prompt par catégorie, un appel LLM avec la recherche web du provider, la réponse).
-- Prix officiels (2026-09-26, $ par million de tokens, entrée / sortie) : 0,10 / 0,50 contre
-- 0,20 / 1,20 pour GPT-5.6 Luna. Les réglages de la ligne (effort, verbosité, recherche web,
-- température NULL) sont conservés tels quels.
--
-- ⚠️ ORDRE DE DÉPLOIEMENT : n'appliquer qu'une fois le code qui prend en charge GPT-6
-- (traduction de l'effort `minimal` → `none`, `forceReasoning`, capacités du modèle — cf.
-- src/ai/providers/featureRuntime.ts) déployé sur TOUS les environnements qui lisent cette
-- table (production Vercel ET Hostinger). Un runtime plus ancien traiterait gpt-6-luna comme
-- un modèle inconnu : chat sans recherche web ni réglage d'effort.
--
-- Idempotent et respectueux d'un choix admin plus récent : ne bascule que si le chat est
-- encore sur gpt-5.6-luna. Service role only (hérite du verrou 0011). Aucune donnée de santé.
update public.ai_model_config
   set model_id = 'gpt-6-luna',
       provider = 'openai'
 where key = 'chat'
   and model_id = 'gpt-5.6-luna';
