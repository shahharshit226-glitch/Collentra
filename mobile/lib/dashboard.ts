import { supabase } from './supabase';

export type DashboardProject = { id: string; title: string; status: string; role: string; bucket: 'owned' | 'member' | 'applied'; application_status: string | null };
export type StudentDashboard = {
  profile: { id: string; username: string; full_name: string; branch: string | null; year: number | null; bio: string | null } | null;
  skills: string[];
  interests: string[];
  projects: DashboardProject[];
  stats: { active: number; pending: number; connections: number; completed: number };
};

type ProfileRecord = NonNullable<StudentDashboard['profile']>;

async function getStudentDashboardFromTables(): Promise<{ data: StudentDashboard | null; error: string | null }> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return { data: null, error: 'Sign in to view your dashboard.' };

  const [profileResult, skillResult, interestResult, ownedResult, memberResult, applicationResult, connectionResult] = await Promise.all([
    supabase.from('profiles').select('id, username, full_name, branch, year, bio').eq('id', userId).maybeSingle(),
    supabase.from('student_skills').select('skills(name)').eq('student_id', userId),
    supabase.from('student_interests').select('interests(name)').eq('student_id', userId),
    supabase.from('projects').select('id, title, status, creator_id, created_at').eq('creator_id', userId).order('created_at', { ascending: false }),
    supabase.from('project_members').select('is_owner, projects(id, title, status, creator_id, created_at), roles(name)').eq('student_id', userId).is('left_at', null),
    supabase.from('project_applications').select('created_at, status, projects(id, title, status, creator_id, created_at)').eq('applicant_id', userId).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('connections').select('id', { count: 'exact', head: true }).eq('status', 'accepted').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
  ]);

  const firstError = profileResult.error ?? skillResult.error ?? interestResult.error ?? ownedResult.error ?? memberResult.error ?? applicationResult.error ?? connectionResult.error;
  if (firstError) return { data: null, error: firstError.message || "Couldn't load your dashboard details." };
  const profile = profileResult.data as ProfileRecord | null;
  if (!profile) return { data: null, error: 'Your student profile could not be found. Please sign out and sign in again.' };

  type ProjectRow = { id: string; title: string; status: string; creator_id: string; created_at: string };
  type Relation<T> = T | T[] | null;
  const one = <T,>(value: Relation<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
  const projectItem = (p: ProjectRow, role: string, bucket: DashboardProject['bucket'], application_status: string | null = null): DashboardProject => ({
    id: p.id, title: p.title, status: p.status, role, bucket, application_status,
  });

  const owned = (ownedResult.data ?? []).map((p) => projectItem(p as ProjectRow, 'Owner', 'owned'));
  const members = (memberResult.data ?? []).flatMap((row) => {
    if (row.is_owner) return [];
    const project = one(row.projects as Relation<ProjectRow>);
    if (!project) return [];
    const role = one(row.roles as Relation<{ name: string }>)?.name ?? 'Member';
    return [projectItem(project, role, 'member')];
  });
  const applications = (applicationResult.data ?? []).flatMap((row) => {
    const project = one(row.projects as Relation<ProjectRow>);
    return project ? [projectItem(project, 'Applicant', 'applied', row.status)] : [];
  });
  const involvement = [...owned, ...members];
  const getNames = <T extends { name: string }>(rows: unknown[] | null, key: string) => (rows ?? []).flatMap((row) => {
    const relation = (row as Record<string, Relation<T>>)[key];
    const item = one(relation);
    return item?.name ? [item.name] : [];
  });

  return {
    data: {
      profile,
      skills: getNames(skillResult.data as unknown[] | null, 'skills'),
      interests: getNames(interestResult.data as unknown[] | null, 'interests'),
      projects: [...involvement, ...applications],
      stats: {
        active: involvement.filter((p) => !['completed', 'archived'].includes(p.status)).length,
        pending: applications.length,
        connections: connectionResult.count ?? 0,
        completed: involvement.filter((p) => p.status === 'completed').length,
      },
    },
    error: null,
  };
}

export async function getStudentDashboard(): Promise<{ data: StudentDashboard | null; error: string | null }> {
  const { data, error } = await supabase.rpc('fn_student_dashboard');
  if (error) return getStudentDashboardFromTables();
  return { data: data as StudentDashboard, error: null };
}

export async function leaveProject(projectId: string, reason: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('fn_leave_project', { p_project_id: projectId, p_reason: reason.trim() || null });
  if (!error) return { error: null };
  const message = error.message ?? '';
  if (message.includes('Owners cannot leave')) return { error: 'As the owner, transfer ownership or close the project instead.' };
  return { error: message.includes('Active membership') ? 'You are no longer an active member of this project.' : "Couldn't leave the project. Please try again." };
}

export async function transferProjectOwnership(projectId: string, studentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('fn_transfer_project_ownership', { p_project_id: projectId, p_student_id: studentId });
  return { error: error ? "Couldn't transfer project ownership. Refresh and try again." : null };
}
