-- Migration 0031 — Garde d'entrée du chat (ADR-0029).
-- Seed ai_model_config de la feature "chat_guard" (étage 2 LLM de la garde :
-- relecture des hits « situation personnelle » + reformulations générales).
-- Convention 0011 : le POST admin fait un UPDATE, la ligne doit préexister.
-- Aucune table : la garde est du code pur (src/ai/chat/guard/), pas de données.

INSERT INTO ai_model_config (key, model_id, label, provider)
VALUES ('chat_guard', 'gemini-2.5-flash-lite', 'Chat — Garde d''entrée (classifieur)', 'google')
ON CONFLICT (key) DO NOTHING;
