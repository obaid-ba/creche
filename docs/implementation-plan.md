# Implementation Plan

> Status: **Active** · Last updated: 2026-09-04
> Each phase has explicit **exit criteria**. A phase is not "done" until they pass.

---

## Progress

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Architecture & documentation | ✅ Complete |
| 1 | Foundation: Docker, Postgres, Django, React, Tailwind | ✅ Complete |
| 2 | Authentication & RBAC | ⏳ Next |
| 3 | Children, guardianship, age groups | ☐ |
| 4 | Care events & daily record | ☐ |
| 5 | Timeline (parent + staff UI) | ☐ |
| 6 | Activities | ☐ |
| 7 | Messaging | ☐ |
| 8 | Complaints | ☐ |
| 9 | Notifications | ☐ |
| 10 | Public website | ☐ |
| 11 | Polish, a11y, performance, security pass | ☐ |

---

## Phase 0 — Architecture ✅

Delivered: `architecture.md`, `database.md`, `api.md`, `authentication.md`,
`timeline.md`, this plan, `.env.example`.

Key decisions: timeline as a unified event log with typed references; daily
record as a computed read model; access code as an enrolment token; memory +
httpOnly-cookie token split; queryset-scoped ownership.

---

## Phase 1 — Foundation ✅

- `docker-compose.yml`: `db` (Postgres 16), `backend`, `frontend`, named volumes
  for deps (NTFS mitigation, architecture.md §9.2)
- Django 5 project with split settings (`base` / `dev` / `prod`), env via
  `django-environ`
- DRF, CORS, Argon2, `simplejwt`, custom exception handler (the api.md §3
  envelope), health endpoint
- `common/`: base model (UUID + timestamps), soft-delete manager, pagination
  classes, permission classes
- Vite + React 19 + **TS strict** + Tailwind v4, path aliases, ESLint/Prettier
- Axios instance, TanStack Query client, router shell, base layouts
- pytest-django + Vitest/RTL wired with one passing test each

**Exit criteria — all verified**
1. ✅ Postgres 16 runs under Compose; backend and frontend verified running.
2. ✅ `GET /api/health/` returns `{"status":"ok","database":"ok"}` through the
   Vite proxy on :5173.
3. ✅ Migrations apply to a clean database.
4. ✅ 70 backend tests, 22 frontend tests, all passing.
5. ✅ `tsc --noEmit` clean under `strict` for both TS projects;
   `manage.py check --deploy` clean under production settings.

---

## Phase 2 — Authentication & RBAC

- `User` (email login, `role`), `ParentProfile`, `StaffProfile`
- `Guardianship`, `ChildAccessCode` (HMAC lookup, single-use, expiring)
- Login / refresh / logout / me; refresh-cookie handling + rotation + blacklist
- Parent claim + link-child flows, throttled
- Permission classes; `Child.objects.visible_to()`
- `AuditLog` + hooks on auth and code lifecycle
- Frontend: auth context, memory token store, refresh interceptor, route
  guards, both login pages, claim page

**Exit criteria**
1. All of `authentication.md` §8 passes.
2. No token is written to `localStorage` (asserted by test).
3. A reused refresh token is rejected.
4. Throttles return 429.

---

## Phase 3 — Children & age groups

- `Child` model + constraints; soft archive/restore
- Age + age-group computation (`common/age.py`), **date-range** group filtering
- CRUD API, search (trigram), filters, ordering, pagination
- Guardian management, access-code generation UI (copy-once modal)
- Staff children list grouped by age band; child profile page; create/edit forms

**Exit criteria**
1. Age-group boundary tests pass: exact birthday, ±1 day, 29 Feb, month-end.
2. Group filtering uses the `date_of_birth` index (verified via `EXPLAIN`).
3. Archive hides from default queries; restore is admin-only.
4. A parent sees only their own children.

---

## Phase 4 — Care events & daily record

- `TimelineEvent` with constraints + indexes; `local_date` set on save
- Per-type payload schema registry (`care/event_types.py`)
- `DailyRecord` (notes + publish status only)
- Daily summary **aggregation service** (computed, never stored)
- Quick-entry staff UI: bottle, meal, sleep start/stop, diaper, temperature, mood
- Parent "Situation de l'enfant" screen

**Exit criteria**
1. Invalid payload for a type → 400.
2. `ended_at < occurred_at` rejected by the database.
3. Summary matches the underlying events exactly.
4. Parents cannot see a `DRAFT` day.

---

## Phase 5 — Timeline

- Timeline list + create + patch + `end` endpoints; date/type filtering
- Bulk reference resolution (activity, message)
- `Timeline` / `TimelineItem` design-system components
- Parent view: date selector, filter chips, vertical feed (desktop) / compact
  cards (mobile)
- Staff view: same feed + inline quick-add

**Exit criteria**
1. Events ordered by `occurred_at`, not `created_at`.
2. **Query count is constant** regardless of event count
   (`django_assert_num_queries`).
3. Date and type filters correct; ownership enforced.
4. Open sleep intervals render as "en cours" and close correctly.
5. Responsive at 360 / 768 / 1280 px.

---

## Phase 6 — Activities
Model, participants, photo upload (validate + thumbnail + strip EXIF),
transactional creation of `ACTIVITY` timeline references, staff CRUD UI, parent
activities list.

**Exit:** adding participants creates exactly one timeline event per child;
rollback on failure; parents see only activities their child joined.

---

## Phase 7 — Messaging
Conversations scoped to a child, messages, attachments, read receipts, unread
counts, optional `MESSAGE` timeline reference, both UIs.

**Exit:** non-participants get 404; `can_send_messages=false` blocks parent
posts; unread counts correct; attachment type/size enforced.

---

## Phase 8 — Complaints
Model, parent create, staff status transitions (409 on illegal), replies with
`is_internal` hidden from parents, filters, both UIs.

**Exit:** state machine enforced; internal replies never serialised to a parent.

---

## Phase 9 — Notifications
Model, fan-out on key events (new message, published day, complaint update),
unread badge, list UI, mark-read.

**Exit:** notifications reach only entitled users.

---

## Phase 10 — Public website
Home (hero, presentation, values, services, activities, gallery, videos,
testimonials placeholder, contact, location, document CTA, portal CTA),
`/about`, `/gallery`, `/documents`, `/contact`, throttled contact form.

**Exit:** responsive, accessible, Lighthouse ≥ 90 on performance and a11y.

---

## Phase 11 — Polish
Loading / empty / error states everywhere, French error translation table,
keyboard navigation and focus management, ARIA on interactive components,
contrast check, image lazy-loading, route code-splitting, N+1 sweep,
security review (headers, CORS, throttles, upload paths), seed data for demo.

**Exit:** full test suite green; `tsc --noEmit` clean; no console errors;
security checklist signed off.

---

## Working rules

- One phase at a time; exit criteria before moving on.
- Tests land with the feature, not afterwards.
- No business logic in React components — hooks and services only.
- No `any` in TypeScript.
- Every multi-table write in a transaction.
- Docs updated when a decision changes.
