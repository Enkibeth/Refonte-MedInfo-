-- RLS — feature_usage_counters (06_BILLING §1, ADR-0012). Lecture OWN-ROW, AUCUNE écriture client.
-- Isolation cross-user testée dans tests/rls/usage-isolation.test.ts.
--
-- Un user lit UNIQUEMENT sa propre consommation (auth.uid() = user_id) pour afficher son
-- quota restant côté app. Il ne peut NI insérer NI modifier NI supprimer ses compteurs :
-- seul service_role écrit, via la RPC consume_feature_quota (anti-tampering — un client ne
-- doit pas pouvoir remettre son compteur à zéro). Même doctrine que subscriptions (0007).

ALTER TABLE feature_usage_counters ENABLE ROW LEVEL SECURITY;

-- Lecture seule pour le rôle authentifié (isolée par la policy ci-dessous). anon : aucun accès.
-- Volontairement AUCUN GRANT INSERT/UPDATE/DELETE au client : il ne peut pas réécrire ses quotas.
GRANT SELECT ON feature_usage_counters TO authenticated;

CREATE POLICY "users read own feature usage"
  ON feature_usage_counters FOR SELECT
  USING (auth.uid() = user_id);
