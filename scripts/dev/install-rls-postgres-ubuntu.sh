#!/usr/bin/env bash
set -euo pipefail

# Installe les prérequis locaux du gate RLS sur Ubuntu/Debian.
# Le harness tests/rls/helpers/pgHarness.ts démarre un vrai cluster jetable via initdb.
# Depuis l'étape 5 RAG, les migrations requièrent aussi l'extension pgvector.

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This helper requires apt-get (Ubuntu/Debian). Use DATABASE_URL/RLS_TEST_DATABASE_URL on other systems." >&2
  exit 1
fi

if [ "${EUID}" -ne 0 ]; then
  echo "Please run as root or with sudo: sudo npm run setup:rls:ubuntu" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y postgresql

pg_major="${PG_MAJOR:-}"
if [ -z "${pg_major}" ]; then
  pg_major="$(find /usr/lib/postgresql -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -nr | head -n 1)"
fi

if [ -z "${pg_major}" ]; then
  echo "PostgreSQL installed but no /usr/lib/postgresql/<major> directory was found." >&2
  exit 1
fi

apt-get install -y "postgresql-${pg_major}-pgvector"

echo "OK — installed PostgreSQL ${pg_major} server binaries and pgvector for the RLS harness."
echo "You can now run: npm run test:rls"
