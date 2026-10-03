-- Live project team counts depend on the project row updated by
-- fn_recalc_project_member_count() after project_members changes.
alter publication supabase_realtime add table projects;
