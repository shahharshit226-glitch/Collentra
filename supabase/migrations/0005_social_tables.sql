-- 0005_social_tables.sql

create table connections (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status       connection_status not null default 'pending',
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  check (requester_id <> addressee_id)
);

-- Prevent duplicate/reverse-duplicate requests between the same pair.
create unique index connections_unique_pair
  on connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table blocked_users (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table reports (
  id                    uuid primary key default gen_random_uuid(),
  reporter_id           uuid not null references profiles(id) on delete cascade,
  reported_user_id      uuid references profiles(id) on delete cascade,
  reported_project_id   uuid references projects(id) on delete cascade,
  category              report_category not null,
  description           text,
  status                report_status not null default 'open',
  created_at            timestamptz not null default now(),
  reviewed_at           timestamptz,
  check (reported_user_id is not null or reported_project_id is not null)
);

create table discovery_skips (
  user_id         uuid not null references profiles(id) on delete cascade,
  skipped_user_id uuid not null references profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (user_id, skipped_user_id)
);

-- Symmetric block check, used throughout RLS and matching.
create or replace function is_blocked_pair(a uuid, b uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from blocked_users
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  );
$$;
