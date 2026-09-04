# Authentication & Authorisation

> Status: **Design baseline** · Last updated: 2026-09-04
>
> This application stores identifying information about **children**. The
> threat model is treated accordingly: the worst realistic outcome is one
> family reading another family's child records, so ownership enforcement gets
> more attention here than anything else.

---

## 1. Identity model

One `User` table, `email` as the login identifier, plus a `role` and a
role-specific profile:

```
User (email, password, role ∈ {PARENT, STAFF, ADMIN})
  ├── ParentProfile  (1:1)  ──< Guardianship >──  Child
  └── StaffProfile   (1:1)
```

**Why one user table rather than separate parent/staff auth:**
a single authentication path means one place to audit, one password policy, one
lockout mechanism, and no chance of a bug in a second login flow. The two login
*screens* (`/parent/login`, `/staff/login`) post to the same endpoint; the
response's `role` decides where the SPA redirects. A staff member who logs in
via the parent form still lands correctly.

> `User.is_staff` (Django admin) and `User.role == 'STAFF'` (application) are
> **different things** and are never used interchangeably. Application
> permission checks read `role` only.

**Password hashing:** Argon2id (`ARGON2_PASSWORD_HASHER` first in
`PASSWORD_HASHERS`), with Django's validators plus a 10-character minimum.

---

## 2. Token strategy

`djangorestframework-simplejwt`, with a deliberate split:

| Token | Lifetime | Stored | Sent as |
| --- | --- | --- | --- |
| Access | 15 min | **JS memory only** (never persisted) | `Authorization: Bearer …` |
| Refresh | 7 days, rotating | **httpOnly, Secure, SameSite=Strict cookie** | Cookie, automatically |

### Why not `localStorage`

The common SPA pattern of putting a JWT in `localStorage` makes any XSS a full
account takeover, and here that means a stranger reading a child's daily record,
photos and home address. `localStorage` is readable by any script on the origin.
An httpOnly cookie is not readable by script at all.

The cost of this choice is that the access token is lost on page refresh. That
is handled by a silent refresh on app boot: the SPA calls
`POST /api/auth/refresh/`, the browser attaches the cookie automatically, and a
fresh access token is returned. The user never notices.

### CSRF

The refresh cookie is sent automatically by the browser, which is exactly the
condition CSRF exploits. Three layers:

1. `SameSite=Strict` — the cookie is not attached to cross-site requests at all.
2. The refresh endpoint accepts **POST only** and requires a matching
   double-submit CSRF token (`X-CSRFToken` header vs a readable `csrftoken`
   cookie).
3. Refresh tokens **rotate** on every use, and the previous one is blacklisted.
   A stolen refresh token is single-use, and reuse of a rotated token
   invalidates the whole family — which surfaces theft rather than hiding it.

Access-token requests carry `Authorization`, which is not automatic, so they are
not CSRF-exposed.

### Logout
Blacklists the refresh token server-side and clears the cookie. Because access
tokens are short-lived and memory-only, closing the tab already ends the session
in practice.

---

## 3. Roles (RBAC)

| Capability | Parent | Staff | Admin |
| --- | --- | --- | --- |
| View own children | ✅ | — | — |
| View all children | — | ✅ | ✅ |
| Create / edit child | — | ✅ | ✅ |
| Archive child | — | ✅ | ✅ |
| Restore child | — | — | ✅ |
| Hard-delete child | — | — | ✅ (audited) |
| Record timeline events | — | ✅ | ✅ |
| View own child's timeline | ✅ (published) | ✅ | ✅ |
| Publish a daily record | — | ✅ | ✅ |
| Create activity | — | ✅ | ✅ |
| Send message | ✅ (if allowed) | ✅ | ✅ |
| Create complaint | ✅ | — | — |
| Change complaint status | — | ✅ | ✅ |
| Assign complaint | — | — | ✅ |
| Generate / revoke access code | — | ✅ | ✅ |
| Manage staff accounts | — | — | ✅ |
| Read audit log | — | — | ✅ |

Implemented as DRF permission classes (`IsParent`, `IsStaff`, `IsAdmin`,
`IsStaffOrOwningParent`) composed per viewset — not `if` statements scattered
through view bodies.

---

## 4. The child access code

### 4.1 Decision: it is an enrolment token, not a password

The brief specifies a code like `MAM-7F42K` and says "password *if required by
the authentication architecture*" — delegating the choice. The decision:

> **The access code links a parent to a child exactly once. It is never a
> standing login credential.**

Reasoning:

1. **Entropy.** 5 characters over a 31-symbol alphabet is ~28.6 million
   combinations — about 24.8 bits. That is fine for a single-use, rate-limited,
   expiring code. It is far too weak to protect a child's records indefinitely
   against offline or distributed guessing.
2. **Rotation.** A password can be changed by its owner. A code printed on a
   welcome letter cannot, and it is handled by whoever sees the paper.
3. **Multiple children.** A parent with two children would otherwise need two
   codes to log in — a confusing UX with no security benefit.
4. **Revocation semantics.** The brief requires the code to be revocable and
   regeneratable. That is enrolment-token behaviour; revoking a *password*
   mid-relationship would just lock a family out.

So the flow is: **code → claim once → normal email + password afterwards.**

### 4.2 Generation

```
Format:   MAM-XXXXX
Alphabet: 23456789ABCDEFGHJKMNPQRSTUVWXYZ    (31 symbols)
```

`0/O` and `1/I/L` are excluded — the code is read off paper and typed by a
parent, and ambiguous glyphs cause support calls, not security.

- Generated with `secrets.choice` (CSPRNG), never `random`.
- Regenerated on collision (checked against `code_lookup`).
- Default expiry: **30 days**.

### 4.3 Storage

