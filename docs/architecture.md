# Crèche Mamati — Architecture

> Status: **Design baseline (Phase 0)** · Last updated: 2026-09-04
>
> User-facing copy is **French**. Code, identifiers, DB columns, API routes and docs are **English**.

---

## 1. Repository audit (starting point)

The repository was **empty** at the start of this project — no source, no
dependencies, no configuration, no git history. Therefore:

| Question | Answer |
| --- | --- |
| Existing code to reuse | None |
| Existing dependencies | None |
| What to replace | Nothing |
| Migration constraints | None — free choice of stack |

This is a **greenfield build**, so every decision below is made on merit rather
than inherited from legacy code.

### 1.1 Verified host environment

Measured, not assumed:

| Component | Version / state |
| --- | --- |
| Node | 24.19.0 |
| npm | 11.17.0 |
| Python | 3.12.3 |
| Docker Engine | 29.8.0 |
| Docker Compose | v5.3.1 |
| PostgreSQL server | 18.6, running on `127.0.0.1:5432` |
| PostgreSQL client | 18.6 |
| Working directory FS | `fuseblk` (NTFS), case-sensitive, exec bits honoured |

### 1.2 Environment constraints that shaped decisions

These are real, verified constraints — see [§11 Risks](#11-risks--open-questions).

1. **The host Postgres has no role for the current OS user**, and creating one
   needs `sudo`, which requires an interactive password. The host database is
   therefore **not usable** without manual operator action.
   → **Docker Compose owns the database.** This is the supported dev path.
2. **Docker Desktop was installed but stopped.** It starts as a *user* service
   (`systemctl --user start docker-desktop`) with no root needed, and has been
   verified working. Documented in the README so the next developer isn't stuck.
3. **The project lives on an NTFS (`fuseblk`) mount.** Bind-mount and
   `node_modules` I/O are materially slower than on ext4, and NTFS cannot
   represent POSIX ownership. Mitigations in [§9.2](#92-ntfs-mitigations).

---

## 2. Guiding principles

1. **The backend is the only authority on permissions.** The frontend never
   decides what a user may see; it only decides what to *render*.
2. **Derive, don't duplicate.** Age, age group, sleep duration and the daily
   summary are all *computed*. None are stored.
3. **One event log.** The timeline is not a second copy of the care data — it
   *is* the care data. See [docs/timeline.md](./timeline.md).
4. **Feature modules over layer folders.** A feature owns its API calls, hooks,
   types and components, so it can be understood and changed in one place.
5. **Soft delete for anything about a child.** Nursery records have legal and
   emotional weight; nothing important is ever hard-deleted by default.

---

## 3. Stack, and why

| Layer | Choice | Rationale |
| --- | --- | --- |
| API | Django 5 + DRF | Batteries-included auth, admin, migrations, ORM. The domain is CRUD-and-permissions heavy, which is exactly Django's strength. |
| DB | PostgreSQL 16 | `JSONB` for typed event payloads, partial + composite indexes, real constraints, `tstzrange` if we later need overlap checks. |
| Frontend | React 19 + TypeScript (strict) + Vite | Fast HMR, first-class TS, no framework-level SSR need — this is an authenticated app behind a login, plus a small public site. |
| Styling | Tailwind CSS v4 | Design tokens live in CSS, no runtime cost, keeps the design system consistent without a component library we'd have to fight. |
| Server state | TanStack Query v5 | Caching, background refetch, and request de-duplication for a read-heavy timeline. Removes most hand-rolled loading state. |
| Forms | React Hook Form + Zod | One Zod schema drives both TS types and runtime validation. |
| HTTP | Axios | Interceptors are the cleanest place for token refresh and error normalisation. |
| Icons | Lucide React | Consistent, tree-shakeable. |
| Tests | pytest + pytest-django / Vitest + RTL | Matches the brief; both are the ecosystem default. |

**Rejected:** Next.js (no SSR/SEO requirement beyond a small public site, and it
would complicate the Django API split), Redux (TanStack Query covers server
state; local UI state is small), a component kit like MUI (the brief asks for a
bespoke warm nursery aesthetic — a kit would be fought, not used).

---

## 4. System shape

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React SPA, Vite)                               │
│                                                          │
│  Public site  │  Parent space  │  Staff dashboard        │
│               │                │                         │
│  access token held in memory only ──────────┐            │
└───────────────────────────────────┬─────────┼────────────┘
                                    │ HTTPS   │ httpOnly refresh cookie
                                    ▼         ▼
┌──────────────────────────────────────────────────────────┐
│  Django + DRF                                            │
│                                                          │
│  Auth ─ RBAC ─ per-object ownership scoping              │
│  apps: accounts children care activities messaging       │
│        complaints notifications audit                    │
└───────────────┬──────────────────────────┬───────────────┘
                ▼                          ▼
       ┌─────────────────┐        ┌──────────────────┐
       │  PostgreSQL 16  │        │  Media storage   │
       │                 │        │  (abstracted)    │
       └─────────────────┘        └──────────────────┘
```

Media storage is behind Django's storage API from day one, so local disk in dev
can become S3-compatible object storage in production by changing settings only.

---

## 5. Backend structure

I follow the brief's layout with three deliberate changes, justified below.

```
backend/
  config/                 settings/{base,dev,prod}.py, urls.py, asgi/wsgi
  apps/
    accounts/             User, ParentProfile, StaffProfile, Guardianship,
                          ChildAccessCode, auth + claim flows
    children/             Child, age/age-group logic
    care/                 TimelineEvent (the care event log) + DailyRecord
    activities/           Activity, ActivityParticipation
    messaging/            Conversation, Message, Attachment
    complaints/           Complaint, ComplaintReply
    notifications/        Notification, fan-out
    audit/                AuditLog
  common/                 base models, pagination, permissions, errors,
                          storage, test factories
  manage.py
```

### Deviations from the suggested structure — and why

**(a) `daily_records/` + `timeline/` merged into one `care/` app.**
The brief lists them as separate modules, but they are not separate data — the
daily record *is* an aggregation over the same timestamped events the timeline
renders. Two apps would mean a circular import (each needs the other's models)
and would tempt a future developer into writing the data twice. One `care` app
owns the event log and exposes two *read shapes* over it. Full reasoning in
[docs/timeline.md](./timeline.md).

**(b) `parents/` and `staff/` folded into `accounts/`.**
Parent and staff are roles on one identity model with profile tables, not
separate authentication systems. Splitting them across apps would scatter the
permission logic that must be read as a whole to be audited.

**(c) Added `common/` and `audit/`.**
`common/` prevents the copy-paste of pagination, error envelopes and base
models. `audit/` is required by the security brief (§17) and is cross-cutting,
so it cannot live inside a feature app.

Frontend feature folders still match the brief's naming (`daily-records/`,
`timeline/`) because they are genuinely distinct *screens*, even though they
share one backend module.

---

## 6. Frontend structure

```
frontend/src/
  app/            router, providers, query client, error boundary
  components/ui/  design system primitives (§21 of the brief)
  layouts/        PublicLayout, ParentLayout, StaffLayout
  pages/          public site pages
  features/
    auth/  children/  daily-records/  timeline/  activities/
    messages/  complaints/  parents/  staff/
  services/       axios instance, interceptors, error normalisation
  hooks/          cross-feature hooks
  types/          shared domain types
  lib/            date, age, formatting helpers
  utils/
```

Each `features/<name>/` contains `api.ts`, `hooks.ts`, `schemas.ts`,
`types.ts` and `components/`. **Business logic lives in hooks and services,
never in a component body** (brief §24).

---

## 7. Authentication & authorisation

Full detail in [docs/authentication.md](./authentication.md). Summary:

- One `User` model (email login) + `role ∈ {PARENT, STAFF, ADMIN}` + a
  one-to-one profile per role.
- **JWT via `simplejwt`**: short-lived access token kept **in memory only**;
  refresh token in an **httpOnly, Secure, SameSite=Strict cookie**. Tokens are
  never written to `localStorage` — this app holds children's data and that
  storage is readable by any XSS.
- **The child access code (`MAM-7F42K`) is an enrolment token, not a password.**
  It links a parent to a child once, then stops being a credential. Reasoning
  and the security analysis are in `authentication.md` §4.
- Ownership is enforced by **queryset scoping**, not by checking an id the
  client sent. A parent's `Child` queryset is derived from their own
  `Guardianship` rows, so an unauthorised `child_id` cannot resolve at all.

---

## 8. Cross-cutting decisions

### 8.1 Age and age groups are never stored
`date_of_birth` is the only stored fact. Age and group are computed.

For **list filtering** the group is *not* computed row-by-row in Python — that
would break pagination and ordering. Instead a requested group is translated
into a `date_of_birth` **range predicate**, so Postgres can use the index:

```
group "1 → 2 ans"  →  date_of_birth ∈ (today - 24 months, today - 12 months]
```

Exact boundaries, including the newborn gap in the brief, are specified in
[docs/database.md](./database.md) §4.

### 8.2 Error envelope
Every non-2xx response uses one shape, so the frontend has exactly one place
that translates errors into French. See [docs/api.md](./api.md) §3.

### 8.3 Soft delete
`archived_at` on child-related models, with a default manager that hides
archived rows and an `all_objects` manager for staff restore flows.

### 8.4 Audit logging
Writes to `AuditLog` for: login success/failure, access-code issue/revoke/claim,
child create/update/archive/restore, guardianship change, complaint status
change, and any staff read of a child outside their assigned group.

---

## 9. Performance

- **Timeline N+1 is designed out**: one indexed query per (child, day) window,
  with `select_related('created_by')` and `prefetch_related` on the two
  reference targets (activity, message). Asserted by a
  `django_assert_num_queries` test, not by hope.
- Composite index `(child_id, occurred_at DESC)` serves the timeline's only
  hot query shape.
- Cursor pagination for timeline and messages; page-number pagination for
  admin tables where a page count is genuinely useful.
- Images validated, size-capped and thumbnailed on upload.
- Frontend: route-level code splitting, TanStack Query caching, lazy images.

### 9.2 NTFS mitigations
- `node_modules` and Python `.venv` are **not** bind-mounted into containers;
  containers keep their own copies in named volumes. This avoids the worst of
  the `fuseblk` I/O penalty and the POSIX-ownership mismatch.
- Vite uses polling-based file watching, since inotify is unreliable on
  `fuseblk`.

---

## 10. Testing strategy

Priority follows the brief §27 — the tests that matter most are the ones that
prove a parent **cannot** reach another family's data:

1. **Authorisation (highest value)**: parent ↛ other child's timeline, record,
   activity, message, complaint. Asserted at the API layer per endpoint.
2. Age-group boundary cases (exact birthday, leap day, day-before/day-after).
3. Timeline ordering, date filtering, type filtering, query-count budget.
4. Auth flows: login, refresh, code claim, code revoke, rate limits.
5. Child CRUD + archive/restore.
6. Complaints status transitions; messaging participant rules.

---

## 11. Risks & open questions

| # | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| R1 | NTFS working directory | Slow I/O, no POSIX perms | Named volumes for deps; polling watcher (§9.2) |
| R2 | Host Postgres unusable without sudo | Blocks non-Docker dev | Compose owns the DB; documented in README |
| R3 | Access code entropy (~28.6M for 5 chars, ~24.8 bits) | Brute-forceable if treated as a password | Code is enrolment-only, single-use, hashed, rate-limited, revocable (`authentication.md` §4) |
| R4 | Children's personal data (GDPR) | Legal exposure | Soft delete, audit log, least-privilege scoping, retention policy noted as a product decision |
| R5 | Photos of minors | High-sensitivity media | Signed time-limited media URLs; never guessable paths; upload type/size validation |
| R6 | Timeline as a single hot table | Growth over years | Indexed by `(child, occurred_at)`; partitioning by month is a documented future step, not premature now |

### Assumptions I made rather than blocking on

These were ambiguous in the brief. I chose the safer/more conventional reading,
recorded it here, and each is cheap to reverse:

1. **Access code = enrolment token, not a login credential.** The brief said
   "password *if required by the authentication architecture*", which delegates
   the choice. A 5-character code is far too weak to be a standing password for
   children's data.
2. **Age-group bucket 1 is a catch-all below 7 months**, so a newborn under 2
   months is still classifiable. The brief's ranges leave a gap at 0–2 months.
3. **Sleep is one event with a start and an optional end**, not two rows — this
   is what the brief's own parent-view mock shows ("😴 Sommeil · Durée: 1h15").
4. **A parent may message the nursery** (the brief says "if allowed"); this is a
   per-nursery setting, defaulting to enabled.
5. **Attendance is a placeholder** on the staff dashboard, as the brief states;
   no check-in/out model is built in this phase.

---

## 12. Documents

| Document | Contents |
| --- | --- |
| [database.md](./database.md) | Entities, fields, relations, indexes, constraints, ERD |
| [api.md](./api.md) | REST surface, error envelope, pagination, filtering |
| [authentication.md](./authentication.md) | Tokens, roles, access codes, ownership enforcement |
| [timeline.md](./timeline.md) | The timeline architectural decision and extension model |
| [implementation-plan.md](./implementation-plan.md) | Phased roadmap with exit criteria |
