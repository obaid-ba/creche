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

USER creche
EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/health/ || exit 1

# Two threads per worker: the workload is IO-bound (Postgres, media), so
# threads add concurrency more cheaply than extra processes.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--threads", "2", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
