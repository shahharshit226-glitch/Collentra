-- 0004_project_tables.sql

create table projects (
  id                       uuid primary key default gen_random_uuid(),
  creator_id               uuid not null references profiles(id) on delete cascade,
  title                    text not null,
  description              text not null,
  domain                   text,
  team_size                smallint not null check (team_size > 0),
  current_member_count     smallint not null default 1,
  status                   project_status not null default 'looking_for_members',
  expected_hours_per_week  collab_hours_range,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

create table project_required_skills (
  project_id uuid not null references projects(id) on delete cascade,
  skill_id   uuid not null references skills(id) on delete cascade,
  primary key (project_id, skill_id)
);

create table project_required_roles (
  project_id uuid not null references projects(id) on delete cascade,
  role_id    uuid not null references roles(id) on delete cascade,
  primary key (project_id, role_id)
);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  role_id    uuid references roles(id),
  is_owner   boolean not null default false,
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  primary key (project_id, student_id)
);

create table project_applications (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  applicant_id  uuid not null references profiles(id) on delete cascade,
  message       text,
  status        application_status not null default 'pending',
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

-- A student may re-apply after a rejection (or after withdrawing), so this
-- is NOT a plain unique(project_id, applicant_id) -- it only stops a
-- second *pending* application for the same project from the same
-- applicant. History of past rejected/withdrawn attempts is preserved.
create unique index project_applications_one_pending
  on project_applications (project_id, applicant_id)
  where status = 'pending';

-- Keep projects.current_member_count accurate without a client round trip.
create or replace function fn_recalc_project_member_count()
returns trigger language plpgsql as $$
declare
  target_project uuid := coalesce(new.project_id, old.project_id);
begin
  update projects
     set current_member_count = (
       select count(*) from project_members
        where project_id = target_project and left_at is null
     )
   where id = target_project;
  return null;
end;
$$;

create trigger trg_project_members_count_ins
  after insert or update or delete on project_members
  for each row execute function fn_recalc_project_member_count();

-- Auto-create the project's group conversation and add the creator.
create or replace function fn_create_project_conversation()
returns trigger language plpgsql as $$
declare
  conv_id uuid;
begin
  insert into conversations (type, project_id) values ('project', new.id)
    returning id into conv_id;
  insert into conversation_members (conversation_id, user_id)
    values (conv_id, new.creator_id);
  insert into project_members (project_id, student_id, is_owner)
    values (new.id, new.creator_id, true);
  return new;
end;
$$;
-- NOTE: trigger created in 0006 after `conversations` exists.
