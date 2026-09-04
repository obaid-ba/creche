# Crèche Mamati

Nursery management and parent communication platform.

Parents follow their child's day — meals, naps, activities, temperature — and
talk to the nursery. Staff record the day, manage children and handle
complaints.

> The interface is **French**. Code, database fields, API routes and
> documentation are **English**.

---

## Stack

| Layer | Technology |
| --- | --- |
| Backend | Django 5 · Django REST Framework · PostgreSQL 16 |
| Frontend | React 19 · TypeScript (strict) · Vite 6 · Tailwind CSS v4 |
| State | TanStack Query v5 · React Hook Form · Zod |
| Auth | JWT — memory access token + httpOnly refresh cookie |
| Tests | pytest · Vitest + React Testing Library |
| Infra | Docker Compose |

---

## Documentation

Read these before changing anything structural.

| Document | Contents |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | System design, stack rationale, risks |
| [docs/database.md](docs/database.md) | Entities, constraints, indexes, ERD |
| [docs/api.md](docs/api.md) | REST surface, error envelope, pagination |
| [docs/authentication.md](docs/authentication.md) | Tokens, roles, access codes, ownership |
| [docs/timeline.md](docs/timeline.md) | The timeline architectural decision |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Phased roadmap |

---

## Quick start

### 1. Environment

```bash
cp .env.example .env
```

Then set `DJANGO_SECRET_KEY` and `ACCESS_CODE_HMAC_KEY` to distinct random
values:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

> **Do not put inline `#` comments after values in `.env`.** `django-environ`
> keeps them as part of the value.

### 2. With Docker (recommended)

```bash
docker compose up -d db      # Postgres 16, host port 5433
docker compose up            # all services
```

- Frontend → http://localhost:5173
- API → http://localhost:8000/api
- API docs (dev only) → http://localhost:8000/api/docs

**If the Docker daemon is not running** and you use Docker Desktop on Linux, it
starts as a *user* service — no root needed:

```bash
systemctl --user start docker-desktop
```

### 3. Without Docker

Postgres still comes from Compose (host port **5433**, chosen so it does not
collide with a Postgres already running on 5432).

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5433 python manage.py migrate
POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5433 python manage.py runserver

# Frontend (second terminal)
cd frontend
npm install
npm run dev
```

Vite proxies `/api` and `/media` to `localhost:8000`, so no CORS setup is
needed for local work.

---

## Tests

```bash
# Backend
cd backend
POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5433 pytest

# Frontend
cd frontend
npm test
npm run typecheck
```

---

## Project layout

```
backend/
  config/          settings (base/dev/test/prod), urls, wsgi
  common/          base models, age logic, errors, pagination, permissions
  apps/
    accounts/      User, profiles, Guardianship, ChildAccessCode
    children/      Child, age groups
    care/          TimelineEvent, DailyRecord
    activities/  messaging/  complaints/  notifications/  audit/

frontend/src/
  app/             router, providers, query client
  components/ui/   design system
  layouts/  pages/  features/  services/  hooks/  types/  lib/
```

---

## Notes for developers

- **Never trust `child_id`, `parent_id` or `role` from a request.** Every
  child-scoped endpoint resolves through `Child.objects.visible_to(user)`.
  See [docs/authentication.md](docs/authentication.md) §5.
- **Age is never stored.** `date_of_birth` is the only fact; age and age group
  are computed (`common/age.py`).
- **The timeline is the source of truth for care events**, not a copy of them.
  The daily record's summary is aggregated on read. See
  [docs/timeline.md](docs/timeline.md).
- **The access token never touches `localStorage`** — a test enforces this.
- Business logic belongs in hooks and services, not in React components.

### Working on NTFS

This project may live on an NTFS (`fuseblk`) mount. Compose keeps
`node_modules` and Python packages in named volumes rather than the bind mount,
and Vite watches by polling, because inotify is unreliable there.
