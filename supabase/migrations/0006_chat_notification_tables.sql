-- 0006_chat_notification_tables.sql

create table conversations (
  id         uuid primary key default gen_random_uuid(),
  type       conversation_type not null,
  project_id uuid references projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((type = 'project') = (project_id is not null))
);

create table conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 4000),
  created_at      timestamptz not null default now(),
  edited_at       timestamptz
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       notification_type not null,
  title      text not null,
  body       text,
  data       jsonb,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- Now that `conversations` exists, wire up the trigger declared in 0004.
create trigger trg_projects_create_conversation
  after insert on projects
  for each row execute function fn_create_project_conversation();

-- Keep the project group chat's membership in sync with project_members.
create or replace function fn_sync_project_conversation_members()
returns trigger language plpgsql as $$
declare
  conv_id uuid;
begin
  select id into conv_id from conversations
   where project_id = coalesce(new.project_id, old.project_id) and type = 'project';

  if tg_op in ('INSERT') or (tg_op = 'UPDATE' and new.left_at is null) then
    insert into conversation_members (conversation_id, user_id)
      values (conv_id, new.student_id)
      on conflict do nothing;
  elsif tg_op = 'UPDATE' and new.left_at is not null then
    delete from conversation_members
     where conversation_id = conv_id and user_id = new.student_id;
  elsif tg_op = 'DELETE' then
    delete from conversation_members
     where conversation_id = conv_id and user_id = old.student_id;
  end if;
  return null;
end;
$$;

create trigger trg_project_members_sync_chat
  after insert or update or delete on project_members
  for each row execute function fn_sync_project_conversation_members();
