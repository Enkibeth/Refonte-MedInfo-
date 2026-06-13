-- Migration 0028 — AI Boost du planificateur de révisions (ADR-0027, suivi).
--
-- Seed ai_model_config de la feature IA "revision_boost" (route /api/revision-boost).
-- Le POST admin fait un UPDATE : la ligne doit préexister (convention 0011).
-- Modèle par défaut : Claude Sonnet 4.6 (raisonnement structuré + JSON fiable).
--
-- Aucune nouvelle table. L'« AI Boost » NE FAIT QUE PROPOSER des ajustements bornés
-- du plan (l'étudiant valide) ; il n'écrit rien lui-même et ne touche aucune donnée de
-- santé. L'autorisation (étudiant/admin) est dérivée du profil vérifié dans la route
-- (serverPersona), jamais du body. Pas de web_search (réponse purement organisationnelle).

INSERT INTO ai_model_config (key, model_id, label, provider, web_search) VALUES
  ('revision_boost', 'claude-sonnet-4-6', 'Révisions — AI Boost', 'anthropic', false)
ON CONFLICT (key) DO NOTHING;
