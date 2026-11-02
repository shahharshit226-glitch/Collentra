# Collentra — Supabase Setup

Zero-cost throughout: everything here runs on Supabase's free tier.

## 1. Create the project

1. Create a free Supabase project (choose a region close to KIIT/India for
   lower latency).
2. Note the project URL and the `anon` public key (Settings → API) — these
   go in the mobile app's `.env`. **Never** put the `service_role` key in
   the mobile app or commit it anywhere.

## 2. Apply the migrations

Using the Supabase CLI (recommended, keeps history):

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push   # applies everything in supabase/migrations/ in order
```

Or paste each file from `supabase/migrations/0001_...sql` through
`0020_...sql` into the SQL editor, in filename order, one at a time.
`0008` and part of `0014` touch `auth`/`storage` schemas — this requires
running as the `postgres` role, which both the CLI and the SQL editor use
by default (a normal REST/service-role API call would not have permission).

Then run `supabase/seed_catalog.sql` once (skills/interests/roles).

## 3. Configure Authentication providers

**Email/password:**
- Auth → Providers → Email: enable it, and enable "Confirm email" (this is
  what drives `email_confirmed_at`, which `fn_handle_email_confirmed()`
  watches to flip `account_status` to `verified`).

**Google:**
- Auth → Providers → Google: enable it, add your OAuth client ID/secret
  from Google Cloud Console (free), and add the Expo redirect URI
  (`https://<project-ref>.supabase.co/auth/v1/callback` plus your app's
  custom scheme for the mobile redirect).
- Google sign-in does **not** restrict by email domain on its own — that
  restriction comes from `fn_enforce_kiit_domain()` (migration `0008`),
  which rejects the `auth.users` insert for any non-`@kiit.ac.in` email
  regardless of provider. Test this explicitly: try Google sign-in with a
  personal Gmail account and confirm it's rejected.

**Email templates:** customize the confirmation email under Auth →
Templates if you want it to look like Collentra rather than the Supabase
default — optional, zero cost either way.

## 4. Why the `auth.users` triggers need a privileged run

`fn_enforce_kiit_domain`, `fn_handle_new_user`, and
`fn_handle_email_confirmed` (migration `0008`) attach triggers to
`auth.users`, a schema normal Postgres roles can't modify. The Supabase
CLI and SQL editor both connect as `postgres`/`supabase_admin`, which can.
If you ever see a permissions error applying `0008`, you're most likely
running it through a REST client with the `anon` or `service_role` key
instead of a direct Postgres connection — switch to the CLI or SQL editor.

## 5. Storage

Migration `0014` creates the `avatars` bucket and its policies. Client-side,
resize/compress before upload (e.g. `expo-image-manipulator`) — this is
the "zero-cost image policy" from spec §78, no paid image service.

## 6. The "Email" button, without exposing addresses

Never `select` from `profile_private` on the client for this. Call the RPC:

```ts
const { data: email } = await supabase.rpc('get_contact_email', { target_id: otherUserId });
if (email) {
  Linking.openURL(`mailto:${email}?subject=Collentra project collaboration`);
}
```

`get_contact_email` (migration `0008`) returns `null` if the caller isn't
in an accepted, unblocked connection with `target_id` — the client should
treat a `null` result as "Email action unavailable" rather than erroring.

## 7. Realtime chat subscription

Migration `0020_activate_chat_realtime.sql` repairs existing projects by
ensuring `public.messages` is in the `supabase_realtime` publication and uses
full replica identity. Apply it with `supabase db push` after linking the
project. The mobile chat screen subscribes only while it is open and reports a
channel timeout/error instead of silently appearing offline.

```ts
const channel = supabase
  .channel(`conversation:${conversationId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
    (payload) => appendMessage(payload.new)
  )
  .subscribe();

// on screen unmount:
supabase.removeChannel(channel);
```

Subscribe only while the conversation screen is mounted (§98's free-tier
rule: avoid unnecessary Realtime channels) — don't subscribe to every
conversation a user is part of just to show unread counts; poll or use a
lightweight `notifications` row for that instead.

## 8. Bootstrapping the first admin

There's no signup flow for admins by design (§65). After creating your own
KIIT-email account through the normal app flow, promote it manually once,
via the SQL editor (as `postgres`, bypassing RLS by role):

```sql
insert into admin_users (id, role)
values ('<your-auth-uid>', 'super_admin');
```

Every subsequent admin can be added the same way, or later from the admin
dashboard once the first `super_admin` exists and you build that screen.

## 9. Demo/seed data for the college presentation

```bash
npm install @supabase/supabase-js
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx supabase/seed-demo-users.ts
```

This creates a handful of fake `@kiit.ac.in` accounts (fake data only, per
§105 — never commit real student data). Create a sample project through
the app UI using one seeded account, then sanity-check from the SQL editor:

```sql
select * from fn_recommended_partners('<project-id>', 10);
select * from fn_projects_needing_skills('<student-id>', 10);
```

## 10. Environment variables

`.env.example` (commit this, not the real `.env`):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

The admin dashboard needs the same two (its own `.env`, not shared with
the mobile app's bundle) — it never needs the service role key either;
`is_admin()` + RLS is what grants it elevated read/write, not a different
key.

## 11. Free-tier limits worth knowing going in

Supabase's free tier (subject to change — check the current limits before
committing to it for production): a paused-after-inactivity project, a
row/storage/bandwidth cap, and a Realtime concurrent-connection cap. None
of these should be hit during development or a college demo; if the app
gets real KIIT-wide usage later, that's the point at which to look at the
Pro tier — not before, per the ₹0 constraint for this phase.
