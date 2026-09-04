# Daily Timeline — Architectural Decision

> Status: **Decided** · Last updated: 2026-09-04
> Relates to brief §10, §11, §25.

---

## 1. The question

The brief asks us to choose between:

- **(A)** `TimelineEvent` is the source of truth.
- **(B)** `DailyRecord` / `Activity` / etc. are the source of truth and
  `TimelineEvent` is a projection (read model).

And it constrains the answer with two rules:

> "The timeline must be generated from real events/records."
> "Do NOT manually duplicate the same information into another table unless
> there is a strong architectural reason."

---

## 2. Why the naive readings of both options fail

### Why plain (B) fails: `DailyRecord` cannot hold the data

Option B assumes a `DailyRecord` row per child per day, with columns like
`meals_count`, `sleep_start`, `sleep_end`, `temperature`, `mood`. That model
breaks on contact with a real nursery day:

- A baby has **several** naps, **several** bottles, **several** diaper changes
  and possibly **several** temperature readings per day.
- The timeline must show each of them **at its own time**.

A one-row-per-day table can only represent *one* of each. Making it work would
need either repeated columns (`nap1_start`, `nap2_start`, …) or arrays — both
of which are the wide-table anti-pattern, and neither can be queried,
ordered or filtered sensibly. **The care data is intrinsically a list of
timestamped events, not a daily form.**

So if `DailyRecord` were the source of truth, we would have to *invent* an
event table anyway to feed the timeline — and then keep two copies in sync.
That is precisely the duplication the brief forbids.

### Why plain (A) fails: activities and messages already exist elsewhere

Option A says everything becomes a `TimelineEvent`. But `Activity` and
`Message` are independent aggregates with their own lifecycles:

- An `Activity` has a title, a time range, photos and **many participating
  children**. It is edited as one object; a title fix must not require touching
  20 timeline rows.
- A `Message` belongs to a `Conversation`, has read receipts and attachments.

Copying their text into `TimelineEvent` would duplicate content **and** create
a staleness bug: edit the activity, and the timeline still shows the old title.

---

## 3. The decision

> **`TimelineEvent` is a single unified event log. It is the *source of truth*
> for care events, and a thin *typed reference* for events that belong to
> another aggregate. `DailyRecord` is a computed read model, not a table of
> care data.**

Three kinds of row, one table:

| Kind | Types | Ownership | Payload |
| --- | --- | --- | --- |
| **Owned** | `MEAL` `BOTTLE` `SLEEP` `DIAPER` `TOILET` `TEMPERATURE` `MOOD` `NOTE` | `TimelineEvent` **is** the record | `data` JSONB, validated per type |
| **Reference** | `ACTIVITY` `MESSAGE` | The other aggregate owns the content | FK only; display content resolved on read |
| **Future** | `MEDICATION` `INCIDENT` `PHOTO` `MILESTONE` `DROP_OFF` `PICK_UP` | either, per type | decided per type |

This is a hybrid, and the hybrid is the point:

- **No duplication.** Care events are stored exactly once (here). Activity and
  message content is stored exactly once (in their own tables) and *pointed at*.
- **One chronological query.** The timeline is a single indexed scan of one
  table, not a merge of six sources sorted in Python.
- **No staleness.** Editing an activity's title changes what the timeline shows,
  because the timeline never had its own copy.

### 3.1 So what is `DailyRecord`?

`DailyRecord` survives, but with a much smaller and honest job. It holds only
**day-scoped facts that are not derivable from any event**:

- `general_notes` — the staff's free-text summary of the day
- `status` — `DRAFT` / `PUBLISHED` (controls parent visibility of the day)
- `created_by`, timestamps

Everything the brief lists under "child daily monitoring" — meal counts, sleep
durations, temperature, mood, hygiene — is **computed on read** by aggregating
that day's events. It is not stored, so it can never disagree with the timeline.

```
GET /api/children/:id/daily-record/?date=2026-09-04

{
  "date": "2026-09-04",
  "status": "PUBLISHED",
  "general_notes": "Très bonne journée.",
  "summary": {                     ← computed from events, never stored
    "feeding": { "meals": 2, "bottles": 3, "total_ml": 480 },
    "sleep":   { "naps": 2, "total_minutes": 145 },
    "health":  { "last_temperature": 36.6, "measured_at": "14:30" },
    "hygiene": { "diaper_changes": 4, "toilet_visits": 0 },
    "mood":    { "latest": "HAPPY", "observations": 2 }
  }
}
```

This directly satisfies the brief's rule: the daily situation and the timeline
are **two read shapes over one set of rows**.

---

## 4. Model

```python
class TimelineEvent(models.Model):
    id           = UUIDField(primary_key=True)
    child        = FK(Child, related_name="timeline_events", on_delete=CASCADE)
    type         = CharField(choices=TimelineEventType)   # extension point
    occurred_at  = DateTimeField()          # when it happened (not created_at)
    ended_at     = DateTimeField(null=True) # intervals only (sleep, activity)
    local_date   = DateField()              # denormalised for day queries (§6)

    title        = CharField(blank=True)    # overrides the type's default label
    description  = TextField(blank=True)
    data         = JSONField(default=dict)  # type-specific, schema-validated

    activity     = FK(Activity, null=True, blank=True, on_delete=CASCADE)
    message      = FK(Message,  null=True, blank=True, on_delete=CASCADE)

    created_by   = FK(User, null=True, on_delete=SET_NULL)
    created_at   = DateTimeField(auto_now_add=True)
    updated_at   = DateTimeField(auto_now=True)
```

