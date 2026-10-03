-- 0013_indexes.sql
-- Indexes chosen against the actual query patterns in DATABASE.md /
-- MATCHING_ALGORITHM.md, not speculative full-table coverage.

-- Profile lookup & discovery filtering
create index idx_profiles_account_status on profiles (account_status);
create index idx_profiles_available on profiles (is_available_to_collaborate) where is_available_to_collaborate;
-- username already has a unique index from the column constraint.

-- Skill/interest/role joins (the matching engine's hot path)
create index idx_student_skills_skill on student_skills (skill_id);
create index idx_student_skills_student on student_skills (student_id);
create index idx_student_interests_interest on student_interests (interest_id);
create index idx_student_interests_student on student_interests (student_id);
create index idx_student_preferred_roles_role on student_preferred_roles (role_id);

create index idx_project_required_skills_project on project_required_skills (project_id);
create index idx_project_required_skills_skill on project_required_skills (skill_id);
create index idx_project_required_roles_project on project_required_roles (project_id);
create index idx_project_interests_project on project_interests (project_id);
create index idx_project_interests_interest on project_interests (interest_id);

-- Project browsing / "Projects Needing You"
create index idx_projects_status on projects (status);
create index idx_projects_creator on projects (creator_id);
create index idx_projects_domain on projects (domain);

create index idx_project_members_student on project_members (student_id) where left_at is null;
create index idx_project_members_project on project_members (project_id) where left_at is null;

create index idx_project_applications_project_status on project_applications (project_id, status);
create index idx_project_applications_applicant on project_applications (applicant_id);

-- Connections / blocking
create index idx_connections_requester on connections (requester_id, status);
create index idx_connections_addressee on connections (addressee_id, status);
create index idx_blocked_users_blocker on blocked_users (blocker_id);
create index idx_blocked_users_blocked on blocked_users (blocked_id);

-- Chat (messages ordered per conversation is the single hottest read)
create index idx_messages_conversation_created on messages (conversation_id, created_at desc);
create index idx_conversation_members_user on conversation_members (user_id);

-- Notifications inbox
create index idx_notifications_user_unread on notifications (user_id, is_read, created_at desc);

-- Discovery skip window check
create index idx_discovery_skips_user_created on discovery_skips (user_id, created_at desc);

-- Reports triage
create index idx_reports_status on reports (status);
