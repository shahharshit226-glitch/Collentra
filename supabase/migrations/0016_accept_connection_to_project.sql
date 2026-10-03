-- Accept a connection request and add the requester to one of the addressee's open project teams.
-- The connection decision trigger creates the direct chat; project_members triggers
-- maintain member counts and synchronize project group chat membership.
create or replace function accept_connection_to_project(p_connection_id uuid, p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  request_row connections%rowtype;
  project_row projects%rowtype;
begin
  if current_user_id is null then
    raise exception 'Please sign in again.' using errcode = '28000';
  end if;

  select * into request_row
    from connections
   where id = p_connection_id
     and addressee_id = current_user_id
     and status = 'pending'
   for update;
  if not found then
    raise exception 'This connection request is no longer pending.' using errcode = 'P0002';
  end if;

  select * into project_row
    from projects
   where id = p_project_id
     and creator_id = current_user_id
     and status in ('looking_for_members', 'team_forming')
   for update;
  if not found then
    raise exception 'Choose one of your open projects.' using errcode = 'P0002';
  end if;

  if project_row.current_member_count >= project_row.team_size then
    raise exception 'This project team is already full.' using errcode = '23514';
  end if;

  if exists (
    select 1 from project_members
     where project_id = p_project_id
       and student_id = request_row.requester_id
       and left_at is null
  ) then
    raise exception 'This student is already on the project team.' using errcode = '23505';
  end if;

  update connections
     set status = 'accepted'
   where id = request_row.id;

  insert into project_members (project_id, student_id)
    values (p_project_id, request_row.requester_id)
    on conflict (project_id, student_id) do update set left_at = null;
end;
$$;

revoke all on function accept_connection_to_project(uuid, uuid) from public;
grant execute on function accept_connection_to_project(uuid, uuid) to authenticated;
