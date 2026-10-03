-- 0010_matching_functions.sql
-- Deterministic, weighted, non-AI matching engine. See MATCHING_ALGORITHM.md
-- for the reasoning behind each factor; this file is the runnable form.

-- ── Skill match (40%) ────────────────────────────────────────────────────
create or replace function fn_skill_match_score(p_student uuid, p_project uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case when total = 0 then 100 else round(matched::numeric / total * 100, 2) end
  from (
    select
      (select count(*) from project_required_skills prs
         join student_skills ss on ss.skill_id = prs.skill_id and ss.student_id = p_student
        where prs.project_id = p_project) as matched,
      (select count(*) from project_required_skills where project_id = p_project) as total
  ) x;
$$;

-- ── Interest match (20%) ─────────────────────────────────────────────────
-- Synonyms are resolved at data-entry time via skill_aliases/interest_aliases
-- (admin maps "ML"/"AI" to the canonical `interests` row), so scoring here
-- is a plain join against the normalized interest ids -- no NLP needed.
create or replace function fn_interest_match_score(p_student uuid, p_project uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case when total = 0 then 100 else round(matched::numeric / total * 100, 2) end
  from (
    select
      (select count(distinct pi.interest_id) from project_interests pi
         join student_interests si on si.interest_id = pi.interest_id and si.student_id = p_student
        where pi.project_id = p_project) as matched,
      (select count(*) from project_interests where project_id = p_project) as total
  ) x;
$$;

-- ── Role match (15%) ─────────────────────────────────────────────────────
create or replace function fn_role_match_score(p_student uuid, p_project uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case when total = 0 then 100 else round(matched::numeric / total * 100, 2) end
  from (
    select
      (select count(distinct prr.role_id) from project_required_roles prr
         join student_preferred_roles spr on spr.role_id = prr.role_id and spr.student_id = p_student
        where prr.project_id = p_project) as matched,
      (select count(*) from project_required_roles where project_id = p_project) as total
  ) x;
$$;

-- ── Complementary skills (10%) ───────────────────────────────────────────
-- "Does this candidate fill a gap the CURRENT team doesn't already cover?"
-- -- not just "does the candidate match the project requirements".
create or replace function fn_complementary_score(p_student uuid, p_project uuid)
returns numeric language sql stable security definer set search_path = public as $$
  with team_skills as (
    select distinct ss.skill_id
    from project_members pm
    join student_skills ss on ss.student_id = pm.student_id
    where pm.project_id = p_project and pm.left_at is null
  ),
  missing as (
    select prs.skill_id from project_required_skills prs
    where prs.project_id = p_project
      and prs.skill_id not in (select skill_id from team_skills)
  ),
  filled as (
    select m.skill_id from missing m
    join student_skills ss on ss.skill_id = m.skill_id and ss.student_id = p_student
  )
  select case
    when (select count(*) from missing) = 0 then 100
    else round((select count(*) from filled)::numeric / (select count(*) from missing) * 100, 2)
  end;
$$;

-- ── Availability (10%) ───────────────────────────────────────────────────
-- 70% weight on how close the student's weekly-hours band is to the
-- project's expected workload, 30% on day-of-week flexibility.
create or replace function fn_availability_score(p_student uuid, p_project uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  student_hours collab_hours_range;
  student_days  days_preference;
  project_hours collab_hours_range;
  hours_score   numeric;
  days_score    numeric;
begin
  select hours_per_week, preferred_days into student_hours, student_days
    from availability where profile_id = p_student;
  select expected_hours_per_week into project_hours from projects where id = p_project;

  if student_hours is null then
    return 50; -- no availability data yet -- neutral, not punitive
  end if;

  if project_hours is null then
    hours_score := 100; -- project didn't specify an expected workload
  else
    hours_score := greatest(0, 100 - abs(fn_hours_rank(student_hours) - fn_hours_rank(project_hours)) * 34);
  end if;

  days_score := case when student_days = 'both' then 100 else 70 end;

  return round(hours_score * 0.7 + days_score * 0.3, 2);
end;
$$;

-- ── Other (5%) ───────────────────────────────────────────────────────────
-- Deliberately minimal and admin-extensible per spec section 32: never
-- gender, never inferred personality. Placeholder factor: same-branch
-- relevance to the project creator. Replace/extend without touching the
-- other five scorers or fn_match_score's signature.
create or replace function fn_other_score(p_student uuid, p_project_creator uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case when s.branch is not null and c.branch is not null and s.branch = c.branch
              then 100 else 60 end
  from profiles s, profiles c
  where s.id = p_student and c.id = p_project_creator;
$$;

-- ── Final weighted score ─────────────────────────────────────────────────
-- Weights are read from matching_settings every call, so an admin edit
-- takes effect immediately with no redeploy (spec section 62).
create or replace function fn_match_score(p_student uuid, p_project uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  w matching_settings%rowtype;
  creator uuid;
begin
  select * into w from matching_settings where id = 1;
  select creator_id into creator from projects where id = p_project;

  return round(
    fn_skill_match_score(p_student, p_project)   * w.skill_weight        / 100 +
    fn_interest_match_score(p_student, p_project)* w.interest_weight     / 100 +
    fn_role_match_score(p_student, p_project)    * w.role_weight         / 100 +
    fn_complementary_score(p_student, p_project) * w.complementary_weight/ 100 +
    fn_availability_score(p_student, p_project)  * w.availability_weight / 100 +
    fn_other_score(p_student, creator)           * w.other_weight        / 100
  , 2);
end;
$$;

-- ── Recommended Partners (for a project owner) ──────────────────────────
create or replace function fn_recommended_partners(p_project uuid, p_limit int default 10)
returns table(student_id uuid, score numeric) language sql stable security definer set search_path = public as $$
  select p.id, fn_match_score(p.id, proj.id)
  from profiles p, (select * from projects where id = p_project) proj
  where p.account_status = 'verified'
    and p.is_available_to_collaborate = true
    and proj.current_member_count < proj.team_size
    and not exists (
      select 1 from project_members pm
       where pm.project_id = p_project and pm.student_id = p.id and pm.left_at is null
    )
    and not is_blocked_pair(p.id, proj.creator_id)
  order by 2 desc
  limit p_limit;
$$;

-- ── Projects Needing Your Skills (for a student) ────────────────────────
create or replace function fn_projects_needing_skills(p_student uuid, p_limit int default 10)
returns table(project_id uuid, score numeric) language sql stable security definer set search_path = public as $$
  select proj.id, fn_match_score(p_student, proj.id)
  from projects proj
  where proj.status in ('looking_for_members', 'team_forming')
    and proj.current_member_count < proj.team_size
    and not exists (
      select 1 from project_members pm
       where pm.project_id = proj.id and pm.student_id = p_student and pm.left_at is null
    )
    and not exists (
      select 1 from project_applications pa
       where pa.project_id = proj.id and pa.applicant_id = p_student and pa.status = 'pending'
    )
    and not is_blocked_pair(p_student, proj.creator_id)
  order by 2 desc
  limit p_limit;
$$;

-- ── Group recommendation: greedy set-cover over the team's skill gap ────
create or replace function fn_group_recommendation(p_project uuid, p_group_size int default 3)
returns table(out_student_id uuid, out_covers uuid[]) language plpgsql stable security definer set search_path = public as $$
declare
  missing uuid[];
  picked  uuid[] := '{}';
  cand    record;
  i       int := 0;
begin
  select array_agg(prs.skill_id) into missing
  from project_required_skills prs
  where prs.project_id = p_project
    and prs.skill_id not in (
      select ss.skill_id from project_members pm
      join student_skills ss on ss.student_id = pm.student_id
      where pm.project_id = p_project and pm.left_at is null
    );

  if missing is null then
    return;
  end if;

  while i < p_group_size and coalesce(array_length(missing, 1), 0) > 0 loop
    select ss.student_id as sid,
           array_agg(distinct ss.skill_id) filter (where ss.skill_id = any(missing)) as covers
      into cand
    from student_skills ss
    join profiles p on p.id = ss.student_id
    where ss.skill_id = any(missing)
      and p.account_status = 'verified'
      and p.is_available_to_collaborate = true
      and not (ss.student_id = any(picked))
      and not exists (
        select 1 from project_members pm
         where pm.project_id = p_project and pm.student_id = ss.student_id and pm.left_at is null
      )
    group by ss.student_id
    order by array_length(array_agg(distinct ss.skill_id) filter (where ss.skill_id = any(missing)), 1) desc
    limit 1;

    exit when cand is null;

    out_student_id := cand.sid;
    out_covers := cand.covers;
    return next;

    picked := picked || cand.sid;
    missing := array(select unnest(missing) except select unnest(cand.covers));
    i := i + 1;
  end loop;
end;
$$;

-- ── Random Discovery ─────────────────────────────────────────────────────
-- Person-to-person compatibility, independent of any one project: rewards
-- some shared interest plus complementary (non-overlapping) skills, so the
-- "Potential collaboration: Web + NLP" framing in spec section 37 falls out
-- naturally rather than being hand-authored per pair.
create or replace function fn_profile_compatibility(a uuid, b uuid)
returns numeric language sql stable security definer set search_path = public as $$
  with a_skills as (select skill_id from student_skills where student_id = a),
       b_skills as (select skill_id from student_skills where student_id = b),
       a_int as (select interest_id from student_interests where student_id = a),
       b_int as (select interest_id from student_interests where student_id = b)
  select round(
    (case when (select count(*) from a_int) = 0 or (select count(*) from b_int) = 0 then 50
     else (select count(*) from a_int ai join b_int bi on ai.interest_id = bi.interest_id)::numeric
          / greatest((select count(*) from a_int), (select count(*) from b_int)) * 100
    end) * 0.5
    +
    (case when (select count(*) from a_skills) = 0 or (select count(*) from b_skills) = 0 then 50
     else (select count(*) from b_skills where skill_id not in (select skill_id from a_skills))::numeric
          / greatest((select count(*) from b_skills), 1) * 100
    end) * 0.5
  , 2);
$$;

create or replace function fn_discover_candidate(p_user uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.id
  from profiles p, (select min_discovery_threshold from matching_settings where id = 1) w
  where p.id <> p_user
    and p.account_status = 'verified'
    and p.is_available_to_collaborate = true
    and not is_blocked_pair(p.id, p_user)
    and not exists (
      select 1 from discovery_skips ds
       where ds.user_id = p_user and ds.skipped_user_id = p.id
         and ds.created_at > now() - interval '7 days'
    )
    and fn_profile_compatibility(p_user, p.id) >= w.min_discovery_threshold
  order by random()
  limit 1;
$$;
