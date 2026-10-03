-- 0002_profile_tables.sql
-- Public profile + split-out private fields + availability.

create table profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,
  username                  citext unique not null,
  full_name                 text not null,
  school                    text,
  branch                    text,
  year                      smallint check (year between 1 and 5),
  semester                  smallint check (semester between 1 and 10),
  gender                    text,
  avatar_url                text,
  bio                       text,
  github_url                text,
  linkedin_url              text,
  account_status            account_status not null default 'pending',
  is_available_to_collaborate boolean not null default false,
  profile_completion_pct   smallint not null default 0
                             check (profile_completion_pct between 0 and 100),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table profiles is
  'Public-facing student profile. Never store KIIT email, roll number, '
  'or phone here -- see profile_private.';

-- Private fields, isolated so RLS can restrict them independently of the
-- public profile row (Postgres RLS is row-level, not column-level).
create table profile_private (
  profile_id   uuid primary key references profiles(id) on delete cascade,
  kiit_email   citext not null unique,
  roll_number  text unique,
  phone_number text,
  updated_at   timestamptz not null default now()
);

comment on table profile_private is
  'Owner-only fields. Selectable only by the profile owner or an admin -- see RLS_POLICIES.md.';

create table availability (
  profile_id      uuid primary key references profiles(id) on delete cascade,
  hours_per_week  collab_hours_range not null default '0-5',
  preferred_days  days_preference not null default 'both',
  updated_at      timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger trg_profile_private_updated_at
  before update on profile_private
  for each row execute function set_updated_at();

create trigger trg_availability_updated_at
  before update on availability
  for each row execute function set_updated_at();
