# Collentra — Architecture

## 1. System overview

```
React Native + Expo (student app, Android-first)
Admin web dashboard (React + Vite, separate app)
              |
              v
          Supabase project
   ┌──────────┼───────────────┬────────────┐
   |          |               |            |
  Auth    Postgres+RLS     Storage     Realtime
(Google + (all tables,    (avatars)   (chat, live
 KIIT      views,                      notifications)
 email)    functions)
```

Both client apps talk directly to Supabase (no custom backend server). All
business rules that must not be trusted to the client — KIIT-domain
enforcement, matching score calculation, private-field visibility,
admin authorization — live in **Postgres** as RLS policies, triggers, and
`SECURITY DEFINER` functions, not in app code. This is required because
there is no server tier to act as a trust boundary; Postgres is it.

## 2. Why schema-first

Every later phase (matching, discovery, chat, admin) reads and writes the
same handful of tables. Building UI before the schema is final means
re-shaping forms every time a join changes. So: full schema + RLS +
matching functions now, reviewed and migrated once, then UI phases build
against a fixed contract.

## 3. Identity & privacy model

Two tables per student instead of one:

- `profiles` — everything readable by other verified students (name,
  username, branch, year, skills via join, bio, links, availability
  toggle).
- `profile_private` — KIIT email, roll number, phone. Row-level security
  restricts `SELECT` to the owner only (and admins). This is the only way
  to get real column-level privacy in Postgres RLS: split the table.

The "Email" action (spec §39/§82) never exposes `profile_private.kiit_email`
to the client. Instead, a `SECURITY DEFINER` RPC
(`get_contact_email(target_id)`) checks that the caller is allowed to
contact `target_id` (accepted connection, not blocked, both verified) and
returns the email only inside that call, which the client uses to open a
`mailto:` link. The email address is never fetched into a list or a
profile screen.

## 4. KIIT-domain enforcement (not just frontend)

A `BEFORE INSERT` trigger on `auth.users` rejects account creation outright
if the email does not match `%@kiit.ac.in`, for **both** Google OAuth and
password signups (Supabase writes every provider's user into the same
`auth.users` table, so one trigger covers both). See §7 of
`SUPABASE_SETUP.md` for the exact function and the permission it needs.

## 5. Matching engine placement

Matching is implemented as pure SQL functions (`fn_*_score`, see
`MATCHING_ALGORITHM.md`) that run inside Postgres, callable via RPC. This
satisfies §80 of the spec (must not run on-device) at zero cost — no
separate compute service needed. Weights live in the single-row
`matching_settings` table so admins can tune them (§62) without a
deploy, with a `CHECK` constraint enforcing the six weights sum to 100.

## 6. Realtime chat

- `conversations` + `conversation_members` + `messages` in Postgres are
  the permanent store (§43 — Realtime is not the store).
- Supabase Realtime is enabled only on `messages`, filtered per-client to
  the conversations the user is a member of (via RLS on the underlying
  table, which Realtime respects).
- Project group conversations are created automatically by a trigger when
  a project row is inserted, and membership is kept in sync by triggers on
  `project_members`.

## 7. Admin authorization

`admin_users` is a separate table (id → `auth.users.id`, `role`). A
`SECURITY DEFINER` function `is_admin(uid)` is used inside RLS policies
and inside the admin dashboard's queries — never a client-side
`if (email === ...)` check (spec §65). The admin dashboard authenticates
through the same Supabase Auth project; a user with no `admin_users` row
simply gets empty results from admin-only tables/policies.

## 8. Storage

One bucket, `avatars`, public-read (profile photos are meant to be seen),
authenticated-write restricted to `avatars/{auth.uid()}/*` paths so a user
can only upload/overwrite their own file. Client resizes/compresses before
upload (Expo `expo-image-manipulator`) — no paid image service.

## 9. Free-tier posture

- No server compute beyond Supabase's included Postgres functions/RPC.
- Realtime subscriptions scoped to the single open conversation, not all
  conversations at once.
- All list screens paginate (`limit`/`range`) — no unbounded table reads.
- Matching scores are computed on demand via RPC, not stored/recomputed
  continuously; see §11 "Recommendation caching" below.

## 10. What's deliberately deferred

Per the spec: no AI/embeddings, no payments, no voice/video, no public
social feed, no multi-university support in v1 (schema doesn't even carry
a `university_id` yet — adding one later is a additive migration, not a
breaking one, so it's not pre-built speculatively).

## 11. Recommendation caching (kept simple for MVP)

No caching layer in v1: `fn_match_score` is cheap (a handful of indexed
joins over small per-project/per-student sets), so it's fine to compute
on demand when a user opens "Find Partners" or "Projects Needing You".
If usage grows, the natural next step is a materialized view refreshed on
a trigger when `project_required_skills`, `student_skills`, or
`project_members` change — not built now, since it adds invalidation
complexity the MVP doesn't need.

## 12. Validation

Migrations 0001 through 0015 were applied to a real local Postgres 16 instance against
a shim of `auth`/`storage` (the parts Supabase provides that plain
Postgres doesn't) and exercised end-to-end before being handed over:
signup → KIIT-domain rejection of a non-KIIT email → profile bootstrap →
skills/interests/roles → project creation → auto-created group chat →
apply-to-project → self-accept blocked by RLS → owner-accept succeeds →
`project_members`/notifications populated → connection request → accept →
auto-created direct conversation → `get_contact_email` returns the address
only for an accepted, unblocked connection and `null` after a block →
blocked profile disappears from the other party's visibility → the exact
2-of-4 skill-match example from spec §27 returns `50.00` → repeated calls
to `fn_match_score` are deterministic → `matching_settings`' weight-sum
constraint rejects an invalid update and accepts a valid one → a non-admin
gets zero rows from `admin_users`/`matching_settings` → group
recommendation correctly finds a third student who fills a skill gap the
first two don't cover. Two real bugs were caught and fixed in this pass:
an enum-cast issue in the new-user trigger, and the account-status lockdown
trigger blocking the system's own email-confirmation flow (fixed via
`pg_trigger_depth()`). The fixes are already folded into the migration
files below — this isn't a to-do list, it's what's already been checked.


Migration 0016 adds an atomic `accept_connection_to_project()` workflow. It
accepts a pending connection and adds the requester to an open project owned
by the accepting student. Existing database triggers then create the direct
connection chat, update project team membership and member count, and add the
new teammate to the project group chat. Migrations 0015, 0016, and 0017 have been applied to the linked Supabase project. The new acceptance workflow has not been separately tested.
## 13. File map produced in this pass

```
docs/
  ARCHITECTURE.md        (this file)
  DATABASE.md            full table-by-table schema reference
  RLS_POLICIES.md        every policy, with the reasoning per table
  MATCHING_ALGORITHM.md  the six scoring functions + weighting + discovery
  SUPABASE_SETUP.md      step-by-step project setup, auth config, storage
supabase/
  migrations/0001..0017  runnable SQL, in apply order
  seed.sql               fake demo data (students, skills, projects)
```



Migration 0017 adds the projects table to the Supabase Realtime publication. Project detail screens subscribe to changes on their project row; membership triggers update current_member_count, causing both the team count and roster to refresh live.
