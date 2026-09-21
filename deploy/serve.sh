#!/usr/bin/env bash
#
# Run the production stack (nginx + gunicorn + Postgres), optionally
# behind a public HTTPS tunnel so other people can reach it.
#
#   ./deploy/serve.sh up        start it on http://localhost:8080
#   ./deploy/serve.sh tunnel    start it and open a public HTTPS URL
#   ./deploy/serve.sh tunnel -y skip the "this will be public" prompt
#   ./deploy/serve.sh status    what is running
#   ./deploy/serve.sh logs      follow nginx + gunicorn
#   ./deploy/serve.sh down      stop it (data is kept)
#
# The two compose flags are not optional and the reasons are not obvious:
#
#   --env-file .env.prod.local  .env still holds change-me-in-production
#                               values, and prod settings refuse to boot
#                               on those.
#   -p creche-prod              without it this adopts the *dev* project
#                               name and reuses the dev database volume,
#                               which silently ignores the production
#                               password (Postgres only applies it to an
#                               empty data directory).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE=".env.prod.local"
PROJECT="creche-prod"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" -p "$PROJECT")
PORT="$(grep -E '^HTTP_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo 8080)"
PORT="${PORT:-8080}"

die() { printf '\n  %s\n\n' "$*" >&2; exit 1; }
say() { printf '  %s\n' "$*"; }

require_env() {
  [[ -f "$ENV_FILE" ]] || die "$ENV_FILE is missing. Copy .env.example and set the secrets."
}

wait_healthy() {
  say "waiting for the stack to come up…"
  for _ in $(seq 1 60); do
    if curl -fsS -m 2 "http://localhost:${PORT}/healthz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  die "the stack did not become healthy — try: ./deploy/serve.sh logs"
}

cmd_up() {
  require_env
  "${COMPOSE[@]}" up -d --build "$@"
  wait_healthy
  printf '\n'
  say "running on  http://localhost:${PORT}"
  say "on this network:  http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}"
  printf '\n'
}

cmd_tunnel() {
  command -v cloudflared >/dev/null 2>&1 \
    || die "cloudflared is not installed. See https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"

  require_env
  warn_before_exposing

  # The hostname is assigned by Cloudflare and is different every run, so
  # the tunnel has to come up *first* — Django rejects a Host header that
  # is not in ALLOWED_HOSTS, and that list can only be written once the
  # name is known.
  local log; log="$(mktemp)"
  say "opening a tunnel…"
  cloudflared tunnel --url "http://localhost:${PORT}" --no-autoupdate >"$log" 2>&1 &
  local pid=$!
  trap 'kill '"$pid"' 2>/dev/null || true' EXIT INT TERM

  local url=""
  for _ in $(seq 1 45); do
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$log" | head -1 || true)"
    [[ -n "$url" ]] && break
    kill -0 "$pid" 2>/dev/null || { cat "$log" >&2; die "cloudflared exited"; }
    sleep 1
  done
  [[ -n "$url" ]] || { cat "$log" >&2; die "no tunnel URL after 45s"; }

  local host="${url#https://}"

  # A temporary env file rather than editing the real one: the hostname is
  # good for this run only, and leaving a dead tunnel host in ALLOWED_HOSTS
  # is confusing later.
  local tmp_env; tmp_env="$(mktemp)"
  cp "$ENV_FILE" "$tmp_env"
  {
    echo "DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,frontend,backend,${host}"
    echo "CSRF_TRUSTED_ORIGINS=${url}"
    echo "CORS_ALLOWED_ORIGINS=${url}"
  } >>"$tmp_env"
  trap 'kill '"$pid"' 2>/dev/null || true; rm -f "'"$tmp_env"'" "'"$log"'"' EXIT INT TERM

  docker compose -f docker-compose.prod.yml --env-file "$tmp_env" -p "$PROJECT" up -d --build
  wait_healthy

  printf '\n'
  say "════════════════════════════════════════════════════════════"
  say "  $url"
  say "════════════════════════════════════════════════════════════"
  printf '\n'
  say "Share that link. Ctrl+C closes the tunnel; the stack keeps running."
  printf '\n'
  wait "$pid"
}

warn_before_exposing() {
  # Worth a pause: this is about to be reachable by anyone with the link.
  local demo_accounts
  demo_accounts="$(docker exec "${PROJECT}-backend-1" python -c "
import django; django.setup()
from apps.accounts.models import User
print(User.objects.filter(email__endswith='@mamati.test').count())
" 2>/dev/null || echo '?')"

  printf '\n'
  say "About to put this on the public internet."
  [[ "$demo_accounts" != "0" ]] && \
    say "  · $demo_accounts demo accounts exist, all sharing one published password."
  say "  · Anyone with the link can sign in as the directrice and change data."
  say "  · Fine for showing the app; not for real children's records."
  if [[ "${ASSUME_YES:-0}" == "1" ]]; then
    say "(-y given, continuing)"
    printf '\n'
    return 0
  fi
  printf '\n'
  read -r -p "  Continue? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || die "cancelled."
}

cmd_status() { "${COMPOSE[@]}" ps; }
cmd_logs()   { "${COMPOSE[@]}" logs -f --tail=50 frontend backend; }
cmd_down()   { "${COMPOSE[@]}" down; say "stopped. Volumes kept — data is safe."; }

case "${1:-up}" in
  up)     shift || true; cmd_up "$@" ;;
  tunnel) shift || true; [[ "${1:-}" == "-y" || "${1:-}" == "--yes" ]] && ASSUME_YES=1; cmd_tunnel ;;
  status) cmd_status ;;
  logs)   cmd_logs ;;
  down)   cmd_down ;;
  *)      die "usage: ./deploy/serve.sh {up|tunnel|status|logs|down}" ;;
esac
