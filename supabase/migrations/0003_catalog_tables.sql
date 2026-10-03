-- 0003_catalog_tables.sql
-- Admin-managed reference catalogues (skills, interests, roles) and the
-- junction tables linking them to students.

create table skills (
  id         uuid primary key default gen_random_uuid(),
  name       citext unique not null,
  category   text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Admin-managed synonym map, e.g. "ML" / "Artificial Intelligence" -> Machine Learning.
-- Used by the interest-match scorer; deliberately simple string aliasing, no NLP.
create table skill_aliases (
  id       uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skills(id) on delete cascade,
  alias    citext not null,
  unique (skill_id, alias)
);

create table student_skills (
  student_id uuid not null references profiles(id) on delete cascade,
  skill_id   uuid not null references skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);

create table interests (
  id         uuid primary key default gen_random_uuid(),
  name       citext unique not null,
  category   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table interest_aliases (
  id          uuid primary key default gen_random_uuid(),
  interest_id uuid not null references interests(id) on delete cascade,
  alias       citext not null,
  unique (interest_id, alias)
);

create table student_interests (
  student_id  uuid not null references profiles(id) on delete cascade,
  interest_id uuid not null references interests(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (student_id, interest_id)
);

create table roles (
  id   uuid primary key default gen_random_uuid(),
  name citext unique not null
);

create table student_preferred_roles (
  student_id uuid not null references profiles(id) on delete cascade,
  role_id    uuid not null references roles(id) on delete cascade,
  primary key (student_id, role_id)
);
