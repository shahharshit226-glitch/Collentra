-- 0001_extensions_enums.sql
-- Extensions and enum types used across the schema.

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive text (emails, usernames)

create type account_status as enum (
  'pending', 'verified', 'suspended', 'blocked', 'deleted'
);

create type collab_hours_range as enum (
  '0-5', '5-10', '10-15', '15+'
);

create type days_preference as enum (
  'weekdays', 'weekends', 'both'
);

create type project_status as enum (
  'looking_for_members', 'team_forming', 'full',
  'in_progress', 'completed', 'archived'
);

create type application_status as enum (
  'pending', 'accepted', 'rejected', 'withdrawn'
);

create type connection_status as enum (
  'pending', 'accepted', 'rejected'
);

create type report_category as enum (
  'spam', 'fake_account', 'harassment',
  'inappropriate_content', 'misuse', 'other'
);

create type report_status as enum (
  'open', 'reviewed', 'actioned', 'dismissed'
);

create type conversation_type as enum (
  'direct', 'project'
);

create type notification_type as enum (
  'connection_request', 'connection_accepted', 'project_application',
  'application_accepted', 'application_rejected', 'project_invitation',
  'new_message', 'team_update', 'skill_match_project'
);

create type admin_role as enum (
  'super_admin', 'moderator'
);
