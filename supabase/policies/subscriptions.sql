-- RLS — subscriptions (06_BILLING §6, ADR-0012). Lecture own-row, AUCUNE écriture client.
-- Isolation cross-user + anti-auto-promotion testées dans tests/rls/billing-isolation.test.ts.
-- Un user lit UNIQUEMENT sa propre ligne (auth.uid() = user_id). Il ne peut ni l'insérer ni la
-- modifier : seul le webhook Stripe (service_role) écrit le statut payant (source de vérité).

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Lecture seule pour le rôle authentifié (isolée par la policy ci-dessous). anon : aucun accès.
-- Volontairement AUCUN GRANT INSERT/UPDATE/DELETE : le client ne peut pas se promouvoir payant.
GRANT SELECT ON subscriptions TO authenticated;

CREATE POLICY "users read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
