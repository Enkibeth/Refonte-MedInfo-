-- Migration 0034 — instrumentation de la boucle agentique du chat (balance rapidité/qualité 2026-07)
-- Ajoute à ai_interactions le nombre d'étapes LLM (`steps`) et le décompte d'appels par
-- outil (`tool_calls` jsonb, ex. {"europe_pmc_search": 2, "verify_source_links": 1}) pour
-- diagnostiquer OÙ part le temps de génération (sous-agent PubMed ? lectures séquentielles ?).
-- NOMS d'outils uniquement — jamais leurs arguments, aucun contenu de message ni donnée
-- de santé (03_SECURITY §6). Accès inchangé : SERVICE ROLE ONLY (RLS sans policy, cf 0002).

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS steps int,
  ADD COLUMN IF NOT EXISTS tool_calls jsonb;

COMMENT ON COLUMN ai_interactions.steps IS
  'Nombre d''étapes LLM de la boucle agentique du chat (1 = réponse directe sans outil).';
COMMENT ON COLUMN ai_interactions.tool_calls IS
  'Décompte d''appels par nom d''outil (jsonb) — noms seulement, jamais les arguments.';
