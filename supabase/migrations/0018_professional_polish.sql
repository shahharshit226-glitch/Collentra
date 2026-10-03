-- Caller-scoped student dashboard and membership departure.
-- Both functions derive the student from auth.uid(); no caller-supplied user ID.
create or replace function public.fn_student_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select id, username, full_name, branch, year, bio
    from public.profiles where id = auth.uid()
  ),
  owned as (
    select p.id, p.title, p.status, 'Owner'::text as role, 'owned'::text as bucket, p.created_at, null::text as application_status
    from public.projects p where p.creator_id = auth.uid()
  ),
  joined as (
    select p.id, p.title, p.status, 'Member'::text as role, 'member'::text as bucket, p.created_at, null::text as application_status
    from public.project_members pm join public.projects p on p.id = pm.project_id
    where pm.student_id = auth.uid() and pm.left_at is null and not pm.is_owner
  ),
  applied as (
    select p.id, p.title, p.status, 'Applicant'::text as role, 'applied'::text as bucket, a.created_at,
      a.status::text as application_status
    from public.project_applications a join public.projects p on p.id = a.project_id
    where a.applicant_id = auth.uid() and a.status = 'pending'
  ),
  involvement as (select * from owned union all select * from joined),
  project_items as (select * from involvement union all select * from applied)
  select jsonb_build_object(
    'profile', (select to_jsonb(me) from me),
    'skills', coalesce((select jsonb_agg(s.name order by s.name) from public.student_skills ss join public.skills s on s.id = ss.skill_id where ss.student_id = auth.uid()), '[]'::jsonb),
    'interests', coalesce((select jsonb_agg(i.name order by i.name) from public.student_interests si join public.interests i on i.id = si.interest_id where si.student_id = auth.uid()), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from project_items x), '[]'::jsonb),
    'stats', jsonb_build_object(
      'active', (select count(*) from involvement where status not in ('completed','archived')),
      'pending', (select count(*) from applied),
      'connections', (select count(*) from public.connections c where c.status = 'accepted' and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())),
      'completed', (select count(*) from involvement where status = 'completed')
    )
  );
$$;
revoke all on function public.fn_student_dashboard() from public;
grant execute on function public.fn_student_dashboard() to authenticated;

create or replace function public.fn_leave_project(p_project_id uuid, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_conversation_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  if exists (select 1 from public.projects where id = p_project_id and creator_id = auth.uid()) then
    raise exception 'Owners cannot leave their project. Transfer ownership or close it.';
  end if;
  if not exists (select 1 from public.project_members where project_id = p_project_id and student_id = auth.uid() and left_at is null and not is_owner) then
    raise exception 'Active membership not found';
  end if;
  select id into v_conversation_id from public.conversations where project_id = p_project_id and type = 'project' limit 1;
  if v_conversation_id is not null then
    insert into public.messages(conversation_id, sender_id, content)
      values (v_conversation_id, auth.uid(), coalesce(nullif(trim(v_name), ''), 'A student') || ' left the project');
    delete from public.conversation_members where conversation_id = v_conversation_id and user_id = auth.uid();
  end if;
  update public.project_members set left_at = now()
    where project_id = p_project_id and student_id = auth.uid() and left_at is null and not is_owner;
  -- The membership UPDATE is the event consumed by the existing notification trigger.
end;
$$;
revoke all on function public.fn_leave_project(uuid, text) from public;
grant execute on function public.fn_leave_project(uuid, text) to authenticated;

comment on function public.fn_leave_project(uuid, text) is 'Leaves project as authenticated member and retains membership history. p_reason is reserved for future owner notifications.';

create or replace function public.fn_transfer_project_ownership(p_project_id uuid, p_student_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from public.projects where id = p_project_id and creator_id = auth.uid()) then raise exception 'Only the owner can transfer ownership'; end if;
  if not exists (select 1 from public.project_members where project_id = p_project_id and student_id = p_student_id and left_at is null) then raise exception 'Choose an active project member'; end if;
  update public.project_members set is_owner = false where project_id = p_project_id and student_id = auth.uid() and left_at is null;
  update public.project_members set is_owner = true where project_id = p_project_id and student_id = p_student_id and left_at is null;
  update public.projects set creator_id = p_student_id where id = p_project_id;
end;
$$;
revoke all on function public.fn_transfer_project_ownership(uuid, uuid) from public;
grant execute on function public.fn_transfer_project_ownership(uuid, uuid) to authenticated;
