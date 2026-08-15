#!/usr/bin/env bash
# Déclencheur de l'agent éditorial hebdomadaire du blog (ADR-0025) hors Vercel.
#
# Sur Vercel, `vercel.json` → "crons" appelait /api/cron/weekly-blog le lundi 06:00 UTC en
# envoyant `Authorization: Bearer $CRON_SECRET`. En auto-hébergement, c'est le cron système
# (crontab VPS ou « Cron Jobs » de hPanel) qui joue ce rôle — ce script reproduit exactement
# la même requête sans jamais écrire le secret dans la crontab (visible en clair).
#
# Installation (VPS, crontab de l'utilisateur qui possède l'app) :
#   crontab -e
#   0 6 * * 1 /home/USER/medinfo/scripts/hostinger/weekly-blog-cron.sh >> /home/USER/medinfo/logs/weekly-blog.log 2>&1
#
# Le pipeline dure plusieurs minutes (sujet → rédaction → vérification → relecture) :
# le timeout curl est volontairement large. Sans CRON_SECRET, la route refuse (401,
# fail-closed) et aucun article n'est généré : le script s'arrête donc explicitement.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"

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

APP_URL="${APP_URL:-${EXPO_PUBLIC_APP_URL:-http://127.0.0.1:${PORT:-3000}}}"

echo "[weekly-blog] $(date -u +%FT%TZ) — déclenchement sur $APP_URL"
curl -fsS -m 900 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL%/}/api/cron/weekly-blog"
echo
echo "[weekly-blog] $(date -u +%FT%TZ) — terminé"
