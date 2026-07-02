-- Migration 0031 — Sous-agent PubMed du chat professionnel (ADR-0030, suivi).
--
-- Seed ai_model_config de la feature IA "pubmed_agent" (route /api/chat) : quand le modèle
-- principal du chat n'est PAS Claude (gpt-5.2 par défaut), le chatbot professionnel délègue
-- la recherche PubMed à ce sous-agent Claude, seul provider capable de monter le connecteur
-- MCP PubMed hébergé par Anthropic (pubmed.mcp.claude.com). Aucune table : la synthèse est
-- renvoyée à l'orchestrateur, jamais archivée séparément.
-- Le POST admin fait un UPDATE : la ligne doit préexister (convention 0011).

INSERT INTO ai_model_config (key, model_id, label, provider, web_search) VALUES
  ('pubmed_agent', 'claude-sonnet-4-6', 'Chat — Sous-agent PubMed', 'anthropic', false)
ON CONFLICT (key) DO NOTHING;
