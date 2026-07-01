-- Migration 0030 — Import d'un CV existant (module CV Builder, ADR-0028).
--
-- Seed ai_model_config de la feature IA "cv_import" (route /api/cv-import) : l'IA structure
-- le TEXTE d'un CV existant (extrait côté client par pdf.js / mammoth) dans le modèle de CV,
-- pour pré-remplir l'éditeur. Aucune table : la sortie est renvoyée au client, jamais archivée.
-- Le POST admin fait un UPDATE : la ligne doit préexister (convention 0011). Modèle par
-- défaut : Claude Sonnet 4.6 (extraction structurée fiable, ne doit rien inventer).

INSERT INTO ai_model_config (key, model_id, label, provider, web_search) VALUES
  ('cv_import', 'claude-sonnet-4-6', 'CV — Import (pré-remplissage)', 'anthropic', false)
ON CONFLICT (key) DO NOTHING;
