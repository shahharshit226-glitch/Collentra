# Collentra — Database Schema Reference

Full runnable form: `supabase/migrations/0001` through `0016`, applied in order.
This doc is the human-readable index; read the migration file for exact
column types/constraints.

## Entity overview

```
auth.users ──1:1── profiles ──1:1── profile_private
                       │  └──1:1── availability
                       │
                       ├──*:*── skills            (via student_skills)
                       ├──*:*── interests          (via student_interests)
                       ├──*:*── roles              (via student_preferred_roles)
                       │
                       ├──1:*── projects (as creator)
                       │            ├──*:*── skills      (project_required_skills)
                       │            ├──*:*── roles       (project_required_roles)
                       │            ├──*:*── interests   (project_interests)
                       │            ├──1:*── project_members ──*:1── profiles
                       │            └──1:*── project_applications ──*:1── profiles
                       │
                       ├──*:*── profiles (via connections, self-referencing)
                       ├──*:*── profiles (via blocked_users, self-referencing)
                       ├──1:*── reports (as reporter)
                       ├──*:*── conversations (via conversation_members) ──1:*── messages
                       └──1:*── notifications
```

## Table-by-table

### `profiles`
The public student record. One row per `auth.users` row, created
automatically by `fn_handle_new_user()` — never inserted by the client.
`account_status` starts `pending`, flips to `verified` when Supabase Auth
confirms the email (`fn_handle_email_confirmed()`); a student can never
change their own `account_status` (enforced by trigger, not just RLS).

### `profile_private`
Split out from `profiles` so RLS can restrict `SELECT` to the owner (and
admins) without hiding the rest of the profile. Holds `kiit_email`,
`roll_number`, `phone_number`. The public "Email" action never reads this
table directly from the client — see `get_contact_email()` in
`SUPABASE_SETUP.md` §6.

### `availability`
1:1 with `profiles`. `hours_per_week` (banded enum, not a raw number — the
spec's own ranges) and `preferred_days`. Kept as its own table (rather than
columns on `profiles`) to match the spec's explicit table list (§63) and
because the matching engine's availability scorer reads it independently.

### `skills`, `skill_aliases`, `student_skills`
`skills` is the admin-managed catalogue (§11). `skill_aliases` lets an
admin map alternate names onto a canonical skill without an AI/NLP call —
currently used for display/search normalization; the *matching* engine
resolves synonyms at the `interests` layer instead (see below), since
project requirements are skills but project *domain matching* is via
interests.

### `interests`, `interest_aliases`, `student_interests`
Same pattern as skills. `interest_aliases` is what makes "ML" / "Machine
Learning" / "Artificial Intelligence" collapse to one canonical interest
(§28's synonym requirement) — the admin maintains the alias rows, the
scoring function never does string comparison.

### `roles`, `student_preferred_roles`
Static predefined list (§14) plus the student's chosen preferred roles.

### `projects`
Core project record. `current_member_count` is trigger-maintained (never
written by the client) so it can't drift from the true `project_members`
count. `status` is the enum from §18.

### `project_required_skills` / `project_required_roles` / `project_interests`
Per-project requirements. `project_interests` is **not** in the spec's
literal table list (§63) — it's a small addition (see
`ARCHITECTURE.md` §3 note) so "project domain/tags" (§28) match against
the same normalized `interests` catalogue students use, instead of doing
free-text comparison against `projects.domain` (which stays as a
free-text display label only, e.g. "AI / Computer Vision").

### `project_members`
Current + historical team roster. `left_at is null` means active member.
Rows are written only by triggers (`fn_application_decided()` on accept,
`fn_create_project_conversation()` for the creator) — never by a direct
client `INSERT` — so a student can't add themselves to a project.

### `project_applications`
The request-to-join flow (§22). A **partial** unique index —
`unique (project_id, applicant_id) where status = 'pending'` — allows only
one *pending* application per student per project at a time, but does not
block a fresh application after a previous one was `rejected` or
`withdrawn`. Past attempts stay in the table (history preserved); a
student can re-apply as many times as they like once their prior
application is no longer pending.

### `connections`, `blocked_users`, `reports`, `discovery_skips`
Straightforward per spec §§37, 38, 55, 56. `connections` has a
functional unique index on the *unordered* pair so A→B and B→A can't both
exist. `discovery_skips` only needs to hold a rolling window (the matching
function only looks back 7 days) — no cleanup job required for MVP, but
add one later if the table grows unbounded.

### `conversations`, `conversation_members`, `messages`
Permanent chat store (§43). A `project`-type conversation is created
automatically when the project is created and its membership is kept in
sync with `project_members` by triggers — a student who leaves a project
is removed from its group chat automatically (§83 asks you to "define
appropriate behavior"; this is that definition).

### `notifications`
Single table for every notification type (§45), `data jsonb` carries
whatever the client needs to deep-link (e.g. `{"project_id": "..."}`).
Written only by `SECURITY DEFINER` trigger functions, never by the client.

### `admin_users`, `matching_settings`
`admin_users` has no client-writable policy at all — grant admin status
via the Supabase dashboard/service role only (§65's "no `if (email ===
...)`" requirement). `matching_settings` is a single checked row (weights
must sum to 100) admins can update via the dashboard's Matching Settings
screen (§62).

### `project_feedback`
Present in the schema now (so team history / feedback UI can be added
later without a migration) but **not read by any matching function** —
per §87, feedback must not affect matching until there's enough data, so
wiring it in is a deliberate future step, not an oversight.

## What's deliberately not in this schema (yet)

- No `universities` table — v1 is KIIT-only by construction (the
  `auth.users` trigger rejects non-`@kiit.ac.in` signups), so a
  `university_id` column would be dead weight until multi-university
  support is actually built (§111 says structure *for* it later, not
  build it now).
- No `messages.read_at` per-message read receipts — `conversation_
  members.last_read_at` gives an unread-count-since-timestamp, which is
  what the spec's chat feature list actually needs (§44); per-message
  receipts can be added additively later if required.


### Accepting a connection into a project team

Migration `0016_accept_connection_to_project.sql` adds the `accept_connection_to_project()` RPC. It checks that the caller is the request addressee and project owner, the request is pending, the project is open, and the team has room. In one transaction it accepts the connection and adds the requester to the project. Existing triggers create the direct chat, recalculate the team count, and sync the new member into the project group chat.