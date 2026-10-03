import { supabase } from './supabase';
import { logDbError } from './errors';

/**
 * Every function here calls a SECURITY DEFINER SQL function from
 * MATCHING_ALGORITHM.md -- the ranking/scoring happens in Postgres, this
 * is just a thin client that unwraps the row shape into a plain id list.
 * Never display the numeric score to the student (spec §34); it's only
 * used here for ordering.
 */

export async function fetchRecommendedPartnerIds(projectId: string, limit = 5): Promise<string[]> {
  const { data, error } = await supabase.rpc('fn_recommended_partners', { p_project: projectId, p_limit: limit });
  if (error) {
    logDbError('fn_recommended_partners', error);
    return [];
  }
  return ((data ?? []) as { student_id: string }[]).map((r) => r.student_id);
}

export async function fetchProjectsNeedingSkillsIds(studentId: string, limit = 5): Promise<string[]> {
  const { data, error } = await supabase.rpc('fn_projects_needing_skills', { p_student: studentId, p_limit: limit });
  if (error) {
    logDbError('fn_projects_needing_skills', error);
    return [];
  }
  return ((data ?? []) as { project_id: string }[]).map((r) => r.project_id);
}

export async function fetchComplementaryCandidateIds(projectId: string, groupSize = 3): Promise<string[]> {
  const { data, error } = await supabase.rpc('fn_group_recommendation', {
    p_project: projectId,
    p_group_size: groupSize,
  });
  if (error) {
    logDbError('fn_group_recommendation', error);
    return [];
  }
  return ((data ?? []) as { out_student_id: string }[]).map((r) => r.out_student_id);
}

export async function fetchDiscoverCandidateId(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('fn_discover_candidate', { p_user: userId });
  if (error) {
    logDbError('fn_discover_candidate', error);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function skipDiscoverCandidate(userId: string, skippedId: string): Promise<void> {
  await supabase.from('discovery_skips').insert({ user_id: userId, skipped_user_id: skippedId });
}

/** Recommended Partners / Complementary Skills are project-scoped in the
 * matching engine, but Home and Discover show them without the student
 * picking a project first -- so we use their own most recently created
 * still-open project as the implicit context. Returns null if they don't
 * own one yet, which the screen turns into a "create a project" prompt. */
export async function fetchMyLatestOpenProjectId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('creator_id', userId)
    .in('status', ['looking_for_members', 'team_forming'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
