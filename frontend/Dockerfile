# ─── Build stage ────────────────────────────────────────────────────────
FROM node:24-slim AS builder

WORKDIR /app

# Dependencies are copied and installed first so a source-only change
# does not invalidate the npm layer.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .

# Baked in at build time: Vite inlines VITE_* into the bundle, so this is
# a build argument rather than a runtime environment variable.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ─── Runtime stage ──────────────────────────────────────────────────────
# nginx serves the built assets. The result is static files behind a real
# web server rather than a development server left running in production.
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx:alpine ships an unprivileged `nginx` user; the master process
# still needs root to bind :80 and then drops to it for workers.
RUN mkdir -p /var/cache/nginx && chown -R nginx:nginx /var/cache/nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
