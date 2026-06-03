-- RLS — usage_counters (03_SECURITY §3). SERVICE ROLE ONLY.
-- Table de compteurs techniques journaliers sans donnée santé : aucun accès direct client.
-- La route serveur /api/chat utilise la clé service_role pour incrémenter avant la couche 1.

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

-- Pas de GRANT ni policy client : anon/authenticated ne lisent ni n'écrivent les compteurs.
REVOKE ALL ON usage_counters FROM anon, authenticated;
