# ─── Build stage ────────────────────────────────────────────────────────
# Compilers and headers live here only; the runtime image never gets them,
# which keeps it smaller and removes a class of build-time tooling from
# the deployed container.
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt

# ─── Runtime stage ──────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=config.settings.prod

# libpq for psycopg, curl for the container healthcheck, gettext for the
# msgfmt that compilemessages shells out to. No compilers.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl gettext \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv

# A non-root user: a container process that does not need root should not
# have it, and this one only reads its code and writes to media/.
RUN useradd --create-home --uid 10001 creche
WORKDIR /app
COPY --chown=creche:creche . .

RUN mkdir -p /app/media /app/staticfiles \
    && chown -R creche:creche /app/media /app/staticfiles

# Recompile the catalogues from source rather than trusting the committed
# .mo, so the image cannot ship a translation the repository does not
# actually contain. msgfmt directly rather than `manage.py
# compilemessages`: that would import production settings, which demand
# every runtime secret, and the build has no business holding those.

RUN find /app/locale -name '*.po' \
        -exec sh -c 'msgfmt --check -o "${0%.po}.mo" "$0"' {} \;

# Committed from Windows checkouts, so the entrypoint can arrive with CRLF
# line endings or without its execute bit (git tracked it 100644). Either
# one kills the container before Python starts, with a message that points
# at the file rather than at the mode. Normalise both here: .gitattributes
# keeps it from recurring, this keeps a stale checkout from mattering.
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh \
    && chmod +x /app/docker-entrypoint.sh

USER creche
EXPOSE 8000

# Invoked through `sh` rather than relying on the shebang, so a lost
# execute bit degrades to a working container instead of a failed deploy.
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/health/ || exit 1

# Two threads per worker: the workload is IO-bound (Postgres, media), so
# threads add concurrency more cheaply than extra processes.
#
# The worker count is left to gunicorn's WEB_CONCURRENCY, which Render
# sets to 1 on the free plan's 512 MB. Hardcoding 3 put three Django
# processes in that much memory, where the OOM killer reaps one and
# Render reports a crash loop with no traceback to explain it.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--threads", "2", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
