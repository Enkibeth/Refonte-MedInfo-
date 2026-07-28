-- 0043_profile_chat_country.sql
-- Pays du chat persisté au PROFIL (retour Hugo 2026-07-28).
--
-- Le pays d'exercice choisi dans le chat (oriente les sources : agence du
-- médicament, RCP, recommandations) ne vivait qu'en localStorage : perdu à
-- chaque changement d'appareil/navigateur (« à chaque reconnexion il est
-- oublié »). Il devient une préférence de PROFIL, own-row comme les infos
-- perso (0017) : synchronisée entre appareils, chargée à la connexion.
-- localStorage reste le repli des visiteurs non connectés.
--
-- Préférence d'affichage/orientation des sources — PAS une donnée de santé,
-- PAS une source de vérité serveur (le body de /api/chat reste borné par
-- coerceCountry). Hors verrou anti-élévation (0005/0016 : persona/status
-- seulement) : la ligne reste modifiable par son propriétaire (RLS own-row).

alter table public.profiles
  add column if not exists chat_country text;

alter table public.profiles
  drop constraint if exists profiles_chat_country_check;

alter table public.profiles
  add constraint profiles_chat_country_check
  check (
    chat_country is null
    or chat_country in ('FR','BE','CH','LU','CA','DE','ES','IT','PT','NL','GB','US','OTHER')
  );
