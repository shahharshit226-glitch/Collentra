-- 0009_matching_support_tables.sql
-- Small addition needed by the matching engine: projects tag themselves
-- with the same normalized `interests` catalogue students use, so interest
-- matching is a plain join rather than free-text comparison against
-- `projects.domain` (spec section 28 calls for "project tags" -- this is
-- that table; `domain` stays as a free-text display label only).

create table project_interests (
  project_id  uuid not null references projects(id) on delete cascade,
  interest_id uuid not null references interests(id) on delete cascade,
  primary key (project_id, interest_id)
);

create or replace function fn_hours_rank(r collab_hours_range)
returns int language sql immutable as $$
  select case r
    when '0-5' then 0
    when '5-10' then 1
    when '10-15' then 2
    when '15+' then 3
  end;
$$;
