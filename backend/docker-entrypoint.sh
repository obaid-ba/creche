#!/bin/sh
# Production start-up: wait for the database, apply migrations, collect
# static files, then hand over to the CMD.
#
# Migrations run here rather than in a separate step so a deploy cannot
# start serving against a schema it does not match. With several replicas
# this should move to a one-off job instead.
set -e

# Where to wait is read from DATABASE_URL when there is one, and only
# then from POSTGRES_HOST/PORT. Those two are a compose-only convenience:
# on a managed host DATABASE_URL is the whole configuration, nothing sets
# them, and the old `POSTGRES_HOST:-db` default aimed this loop at the
# hostname `db`. That does not resolve outside compose; getaddrinfo
# raises gaierror, which is an OSError, so the loop retried forever and
# the container hung at boot without reporting anything.
#
# Bounded, for the same reason: a database that is not coming back should
# fail the deploy with the host in the message, not hang until the
# platform times it out and shows an empty log.
WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"

python - "$WAIT_TIMEOUT" <<'PYWAIT' || exit 1
import os, socket, sys, time
from urllib.parse import urlsplit

url = os.environ.get("MIGRATION_DATABASE_URL") or os.environ.get("DATABASE_URL") or ""
if url:
    parts = urlsplit(url)
    host, port = parts.hostname, parts.port or 5432
else:
    host = os.environ.get("POSTGRES_HOST", "db")
    port = int(os.environ.get("POSTGRES_PORT", 5432))

if not host:
    sys.exit("No database host: set DATABASE_URL or POSTGRES_HOST.")

deadline = time.monotonic() + float(sys.argv[1])
print("Waiting for PostgreSQL at %s:%s..." % (host, port), flush=True)
last = None
while time.monotonic() < deadline:
    try:
        with socket.create_connection((host, port), timeout=5):
            print("PostgreSQL is up.", flush=True)
            sys.exit(0)
    except OSError as exc:
        last = exc
        time.sleep(1)
sys.exit("PostgreSQL at %s:%s unreachable after %ss: %s" % (host, port, sys.argv[1], last))
PYWAIT

# Migrations go through MIGRATION_DATABASE_URL when one is given.
#
# A *transaction* pooler (Supabase port 6543, PgBouncer) hands a different
# backend to every transaction, and migrations take advisory locks and
# create objects across statements that assume one, so it cannot be used
# for this. A *session* pooler (port 5432) holds one backend for the whole
# connection and is safe. Supabase's own direct host,
# db.<ref>.supabase.co, is IPv6-only and unreachable from Render, so on
# that pairing both URLs are the session pooler and this branch simply
# re-applies the same settings. Keep it: it is what makes the pooled and
# migrating connections independently configurable.
#
# Where there is no pooler at all, leave MIGRATION_DATABASE_URL unset.
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
