-- Justesse des coûts (panel admin, audit 2026-07 — item K).
--
-- `tokens_in` (= usage.inputTokens de l'AI SDK) INCLUT les tokens d'entrée lus depuis
-- le cache du provider (prompt caching OpenAI / cache read Anthropic), facturés ~10 %
-- du prix d'entrée. Les compter au plein tarif SUR-estime le coût — surtout pour le
-- chat, dont le gros préfixe système est caché d'un appel à l'autre. Cette colonne
-- NULLABLE stocke la part cachée pour la tarifer au taux réduit dans src/admin/cost.ts.
--
-- Aucun contenu de message : un simple compteur de tokens, comme tokens_in/tokens_out.
-- Service role only comme le reste de la table (RLS sans policy, migration 0002).
alter table public.ai_interactions
  add column if not exists cached_tokens_in integer;

comment on column public.ai_interactions.cached_tokens_in is
  'Part de tokens_in lue depuis le cache du provider (facturee ~10%). NULL si non renseigne. Justesse des couts, jamais de contenu.';