### 4.1 `occurred_at` vs `created_at`
These are deliberately different. Staff often record a 10:30 nap at 11:15. The
timeline orders by **`occurred_at`** (when it happened); `created_at` exists for
audit only. Conflating them would show the day in the wrong order.

### 4.2 Sleep is one row, not two
The brief lists `SLEEP_START` and `SLEEP_END` as separate types, but its own
parent-view mock shows a **single entry** with a duration:

```
10:30  😴 Sommeil   Durée: 1h15
```

So sleep is stored as **one `SLEEP` event** with `occurred_at` = start and
`ended_at` = end. Duration is computed, never stored.

Staff still get the natural two-tap workflow: "Début sieste" creates the row
with `ended_at = NULL` (an *open* interval, rendered as "en cours"), and "Fin
sieste" closes it. One row, two interactions, no reconciliation logic, and no
possibility of an orphaned `SLEEP_END` with no matching start.

`ended_at` is generic rather than sleep-specific, so `ACTIVITY` and any future
interval type (e.g. `MEDICATION` courses) reuse it.

### 4.3 Typed payloads
`data` is JSONB, validated against a **per-type schema registry** — permissive
storage, strict validation:

| Type | `data` schema |
| --- | --- |
| `BOTTLE` | `{ volume_ml: int 0..500, formula?: str }` |
| `MEAL` | `{ meal: BREAKFAST\|LUNCH\|SNACK\|DINNER, eaten: ALL\|MOST\|SOME\|NONE, menu?: str }` |
| `SLEEP` | `{ quality?: GOOD\|RESTLESS\|POOR }` |
| `TEMPERATURE` | `{ celsius: dec 30..45, method?: str }` |
| `MOOD` | `{ mood: HAPPY\|CALM\|TIRED\|SAD\|IRRITATED\|ACTIVE\|OTHER, note?: str }` |
| `DIAPER` | `{ state: WET\|SOILED\|BOTH\|DRY, cream?: bool }` |
| `TOILET` | `{ success: bool }` |
| `NOTE` | `{}` (uses `description`) |

An unknown key or an out-of-range value is a 400. The registry lives in
`apps/care/event_types.py` and is the single place a new type is declared.

---

## 5. Why this stays easy to extend

Adding `MEDICATION` (a future type named in the brief) is:

1. Add `MEDICATION` to the `TimelineEventType` choices.
2. Add its payload schema to the registry.
3. Add an icon + French label to the frontend's event-type map.

**No migration of existing rows. No new table. No change to the timeline query,
the permission layer, the filters or the UI shell.** That is the test the brief
set ("adding a new event type should not require rewriting the entire
architecture"), and this design passes it.

Adding a type that *belongs to another aggregate* (e.g. `INCIDENT` with its own
report table) means adding one nullable FK and one entry in the reference
resolver — still additive.

---

## 6. Query design (no N+1)

The one hot query:

```sql
SELECT * FROM care_timelineevent
WHERE child_id = %s AND local_date = %s
ORDER BY occurred_at ASC;
```

served by:

```
INDEX (child_id, local_date, occurred_at)
INDEX (child_id, occurred_at DESC)     -- "latest events" on dashboards
```

**Why `local_date` is denormalised.** "Today" is a *nursery-local* day, but
`occurred_at` is stored in UTC. Filtering with
`WHERE occurred_at::date AT TIME ZONE ...` is not sargable and would force a
sequential scan. Storing the resolved local date (computed once, on save) keeps
the day filter a plain indexed equality. This is denormalisation of a
*derivation of a stored column*, not duplication of content — the distinction
that matters for the brief's rule.

**Reference rows are resolved in bulk**, never per row:

```python
qs = (TimelineEvent.objects
      .filter(child=child, local_date=day)
      .select_related("created_by", "activity")
      .prefetch_related("activity__photos", "message__attachments")
      .order_by("occurred_at"))
```

A regression test asserts the endpoint's query count is **constant** regardless
of how many events the day contains (`django_assert_num_queries`).

---

## 7. Filters (brief §11)

Parent-facing filter chips map to type groups, defined once and shared:

| Chip (FR) | Types |
| --- | --- |
| Tout | all |
| Repas | `MEAL`, `BOTTLE` |
| Sommeil | `SLEEP` |
| Activités | `ACTIVITY` |
| Santé | `TEMPERATURE`, `MOOD` |
| Hygiène | `DIAPER`, `TOILET` |

The grouping lives in `apps/care/event_types.py` and is exposed to the frontend
via a constants endpoint, so the two never drift apart.

---

## 8. Visibility rule

Care events are visible to a parent only when the day's `DailyRecord.status` is
`PUBLISHED`, **or** the event is explicitly `is_published`. This lets staff
record throughout the day without parents seeing a half-written day, which is
the real operational need. Staff always see everything.

---

## 9. Consequences

**Accepted trade-offs:**

- One large table. Mitigated by indexes; monthly partitioning is a documented
  future step, deliberately not done now.
- JSONB payloads are not constrained by the database. Mitigated by strict
  serializer validation and a check constraint on `type`.
- Reference rows mean the timeline endpoint touches 2–3 tables. Bounded and
  measured by the query-count test.

**Rejected alternatives:**

- *Separate table per event type, merged at read time* — a 8-way `UNION ALL`
  that must be re-sorted and re-paginated; every new type changes the query.
- *`TimelineEvent` as a full copy of everything* — duplication and staleness,
  explicitly forbidden by the brief.
- *Materialised view* — adds refresh lag and operational burden for a query
  that is already a single indexed scan.
