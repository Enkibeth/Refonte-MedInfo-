-- Migration 0036 — Section QCM du chatbot étudiant (génération à la demande, type EDN).
--
-- Seed ai_model_config de la feature IA "qcm_generate" (route /api/qcm). L'étudiant
-- clique sous une réponse du chat pour générer un mini-examen de QCM/QCS type EDN
-- sur le sujet en cours. Le POST admin fait un UPDATE : la ligne doit préexister
-- (convention 0011). Modèle par défaut : Claude Sonnet 4.6 (JSON structuré fiable).
--
-- Aucune nouvelle table : la génération n'archive rien, la NOTATION est déterministe
-- côté client (src/qcm/qcm.ts, barème EDN « discordances »). L'autorisation
-- (étudiant/professionnel/admin) est dérivée du profil vérifié dans la route API
-- (serverPersona), jamais du body. Pas de conseil médical individuel : entraînement
-- sur des connaissances générales.

INSERT INTO ai_model_config (key, model_id, label, provider, web_search) VALUES
  ('qcm_generate', 'claude-sonnet-4-6', 'QCM — Génération type EDN', 'anthropic', false)
ON CONFLICT (key) DO NOTHING;
