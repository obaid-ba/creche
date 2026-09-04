# API Design

> Base path `/api/` · JSON only · Status: **Design baseline** · 2026-09-04
> Route segments and field names are English; only human-readable message
> strings are French.

---

## 1. Conventions

- `snake_case` JSON fields (matches DRF and the DB; avoids a translation layer).
- ISO-8601 UTC timestamps (`2026-09-04T08:15:00Z`); `date` fields are `YYYY-MM-DD`.
- UUIDs for all resource ids — sequential integers would leak how many children
  the nursery has and make enumeration attacks trivial.
- Trailing slashes (Django convention).
- `PATCH` for partial updates; `PUT` is not exposed.

### Status codes

| Code | Meaning |
| --- | --- |
| 200 / 201 / 204 | Success |
| 400 | Validation error |
| 401 | Missing or expired access token |
| 403 | Authenticated but not permitted |
| **404** | Not found **or not owned** — see below |
| 409 | Conflict (duplicate, illegal state transition) |
| 413 | Upload too large |
| 429 | Rate limited |

> **404 rather than 403 for unowned resources.** If a parent requesting another
> family's child got a 403, that would confirm the child exists. Every
> child-scoped lookup resolves through the caller's own scoped queryset, so an
> unowned id is genuinely *not found* for that user. This prevents id
> enumeration and is applied consistently.

---

## 2. Pagination

**Cursor** pagination for append-heavy, time-ordered lists (timeline, messages,
notifications) — stable under concurrent inserts:

```json
{ "results": [], "next": "cD0yMDI2...", "previous": null }
```

**Page-number** pagination for admin tables where a total is genuinely useful:

```json
{ "count": 128, "page": 1, "page_size": 20, "total_pages": 7, "results": [] }
```

`?page_size=` is capped at 100.

---

## 3. Error envelope

One shape for every error, so the frontend has exactly one translator.

```json
{
  "error": {
    "code": "validation_error",
    "message": "Les données envoyées sont invalides.",
    "details": {
      "date_of_birth": ["La date de naissance ne peut pas être dans le futur."]
    },
    "request_id": "b3f1c2a4-..."
  }
}
```

Codes: `validation_error`, `authentication_failed`, `token_expired`,
`permission_denied`, `not_found`, `conflict`, `rate_limited`, `payload_too_large`,
`unsupported_media_type`, `server_error`.

`request_id` is logged server-side, so a parent can report a problem and staff
can find the exact trace without exposing a stack trace.

---

## 4. Authentication

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login/` | — | Email + password → access token (body) + refresh (httpOnly cookie) |
| POST | `/api/auth/refresh/` | cookie | New access token |
| POST | `/api/auth/logout/` | yes | Blacklist refresh, clear cookie |
| GET | `/api/auth/me/` | yes | Current user, role, profile, children summary |
| PATCH | `/api/auth/me/` | yes | Update own profile |
| POST | `/api/auth/password/change/` | yes | Change own password |
| POST | `/api/auth/parent/claim/` | — | **Activate account with a child access code** |
| POST | `/api/auth/parent/link-child/` | parent | Link an additional child with a code |

`POST /api/auth/login/` →
```json
{ "access": "eyJ…", "expires_in": 900,
  "user": { "id": "…", "email": "…", "first_name": "Sarah",
            "role": "PARENT", "children": [{ "id": "…", "first_name": "Mohamed" }] } }
```

`POST /api/auth/parent/claim/` →
```json
{ "access_code": "MAM-7F42K", "email": "sarah@example.com",
  "password": "…", "first_name": "Sarah", "last_name": "Benali",
  "relationship": "MOTHER" }
```

Rate limits: login `10/hour/IP`, claim `5/hour/IP`, password change `5/hour/user`.

---

## 5. Children

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/api/children/` | staff, admin | List, filter, search, paginate |
| POST | `/api/children/` | staff, admin | Create |
| GET | `/api/children/{id}/` | staff, admin, **owning parent** | |
| PATCH | `/api/children/{id}/` | staff, admin | |
| POST | `/api/children/{id}/archive/` | staff, admin | Soft delete |
| POST | `/api/children/{id}/restore/` | admin | |
| DELETE | `/api/children/{id}/` | admin | Hard delete, guarded, audited |
| GET | `/api/children/{id}/guardians/` | staff, admin | |
| POST | `/api/children/{id}/guardians/` | staff, admin | Link a parent |
| DELETE | `/api/children/{id}/guardians/{gid}/` | staff, admin | Soft revoke |
| POST | `/api/children/{id}/access-code/` | staff, admin | Generate/regenerate — **returns plaintext once** |
| DELETE | `/api/children/{id}/access-code/` | staff, admin | Revoke |
| GET | `/api/children/groups/` | any auth | Group keys + French labels + counts |

Query params on the list:
`?search=` (name, trigram) · `?age_group=INFANT|BABY|TODDLER|PRESCHOOL` ·
`?status=ACTIVE|ARCHIVED` · `?ordering=last_name|-created_at|date_of_birth` ·
`?page=` · `?page_size=`

Child representation (computed fields marked ⚙, never stored):

```json
{
  "id": "…", "first_name": "Mohamed", "last_name": "Benali",
  "date_of_birth": "2024-03-15",
  "age_months": 29,                                    // ⚙
  "age_display": "2 ans et 5 mois",                    // ⚙ French
  "age_group": { "key": "PRESCHOOL", "label": "2 ans et +" },  // ⚙
  "gender": "M", "photo_url": "…", "status": "ACTIVE",
  "allergies": "Arachides",        // staff-only
  "guardians": [ … ]
}
```

---

