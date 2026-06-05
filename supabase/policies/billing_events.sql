-- RLS — billing_events (06_BILLING §6, ADR-0012). SERVICE ROLE ONLY.
-- RLS activée + AUCUNE policy + AUCUN grant client = table invisible/inécrivable pour
-- anon/authenticated. Seul service_role (BYPASSRLS, webhook serveur) y accède (idempotence).
-- Vérifié dans tests/rls/billing-isolation.test.ts (le client doit échouer).

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON billing_events FROM anon, authenticated;
