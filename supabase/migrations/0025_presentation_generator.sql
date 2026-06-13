-- Migration 0025 — Générateur de présentations médicales (étudiants + professionnels).
--
-- Seed ai_model_config de la feature IA "presentation_generate" (route /api/presentation,
-- mode IA du générateur de slides). Le POST admin fait un UPDATE : la ligne doit
-- préexister (convention 0011). Modèle par défaut : Claude Sonnet 4.6 (raisonnement
-- structuré + JSON fiable pour régénérer le deck spec à chaque tour).
--
-- Aucune nouvelle table : le mode manuel est 100 % client (export PPTX dans le
-- navigateur, aucune donnée envoyée) ; le mode IA n'archive rien côté serveur.
-- L'autorisation (étudiant/professionnel/admin) est dérivée du profil vérifié dans
-- la route API (serverPersona), jamais du body.

INSERT INTO ai_model_config (key, model_id, label, provider, web_search) VALUES
  ('presentation_generate', 'claude-sonnet-4-6', 'Présentations — Co-construction', 'anthropic', false)
ON CONFLICT (key) DO NOTHING;