The plaintext is **never stored**. Only:

```
code_lookup = HMAC-SHA256(settings.ACCESS_CODE_HMAC_KEY, normalise(code))
```

- Keyed HMAC rather than a salted bcrypt hash **because it must stay
  indexable** — the claim endpoint needs an O(1) lookup, and per-row salts
  would force a full-table scan. The HMAC key lives in the environment, not the
  database, so a database leak alone does not let an attacker match codes.
- `normalise()` upper-cases, strips whitespace and hyphens, and maps the
  ambiguous glyphs (`O→0` is *not* needed since `0` is excluded; `l→1` etc. are
  rejected outright) so `mam-7f42k` and `MAM 7F42K` both work.
- `code_hint` (`MAM-7F…`) is stored for the staff UI so they can tell two codes
  apart without the system knowing either in full.
- Plaintext appears exactly once, in the HTTP response to the staff member who
  generated it. The frontend shows it in a copy-once modal and warns that it
  will not be shown again.

### 4.4 Claim flow

```
Staff creates child
   └─> generates code MAM-7F42K  ──(paper / in person)──> Parent

Parent visits /parent/login → « Première connexion »
   └─> POST /api/auth/parent/claim/
         { access_code, email, password, first_name, last_name, relationship }
```

Server-side, in one transaction:

1. Throttle: **5 attempts per hour per IP**, and a per-code counter.
2. Look up `code_lookup`; reject if missing, expired, claimed or revoked.
   All four failures return the **same** generic error and take the same time
   (constant-time compare) — otherwise the endpoint becomes an oracle for
   "which codes exist".
3. Create the `User` (`role=PARENT`) and `ParentProfile`, or attach to the
   existing parent if the email is already registered **and** the password
   authenticates.
4. Create the `Guardianship` row.
5. Mark the code `claimed_at` / `claimed_by`.
6. Write an `AuditLog` entry.

Failure at any step rolls back all of it — there is no path to a half-created
parent holding a consumed code.

An existing parent adding a second child uses
`POST /api/auth/parent/link-child/` while authenticated, which skips steps 3.

---

## 5. Ownership enforcement — the core control

> **The rule: a child id from the client is never used to decide access. It is
> only ever used to look *within* a queryset the server already restricted.**

One manager method is the single source of truth:

```python
class ChildQuerySet(models.QuerySet):
    def visible_to(self, user):
        if user.role in (Role.STAFF, Role.ADMIN):
            return self
        if user.role == Role.PARENT:
            return self.filter(
                guardianships__parent=user.parent_profile,
                guardianships__revoked_at__isnull=True,
            )
        return self.none()
```

Every child-scoped view resolves through it:

```python
class ChildScopedMixin:
    def get_child(self):
        return get_object_or_404(
            Child.objects.visible_to(self.request.user),
            pk=self.kwargs["child_id"],
        )
```

Consequences:

- A parent passing another family's `child_id` gets **404** — the row is not in
  their queryset, so it does not exist for them. No information is leaked about
  whether that child is real (api.md §1).
- The check cannot be forgotten per-endpoint, because there is no other way to
  obtain the child object.
- Nested resources (timeline, daily record, activities, conversations,
  complaints) are all reached *through* the child, so they inherit the same
  control rather than each reimplementing it.
- Revoking a guardianship (`revoked_at`) removes access immediately, without
  deleting the historical link.

**The frontend performs no authorisation.** Route guards exist purely so users
don't see broken screens; they are a UX affordance and are treated as
untrusted.

---

## 6. Other controls

| Control | Implementation |
| --- | --- |
| Rate limiting | DRF throttles: login 10/h/IP, claim 5/h/IP, contact 5/h/IP, authenticated 1000/h |
| Brute-force lockout | Progressive delay + temporary lock after 10 failed logins per account |
| CORS | Explicit origin allowlist from env; `credentials: true`; never `*` |
| Security headers | HSTS, `X-Content-Type-Options`, `Referrer-Policy: same-origin`, CSP |
| Cookies | `Secure` + `httpOnly` + `SameSite=Strict` in production |
| Uploads | MIME sniffing (not extension), size cap, image re-encode to **strip EXIF GPS** |
| Media access | Non-enumerable UUID paths served through a permission-checked view |
| Input validation | DRF serializers server-side; Zod client-side is UX only |
| Secrets | Environment only; `.env` git-ignored; `.env.example` documents every key |
| Audit | Append-only `AuditLog` for logins, code lifecycle, child changes, guardianship changes, complaint transitions |

---

## 7. Frontend handling

- Access token in a module-scoped variable inside `services/auth.ts` — never
  in `localStorage`, `sessionStorage` or a cookie readable by JS.
- One Axios response interceptor catches 401, calls `/auth/refresh/` **once**,
  queues concurrent failures, replays them, and hard-logs-out if refresh fails.
- `useAuth()` exposes `user`, `role`, `isLoading`; guards (`RequireAuth`,
  `RequireRole`) render a redirect, never a permission decision.
- On logout the query cache is cleared, so no child data survives in memory for
  the next user of a shared nursery computer.

---

## 8. Tests that must pass (brief §27)

1. Parent logs in; staff logs in; wrong password fails; inactive user fails.
2. **Parent A requesting Parent B's child returns 404** — asserted for child,
   timeline, daily record, activity, conversation and complaint endpoints.
3. A revoked guardianship immediately removes access.
4. Staff can read any child; only admin can restore or hard-delete.
5. Claiming a code twice fails; an expired code fails; a revoked code fails;
   all with an identical error body.
6. Regenerating a code revokes the previous one.
7. `child_id` / `role` in a request body are ignored, not honoured.
8. Refresh rotation: a reused refresh token is rejected.
9. Login throttling returns 429 after the limit.
