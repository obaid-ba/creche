#!/bin/sh
# Production start-up: wait for the database, apply migrations, collect
# static files, then hand over to the CMD.
#
# Migrations run here rather than in a separate step so a deploy cannot
# start serving against a schema it does not match. With several replicas
# this should move to a one-off job instead.
set -e

echo "Waiting for PostgreSQL at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}…"
until python -c "
import os, socket, sys
s = socket.socket()
s.settimeout(2)
try:
    s.connect((os.environ.get('POSTGRES_HOST', 'db'), int(os.environ.get('POSTGRES_PORT', 5432))))
except OSError:
    sys.exit(1)
"; do
  sleep 1
done
echo "PostgreSQL is up."

# Migrations go through a direct connection when one is given.
#
# A transaction pooler (Supabase's port 6543, PgBouncer) hands a different
# backend to every transaction, and migrations take advisory locks and
# create objects across statements that assume one. Set
# MIGRATION_DATABASE_URL to the non-pooling URL and leave DATABASE_URL on
# the pooler for serving; where there is no pooler, leave it unset.
if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
  echo "Migrating over the direct connection…"
  DATABASE_URL="$MIGRATION_DATABASE_URL" \
    DB_CONN_MAX_AGE=60 \
    DB_DISABLE_SERVER_SIDE_CURSORS=False \
    python manage.py migrate --noinput
else
  python manage.py migrate --noinput
fi

python manage.py collectstatic --noinput --clear

exec "$@"
