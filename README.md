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
| [docs/i18n.md](docs/i18n.md) | French and Arabic, plurals, direction, fonts |
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

### 2. With Docker

```bash
docker compose up -d db      # Postgres 16, host port 5433
docker compose up            # all services
```

> **If this project lives outside your home directory**, `docker compose up`
> will fail on the `backend` and `frontend` services with:
>
> ```
> mounts denied: the path .../creche/backend is not shared from the host
> ```
>
> Docker Desktop only bind-mounts from an allowlist of host paths, and
> that list does not include secondary drives by default. Add the drive in
> **Docker Desktop → Settings → Resources → File sharing**, then apply and
> restart. Editing `~/.docker/desktop/settings-store.json` by hand does
> **not** work — it prevented the Docker VM from starting when tried.
>
> The `db` service is unaffected (it uses a named volume, not a bind
> mount), so the native path in §3 works regardless.

- Frontend → http://localhost:5173
- API → http://localhost:8000/api
- API docs (dev only) → http://localhost:8000/api/docs

**If the Docker daemon is not running** and you use Docker Desktop on Linux, it
starts as a *user* service — no root needed:

```bash
systemctl --user start docker-desktop
```

### 3. Without Docker (works on any path)

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

### 4. Production

The development stack above runs `runserver` and the Vite dev server —
neither belongs in production. There is a separate stack for that:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

gunicorn behind nginx, source copied into the images rather than
bind-mounted, non-root containers, the database not published to the
host, and migrations applied on start-up. Full detail, including the
security posture and what still needs doing before a real deployment, is
in [docs/deployment.md](docs/deployment.md).

> Because the production images copy the source instead of bind-mounting
> it, the Docker Desktop file-sharing limitation described above does not
> apply to them — the production stack builds and runs on any path.

### 5. Demo data

```bash
cd backend
POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5433 python manage.py seed_demo
```

Creates three staff accounts, five families with children across all four
age groups, three days of recorded care events, activities, conversations
and complaints. It is idempotent, so it is safe to re-run.

Today's day is deliberately left **unpublished** so the publish flow can be
demonstrated. The command prints the accounts it created and refuses to run
with `DEBUG=False` unless given `--force`, because every demo account shares
one published password.

---

## ⚠️ Before the site goes live

Some copy on the public site was written during development and **was not
supplied by the nursery**. It is displayed to visitors as fact. Publishing
it unchecked would put wrong information in front of parents — wrong
opening hours in particular send people to a locked door.

Everything needing confirmation is collected in one place:
[`frontend/src/config/nursery.ts`](frontend/src/config/nursery.ts) →
`NURSERY_FACTS`. Each entry carries a `verified` flag.

| Claim | Current value | Source |
| --- | --- | --- |
| Opening hours | Mon–Fri, 07:30–18:30 | **invented — confirm** |
| Age range | 2 mois – 4 ans | upper bound **invented — confirm** |
| Establishment type | "Crèche privée" | **assumed — confirm** |
| Meals offered | "Repas équilibrés" | **assumed — confirm** |
| Phone, Facebook, map location | — | supplied by the nursery ✅ |
| Gallery photos, logo, registration PDF | — | supplied by the nursery ✅ |

Set every `verified: true` once checked, then delete the warning comment.
`FACTS_VERIFIED` exports whether all of them have been.

**Still missing entirely:**
- A street address (only map coordinates are known).
- The nursery's own history and team, for `/about`.
- A second video that was mentioned but not supplied.

---

## Accessibility

The interface is checked against WCAG 2.1 AA with axe-core across all
public, parent and staff pages. Colour tokens are contrast-verified: white
on `primary-500` is 4.74:1 and `ink-400` on the cream background is 5.17:1,
both above the 4.5:1 minimum.

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
