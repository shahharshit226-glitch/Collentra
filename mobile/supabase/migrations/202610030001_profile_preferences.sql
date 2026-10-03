-- Replace a student's matching preferences atomically. All writes are
-- constrained to auth.uid() and remain subject to the existing RLS policies.
create or replace function public.fn_update_student_preferences(
  p_skill_ids uuid[] default '{}',
  p_interest_ids uuid[] default '{}',
  p_role_ids uuid[] default '{}',
  p_hours_per_week public.collab_hours_range default null,
  p_preferred_days public.days_preference default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_skills uuid[] := coalesce(p_skill_ids, '{}'::uuid[]);
  v_interests uuid[] := coalesce(p_interest_ids, '{}'::uuid[]);
  v_roles uuid[] := coalesce(p_role_ids, '{}'::uuid[]);
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  if exists (select 1 from unnest(v_skills) requested(id)
             where not exists (select 1 from public.skills s where s.id = requested.id and s.is_active)) then
    raise exception 'One or more selected skills are unavailable';
  end if;
  if exists (select 1 from unnest(v_interests) requested(id)
             where not exists (select 1 from public.interests i where i.id = requested.id and i.is_active)) then
    raise exception 'One or more selected interests are unavailable';
  end if;
  if exists (select 1 from unnest(v_roles) requested(id)
             where not exists (select 1 from public.roles r where r.id = requested.id)) then
    raise exception 'One or more selected roles are unavailable';
  end if;

  delete from public.student_skills where student_id = auth.uid() and not (skill_id = any(v_skills));
  insert into public.student_skills(student_id, skill_id)
    select auth.uid(), requested.id from unnest(v_skills) requested(id)
    on conflict (student_id, skill_id) do nothing;

  delete from public.student_interests where student_id = auth.uid() and not (interest_id = any(v_interests));
  insert into public.student_interests(student_id, interest_id)
    select auth.uid(), requested.id from unnest(v_interests) requested(id)
    on conflict (student_id, interest_id) do nothing;

  delete from public.student_preferred_roles where student_id = auth.uid() and not (role_id = any(v_roles));
  insert into public.student_preferred_roles(student_id, role_id)
    select auth.uid(), requested.id from unnest(v_roles) requested(id)
    on conflict (student_id, role_id) do nothing;

  if p_hours_per_week is not null and p_preferred_days is not null then
    update public.availability
       set hours_per_week = p_hours_per_week,
           preferred_days = p_preferred_days
     where profile_id = auth.uid();
    if not found then raise exception 'Availability settings could not be updated'; end if;
  else
    raise exception 'Choose your weekly hours and preferred days';
  end if;
end;
$$;
revoke all on function public.fn_update_student_preferences(uuid[], uuid[], uuid[], public.collab_hours_range, public.days_preference) from public;
grant execute on function public.fn_update_student_preferences(uuid[], uuid[], uuid[], public.collab_hours_range, public.days_preference) to authenticated;
