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

python manage.py migrate --noinput
python manage.py collectstatic --noinput --clear

exec "$@"
