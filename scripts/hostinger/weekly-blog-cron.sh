#!/usr/bin/env bash
# Déclencheur de l'agent éditorial hebdomadaire du blog (ADR-0025).
#
# Le cron système (« Cron Jobs » de hPanel ou crontab VPS) appelle /api/cron/weekly-blog le
# lundi 06:00 avec `Authorization: Bearer $CRON_SECRET` — ce script construit cette requête
# sans écrire le secret dans la ligne de cron.
#
# hPanel (hébergement Node.js géré) — commande du Cron Job :
#   bash /home/<utilisateur>/domains/medinfo-ai.com/hbuilds/current/nodejs/scripts/hostinger/weekly-blog-cron.sh >> /home/<utilisateur>/weekly-blog.log 2>&1
# avec le secret dans /home/<utilisateur>/.medinfo-cron.env (une ligne `CRON_SECRET=…`).
# Chez Hostinger, l'application n'a ni `.env` à sa racine (les variables vivent dans hPanel)
# ni port local fixe (le processus est arrêté quand il est inactif) : on appelle donc
# TOUJOURS l'URL publique.
#
# VPS (crontab de l'utilisateur qui possède l'app) :
#   0 6 * * 1 /home/USER/medinfo/scripts/hostinger/weekly-blog-cron.sh >> /home/USER/medinfo/logs/weekly-blog.log 2>&1
#
# Le pipeline dure plusieurs minutes (sujet → rédaction → vérification → relecture) : le
# timeout curl est volontairement large. Si le proxy coupe la connexion avant la fin, le
# pipeline continue côté serveur et l'article apparaît dans l'onglet Blog du panel admin.
# Sans CRON_SECRET, la route refuse (401, fail-closed) : le script s'arrête explicitement.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

if [ -z "${ENV_FILE:-}" ]; then
  if [ -f "${HOME:-}/.medinfo-cron.env" ]; then
    ENV_FILE="$HOME/.medinfo-cron.env"
  else
    ENV_FILE="$APP_DIR/.env"
  fi
fi

if [ -z "${CRON_SECRET:-}" ] && [ -f "$ENV_FILE" ]; then
  # Lecture ciblée : on n'exporte que la variable nécessaire, et on retire UNIQUEMENT les
  # guillemets encadrants + un éventuel retour chariot Windows (fichier .env envoyé en FTP).
  # Surtout pas les espaces internes : un secret tronqué en silence donnerait un 401 le lundi
  # matin sans aucun indice.
  CRON_SECRET="$(
    grep -E '^[[:space:]]*(export[[:space:]]+)?CRON_SECRET=' "$ENV_FILE" |
      tail -n 1 |
      sed -E "s/^[[:space:]]*(export[[:space:]]+)?CRON_SECRET=//; s/\r$//; s/^\"(.*)\"$/\1/; s/^'(.*)'$/\1/" || true
  )"
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[weekly-blog] CRON_SECRET absent (ni dans l'environnement, ni dans $ENV_FILE) — abandon." >&2
  exit 1
fi

# URL publique par défaut (domaine du site). En recette : APP_URL=https://<domaine-temporaire>.
APP_URL="${APP_URL:-${EXPO_PUBLIC_APP_URL:-https://medinfo-ai.com}}"

echo "[weekly-blog] $(date -u +%FT%TZ) — déclenchement sur $APP_URL"
curl -fsS -m 900 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL%/}/api/cron/weekly-blog"
echo
echo "[weekly-blog] $(date -u +%FT%TZ) — terminé"
