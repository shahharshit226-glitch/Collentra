-- 0012_rls_policies.sql
-- Every table gets RLS enabled and an explicit policy set. Default-deny:
-- a table with no matching policy for an operation simply returns/affects
-- zero rows for that role. See RLS_POLICIES.md for the reasoning per table.

-- ── Shared helper: can the caller see this profile at all? ──────────────
create or replace function can_view_profile(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target = auth.uid()
     or is_admin(auth.uid())
     or (
       exists (select 1 from profiles where id = target and account_status = 'verified')
       and not is_blocked_pair(auth.uid(), target)
     );
$$;

-- Prevent students from changing their own account_status (only admins/
-- triggers may) -- enforced as a trigger rather than an RLS CHECK, since
-- RLS can't compare NEW/OLD column values directly.
-- pg_trigger_depth() > 1 means this UPDATE was itself fired by another
-- trigger (e.g. fn_handle_email_confirmed() flipping pending -> verified
-- when Supabase confirms an email) rather than a direct client UPDATE on
-- `profiles` -- only the latter needs to be blocked for non-admins.
create or replace function fn_prevent_self_status_change()
returns trigger language plpgsql as $$
begin
  if new.account_status <> old.account_status
     and not is_admin(auth.uid())
     and pg_trigger_depth() <= 1 then
    raise exception 'Only an administrator can change account status.';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_prevent_status_change
  before update on profiles
  for each row execute function fn_prevent_self_status_change();

-- ═══════════════════════════════════════════════════════════════════════
-- profiles
-- ═══════════════════════════════════════════════════════════════════════
alter table profiles enable row level security;

create policy profiles_select on profiles for select
  using (can_view_profile(id));

create policy profiles_update_self on profiles for update
  using (auth.uid() = id or is_admin(auth.uid()));
-- (account_status self-changes are blocked by the trigger above, not here)

-- No INSERT/DELETE policy for the authenticated role: rows are created
-- only by fn_handle_new_user() (SECURITY DEFINER, fires on auth.users).

-- ═══════════════════════════════════════════════════════════════════════
-- profile_private
-- ═══════════════════════════════════════════════════════════════════════
alter table profile_private enable row level security;

create policy profile_private_select on profile_private for select
  using (auth.uid() = profile_id or is_admin(auth.uid()));

create policy profile_private_update_self on profile_private for update
  using (auth.uid() = profile_id);
-- kiit_email should be treated as read-only by the client even though the
-- column itself is technically updatable here; enforce in the app layer,
-- since it's set once from auth.users.email at signup.

-- ═══════════════════════════════════════════════════════════════════════
-- availability
-- ═══════════════════════════════════════════════════════════════════════
alter table availability enable row level security;

create policy availability_select on availability for select
  using (can_view_profile(profile_id));

create policy availability_update_self on availability for update
  using (auth.uid() = profile_id);

-- ═══════════════════════════════════════════════════════════════════════
-- Catalogues: skills / interests / roles (+ alias tables) -- read-only
-- reference data for students, admin-managed writes.
-- ═══════════════════════════════════════════════════════════════════════
alter table skills enable row level security;
alter table skill_aliases enable row level security;
alter table interests enable row level security;
alter table interest_aliases enable row level security;
alter table roles enable row level security;

create policy skills_select on skills for select using (is_active or is_admin(auth.uid()));
create policy skills_admin_write on skills for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy skill_aliases_select on skill_aliases for select using (true);
create policy skill_aliases_admin_write on skill_aliases for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy interests_select on interests for select using (is_active or is_admin(auth.uid()));
create policy interests_admin_write on interests for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy interest_aliases_select on interest_aliases for select using (true);
create policy interest_aliases_admin_write on interest_aliases for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy roles_select on roles for select using (true);
create policy roles_admin_write on roles for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- student_skills / student_interests / student_preferred_roles
-- ═══════════════════════════════════════════════════════════════════════
alter table student_skills enable row level security;
alter table student_interests enable row level security;
alter table student_preferred_roles enable row level security;

create policy student_skills_select on student_skills for select
  using (can_view_profile(student_id));
create policy student_skills_write on student_skills for all
  using (auth.uid() = student_id) with check (auth.uid() = student_id);

create policy student_interests_select on student_interests for select
  using (can_view_profile(student_id));
create policy student_interests_write on student_interests for all
  using (auth.uid() = student_id) with check (auth.uid() = student_id);

create policy student_preferred_roles_select on student_preferred_roles for select
  using (can_view_profile(student_id));
create policy student_preferred_roles_write on student_preferred_roles for all
  using (auth.uid() = student_id) with check (auth.uid() = student_id);

-- ═══════════════════════════════════════════════════════════════════════
-- projects
-- ═══════════════════════════════════════════════════════════════════════
alter table projects enable row level security;

create policy projects_select on projects for select
  using (not is_blocked_pair(auth.uid(), creator_id));

create policy projects_insert on projects for insert
  with check (
    auth.uid() = creator_id
    and exists (select 1 from profiles where id = auth.uid() and account_status = 'verified')
  );

create policy projects_update on projects for update
  using (auth.uid() = creator_id or is_admin(auth.uid()));

create policy projects_delete on projects for delete
  using (auth.uid() = creator_id or is_admin(auth.uid()));

-- project_required_skills / project_required_roles / project_interests
alter table project_required_skills enable row level security;
alter table project_required_roles enable row level security;
alter table project_interests enable row level security;

create policy project_required_skills_select on project_required_skills for select using (true);
create policy project_required_skills_write on project_required_skills for all
  using (exists (select 1 from projects p where p.id = project_id and p.creator_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.creator_id = auth.uid()));

create policy project_required_roles_select on project_required_roles for select using (true);
create policy project_required_roles_write on project_required_roles for all
  using (exists (select 1 from projects p where p.id = project_id and p.creator_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.creator_id = auth.uid()));

create policy project_interests_select on project_interests for select using (true);
create policy project_interests_write on project_interests for all
  using (exists (select 1 from projects p where p.id = project_id and p.creator_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.creator_id = auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- project_members -- no direct client INSERT; only via the application-
-- accept trigger. UPDATE covers "leave" (self) and "remove" (owner).
-- ═══════════════════════════════════════════════════════════════════════
alter table project_members enable row level security;

create policy project_members_select on project_members for select using (true);

create policy project_members_update on project_members for update
  using (
    student_id = auth.uid()
    or exists (select 1 from projects p where p.id = project_id and p.creator_id = auth.uid())
    or is_admin(auth.uid())
  );

create policy project_members_delete on project_members for delete
  using (
    student_id = auth.uid()
    or exists (select 1 from projects p where p.id = project_id and p.creator_id = auth.uid())
    or is_admin(auth.uid())
  );
-- No INSERT policy: rows are created by fn_application_decided() and by
-- fn_create_project_conversation() for the owner, both SECURITY DEFINER.

-- ═══════════════════════════════════════════════════════════════════════
-- project_applications
-- ═══════════════════════════════════════════════════════════════════════
alter table project_applications enable row level security;

create policy project_applications_select on project_applications for select
  using (
    applicant_id = auth.uid()
    or exists (select 1 from projects p where p.id = project_id and p.creator_id = auth.uid())
    or is_admin(auth.uid())
  );

create policy project_applications_insert on project_applications for insert
  with check (
    applicant_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and account_status = 'verified')
    and not exists (
      select 1 from project_members pm
       where pm.project_id = project_applications.project_id
         and pm.student_id = auth.uid() and pm.left_at is null
    )
  );

create policy project_applications_update on project_applications for update
  using (exists (select 1 from projects p where p.id = project_id and p.creator_id = auth.uid())
         or is_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- connections
-- ═══════════════════════════════════════════════════════════════════════
alter table connections enable row level security;

create policy connections_select on connections for select
  using (requester_id = auth.uid() or addressee_id = auth.uid() or is_admin(auth.uid()));

create policy connections_insert on connections for insert
  with check (
    requester_id = auth.uid()
    and not is_blocked_pair(requester_id, addressee_id)
  );

create policy connections_update on connections for update
  using (addressee_id = auth.uid() or is_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- blocked_users
-- ═══════════════════════════════════════════════════════════════════════
alter table blocked_users enable row level security;

create policy blocked_users_select on blocked_users for select
  using (blocker_id = auth.uid() or is_admin(auth.uid()));
create policy blocked_users_insert on blocked_users for insert
  with check (blocker_id = auth.uid());
create policy blocked_users_delete on blocked_users for delete
  using (blocker_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- reports
-- ═══════════════════════════════════════════════════════════════════════
alter table reports enable row level security;

create policy reports_select on reports for select
  using (reporter_id = auth.uid() or is_admin(auth.uid()));
create policy reports_insert on reports for insert
  with check (reporter_id = auth.uid());
create policy reports_update_admin on reports for update
  using (is_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- discovery_skips
-- ═══════════════════════════════════════════════════════════════════════
alter table discovery_skips enable row level security;

create policy discovery_skips_all on discovery_skips for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- conversations / conversation_members / messages
-- ═══════════════════════════════════════════════════════════════════════
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;

create policy conversations_select on conversations for select
  using (
    exists (select 1 from conversation_members cm
             where cm.conversation_id = id and cm.user_id = auth.uid())
    or is_admin(auth.uid())
  );
-- No client INSERT: created only by fn_create_project_conversation() and
-- fn_connection_decided(), both SECURITY DEFINER.

create policy conversation_members_select on conversation_members for select
  using (
    exists (select 1 from conversation_members cm2
             where cm2.conversation_id = conversation_members.conversation_id
               and cm2.user_id = auth.uid())
    or is_admin(auth.uid())
  );

create policy conversation_members_update_self on conversation_members for update
  using (user_id = auth.uid());
-- (used to bump last_read_at; membership rows themselves are otherwise
-- managed by fn_sync_project_conversation_members() / connection triggers)

create policy messages_select on messages for select
  using (
    exists (select 1 from conversation_members cm
             where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid())
  );

create policy messages_insert on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (select 1 from conversation_members cm
                 where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════
-- notifications -- own only; no client INSERT (triggers write these as
-- SECURITY DEFINER, bypassing the need for a broad insert policy here).
-- ═══════════════════════════════════════════════════════════════════════
alter table notifications enable row level security;

create policy notifications_select on notifications for select
  using (user_id = auth.uid());
create policy notifications_update_self on notifications for update
  using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- project_feedback
-- ═══════════════════════════════════════════════════════════════════════
alter table project_feedback enable row level security;

create policy project_feedback_select on project_feedback for select
  using (from_user_id = auth.uid() or to_user_id = auth.uid() or is_admin(auth.uid()));
create policy project_feedback_insert on project_feedback for insert
  with check (
    from_user_id = auth.uid()
    and exists (select 1 from project_members pm
                 where pm.project_id = project_feedback.project_id and pm.student_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════
-- admin_users / matching_settings -- admin only
-- ═══════════════════════════════════════════════════════════════════════
alter table admin_users enable row level security;
alter table matching_settings enable row level security;

create policy admin_users_select on admin_users for select
  using (id = auth.uid() or is_admin(auth.uid()));
-- No client INSERT/UPDATE/DELETE: manage admin_users via the Supabase
-- dashboard / service-role key only (see SUPABASE_SETUP.md section 8).

create policy matching_settings_select on matching_settings for select
  using (is_admin(auth.uid()));
create policy matching_settings_update on matching_settings for update
  using (is_admin(auth.uid()))
  with check (
    skill_weight + interest_weight + role_weight +
    complementary_weight + availability_weight + other_weight = 100
  );
