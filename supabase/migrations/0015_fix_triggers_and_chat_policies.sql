-- 0015_fix_triggers_and_chat_policies.sql
-- Patch for two bugs that only show up for a normal signed-in user (they
-- were invisible when testing as the database superuser, which skips RLS):
--
-- 1. The chat policies on conversations/conversation_members/messages
--    checked membership by querying conversation_members from inside a
--    policy ON conversation_members, which Postgres rejects with
--    "infinite recursion detected in policy". Membership is now checked
--    through a SECURITY DEFINER helper that reads the table without
--    re-entering RLS.
--
-- 2. The triggers that maintain project data on behalf of the user
--    (create the project's group chat + owner row, keep the member count
--    and chat membership in sync) ran with the caller's privileges, so
--    RLS blocked their writes. They now run as SECURITY DEFINER, like the
--    application/connection triggers already did.

-- ── 1. Chat policies ────────────────────────────────────────────────────
create or replace function is_conversation_member(conv_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_members
     where conversation_id = conv_id and user_id = auth.uid()
  );
$$;

drop policy if exists conversations_select on conversations;
create policy conversations_select on conversations for select
  using (is_conversation_member(id) or is_admin(auth.uid()));

drop policy if exists conversation_members_select on conversation_members;
create policy conversation_members_select on conversation_members for select
  using (is_conversation_member(conversation_id) or is_admin(auth.uid()));

drop policy if exists messages_select on messages;
create policy messages_select on messages for select
  using (is_conversation_member(conversation_id));

drop policy if exists messages_insert on messages;
create policy messages_insert on messages for insert
  with check (sender_id = auth.uid() and is_conversation_member(conversation_id));

-- ── 2. Project triggers run with definer rights ─────────────────────────
alter function fn_create_project_conversation()         security definer set search_path = public;
alter function fn_recalc_project_member_count()         security definer set search_path = public;
alter function fn_sync_project_conversation_members()   security definer set search_path = public;