## 6. Timeline

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/api/children/{id}/timeline/` | staff, admin, owning parent |
| POST | `/api/children/{id}/timeline/` | staff, admin |
| PATCH | `/api/timeline-events/{id}/` | staff, admin |
| DELETE | `/api/timeline-events/{id}/` | staff, admin |
| POST | `/api/timeline-events/{id}/end/` | staff, admin — close an open interval (sleep) |
| GET | `/api/timeline/event-types/` | any auth — types, French labels, icons, filter groups |

Params: `?date=2026-09-04` (default today) · `?from=&to=` ·
`?types=MEAL,BOTTLE` · `?filter=meals|sleep|activities|health|hygiene`

```json
{
  "date": "2026-09-04",
  "child": { "id": "…", "first_name": "Mohamed" },
  "results": [
    { "id": "…", "type": "BOTTLE", "occurred_at": "2026-09-04T08:15:00Z",
      "ended_at": null, "title": "Petit déjeuner", "description": "Biberon 180ml",
      "icon": "milk", "label": "Biberon", "data": { "volume_ml": 180 },
      "created_by": { "id": "…", "first_name": "Amina" } },

    { "id": "…", "type": "SLEEP", "occurred_at": "2026-09-04T10:30:00Z",
      "ended_at": "2026-09-04T11:45:00Z",
      "duration_minutes": 75,            // ⚙ computed, never stored
      "label": "Sommeil", "icon": "moon" },

    { "id": "…", "type": "ACTIVITY", "occurred_at": "2026-09-04T09:00:00Z",
      "label": "Activité", "icon": "palette",
      "activity": { "id": "…", "title": "Peinture",     // resolved by reference
                    "photos": [ { "thumbnail_url": "…" } ] } }
  ]
}
```

`POST` body — the server sets `child` from the URL and `created_by` from the
token; both are ignored if sent by the client:

```json
{ "type": "BOTTLE", "occurred_at": "2026-09-04T08:15:00Z",
  "description": "Biberon 180ml", "data": { "volume_ml": 180 } }
```

`data` is validated against the payload schema for `type` (timeline.md §4.3);
unknown keys are a 400.

---

## 7. Daily record

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/api/children/{id}/daily-record/?date=` | staff, admin, owning parent |
| PUT | `/api/children/{id}/daily-record/?date=` | staff, admin — upsert notes/status |
| POST | `/api/children/{id}/daily-record/publish/` | staff, admin |
| GET | `/api/children/{id}/daily-record/history/` | staff, admin, owning parent |

The `summary` block is **aggregated from timeline events on read** and is
read-only (timeline.md §3.1).

---

## 8. Activities

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/api/activities/` | staff, admin (all) · parent (own child's only) |
| POST | `/api/activities/` | staff, admin |
| GET/PATCH/DELETE | `/api/activities/{id}/` | staff, admin |
| POST | `/api/activities/{id}/participants/` | staff, admin — bulk add children |
| DELETE | `/api/activities/{id}/participants/{childId}/` | staff, admin |
| POST | `/api/activities/{id}/photos/` | staff, admin — multipart |
| DELETE | `/api/activities/{id}/photos/{photoId}/` | staff, admin |

Adding participants creates the corresponding `ACTIVITY` timeline reference
events **in one transaction**, so an activity and its timeline entries can never
be half-created.

Params: `?date=` · `?from=&to=` · `?child=` (staff only) · `?category=`

---

## 9. Messaging

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/api/conversations/` | staff, admin · parent (own) |
| POST | `/api/conversations/` | staff, admin, parent — scoped to a child |
| GET | `/api/conversations/{id}/` | participants |
| GET | `/api/conversations/{id}/messages/` | participants — cursor paginated |
| POST | `/api/conversations/{id}/messages/` | participants |
| POST | `/api/conversations/{id}/read/` | participants — mark all read |
| GET | `/api/messages/unread-count/` | any auth |

Attachments are multipart; images only (`image/jpeg|png|webp`), ≤ 10 MB,
validated by **content sniffing, not the filename extension**.

A parent may post only if `ParentProfile.can_send_messages` is true (403
otherwise). Participation is derived from guardianship — never from the request.

---

## 10. Complaints

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/api/complaints/` | staff, admin (all) · parent (own) |
| POST | `/api/complaints/` | parent |
| GET | `/api/complaints/{id}/` | owner parent, staff, admin |
| PATCH | `/api/complaints/{id}/status/` | staff, admin |
| POST | `/api/complaints/{id}/replies/` | owner parent, staff, admin |
| POST | `/api/complaints/{id}/assign/` | admin |

Params: `?status=` · `?child=` · `?ordering=`

Illegal status transitions return **409**, not 400 — the payload is valid, the
state machine forbids it.

---

## 11. Notifications, dashboards, public

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/notifications/` | `?unread=true` |
| POST | `/api/notifications/{id}/read/` | |
| POST | `/api/notifications/read-all/` | |
| GET | `/api/dashboard/parent/` | Child, today's summary, latest events, unread counts |
| GET | `/api/dashboard/staff/` | Totals, counts per age group, new complaints, unread, recent activities |
| POST | `/api/public/contact/` | Public contact form — throttled `5/hour/IP` |
| GET | `/api/public/gallery/` | Public, published media only |
| GET | `/api/public/documents/` | Registration documents |

Both dashboard endpoints are **single aggregated calls**, not six round-trips
from the client.

---

## 12. Cross-cutting rules

1. `child_id`, `parent_id` and `role` from a request body are **always ignored**;
   they are derived from the authenticated user.
2. Every child-scoped route resolves the child through
   `Child.objects.visible_to(request.user)`.
3. All writes that touch more than one table run in `transaction.atomic()`.
4. Uploads: extension + MIME sniff + size cap + image re-encode to strip EXIF
   (which can carry GPS coordinates of a child's home).
5. Sensitive operations write an `AuditLog` row in the same transaction.
