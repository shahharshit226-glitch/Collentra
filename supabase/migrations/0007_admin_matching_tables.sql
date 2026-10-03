-- 0007_admin_matching_tables.sql

create table admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       admin_role not null default 'moderator',
  created_at timestamptz not null default now()
);

create or replace function is_admin(uid uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from admin_users where id = uid);
$$;

-- Single-row configuration table for the matching weights (spec section 62/25).
create table matching_settings (
  id                     smallint primary key default 1,
  skill_weight           numeric not null default 40,
  interest_weight        numeric not null default 20,
  role_weight            numeric not null default 15,
  complementary_weight   numeric not null default 10,
  availability_weight    numeric not null default 10,
  other_weight           numeric not null default 5,
  min_discovery_threshold numeric not null default 40,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references admin_users(id),
  check (id = 1),
  check (
    skill_weight + interest_weight + role_weight +
    complementary_weight + availability_weight + other_weight = 100
  )
);

insert into matching_settings (id) values (1);

create trigger trg_matching_settings_updated_at
  before update on matching_settings
  for each row execute function set_updated_at();

-- Optional, forward-looking: private per-project feedback (spec section 87).
-- Not read by the matching engine yet -- kept isolated so it can be wired
-- in later without a schema change to the scoring functions.
create table project_feedback (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  from_user_id  uuid not null references profiles(id) on delete cascade,
  to_user_id    uuid not null references profiles(id) on delete cascade,
  teamwork      smallint check (teamwork between 1 and 5),
  communication smallint check (communication between 1 and 5),
  reliability   smallint check (reliability between 1 and 5),
  technical     smallint check (technical between 1 and 5),
  created_at    timestamptz not null default now(),
  unique (project_id, from_user_id, to_user_id),
  check (from_user_id <> to_user_id)
);
