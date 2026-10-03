-- 0011_workflow_triggers.sql
-- The two "decision" flows in the spec (project application review, section
-- 22; connection accept, section 38) must not let a client directly INSERT
-- into project_members or conversations -- that would let anyone add
-- themselves to any project/chat. Instead, the only door in is: update the
-- application/connection row you're allowed to decide on, and a trigger
-- does the resulting membership/notification writes as SECURITY DEFINER.

-- ── Project application decided ─────────────────────────────────────────
create or replace function fn_application_decided()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  proj projects%rowtype;
begin
  if new.status = old.status then
    return new;
  end if;

  new.decided_at := now();

  select * into proj from projects where id = new.project_id;

  if new.status = 'accepted' then
    insert into project_members (project_id, student_id)
      values (new.project_id, new.applicant_id)
      on conflict (project_id, student_id) do update set left_at = null;

    insert into notifications (user_id, type, title, body, data)
      values (new.applicant_id, 'application_accepted',
              'Application accepted',
              'You''re now a member of ' || proj.title || '.',
              jsonb_build_object('project_id', new.project_id));

  elsif new.status = 'rejected' then
    insert into notifications (user_id, type, title, body, data)
      values (new.applicant_id, 'application_rejected',
              'Application update',
              'Your application to ' || proj.title || ' was not accepted this time.',
              jsonb_build_object('project_id', new.project_id));
  end if;

  return new;
end;
$$;

create trigger trg_application_decided
  before update on project_applications
  for each row execute function fn_application_decided();

-- Notify the project creator on new applications.
create or replace function fn_application_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  proj projects%rowtype;
  applicant_name text;
begin
  select * into proj from projects where id = new.project_id;
  select full_name into applicant_name from profiles where id = new.applicant_id;

  insert into notifications (user_id, type, title, body, data)
    values (proj.creator_id, 'project_application',
            'New application',
            applicant_name || ' applied to ' || proj.title || '.',
            jsonb_build_object('project_id', new.project_id, 'applicant_id', new.applicant_id));
  return new;
end;
$$;

create trigger trg_application_created
  after insert on project_applications
  for each row execute function fn_application_created();

-- ── Connection accepted -> open a direct conversation ───────────────────
create or replace function fn_connection_decided()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  conv_id uuid;
begin
  if new.status = old.status then
    return new;
  end if;
  new.decided_at := now();

  if new.status = 'accepted' then
    select c.id into conv_id
      from conversations c
      join conversation_members m1 on m1.conversation_id = c.id and m1.user_id = new.requester_id
      join conversation_members m2 on m2.conversation_id = c.id and m2.user_id = new.addressee_id
     where c.type = 'direct'
     limit 1;

    if conv_id is null then
      insert into conversations (type) values ('direct') returning id into conv_id;
      insert into conversation_members (conversation_id, user_id) values (conv_id, new.requester_id);
      insert into conversation_members (conversation_id, user_id) values (conv_id, new.addressee_id);
    end if;

    insert into notifications (user_id, type, title, body, data)
      values (new.requester_id, 'connection_accepted', 'Connection accepted',
              'Your connection request was accepted.',
              jsonb_build_object('user_id', new.addressee_id));
  end if;

  return new;
end;
$$;

create trigger trg_connection_decided
  before update on connections
  for each row execute function fn_connection_decided();

create or replace function fn_connection_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, type, title, body, data)
    values (new.addressee_id, 'connection_request', 'New connection request',
            'You have a new connection request.',
            jsonb_build_object('user_id', new.requester_id));
  return new;
end;
$$;

create trigger trg_connection_created
  after insert on connections
  for each row execute function fn_connection_created();
