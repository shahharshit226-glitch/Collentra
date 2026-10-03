import { supabase } from './supabase';
import { describeDbError, logDbError } from './errors';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  ApplicationRow,
  ApplicationStatus,
  HoursRange,
  MemberRow,
  ProjectDetail,
  ProjectSummary,
} from './types';

const SUMMARY_SELECT = `
  id, title, domain, status, team_size, current_member_count, creator_id, created_at,
  project_required_skills ( skills ( name ) )
`;

type RawSummaryRow = Omit<ProjectSummary, 'required_skill_names'> & {
  project_required_skills: { skills: { name: string } | null }[] | null;
};

function toSummary(row: RawSummaryRow): ProjectSummary {
  const { project_required_skills, ...rest } = row;
  return {
    ...rest,
    required_skill_names: (project_required_skills ?? [])
      .map((r) => r.skills?.name)
      .filter((n): n is string => Boolean(n)),
  };
}

export async function listOpenProjects(): Promise<{ data: ProjectSummary[]; error: string | null }> {
  const { data, error } = await supabase
    .from('projects')
    .select(SUMMARY_SELECT)
    .in('status', ['looking_for_members', 'team_forming'])
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return { data: [], error: "Couldn't load projects. Pull down to try again." };
  return { data: (data as unknown as RawSummaryRow[]).map(toSummary), error: null };
}

export async function listMyProjects(userId: string): Promise<{ data: ProjectSummary[]; error: string | null }> {
  const [created, memberOf] = await Promise.all([
    supabase.from('projects').select(SUMMARY_SELECT).eq('creator_id', userId),
    supabase
      .from('project_members')
      .select(`projects ( ${SUMMARY_SELECT} )`)
      .eq('student_id', userId)
      .is('left_at', null),
  ]);

  if (created.error || memberOf.error) {
    return { data: [], error: "Couldn't load your projects. Pull down to try again." };
  }

  const fromCreated = (created.data as unknown as RawSummaryRow[]).map(toSummary);
  const fromMembership = (memberOf.data as unknown as { projects: RawSummaryRow }[])
    .map((r) => r.projects)
    .filter(Boolean)
    .map(toSummary);

  const byId = new Map<string, ProjectSummary>();
  [...fromCreated, ...fromMembership].forEach((p) => byId.set(p.id, p));
  return { data: Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at)), error: null };
}

/** Preserves the order of `ids` -- used for matching-engine results, where
 * the ranking is the entire point (see fetchStudentCards for the same
 * pattern on the student side). */
export async function listProjectsByIds(ids: string[]): Promise<{ data: ProjectSummary[]; error: string | null }> {
  if (ids.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.from('projects').select(SUMMARY_SELECT).in('id', ids);
  if (error) return { data: [], error: "Couldn't load projects." };
  const byId = new Map((data as unknown as RawSummaryRow[]).map((r) => [r.id, toSummary(r)]));
  return { data: ids.map((id) => byId.get(id)).filter((p): p is ProjectSummary => Boolean(p)), error: null };
}

export async function getProjectDetail(id: string): Promise<{ data: ProjectDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from('projects')
    .select(`${SUMMARY_SELECT}, description, expected_hours_per_week`)
    .eq('id', id)
    .single();
  if (error || !data) return { data: null, error: "Couldn't load this project." };
  const row = data as unknown as RawSummaryRow & { description: string; expected_hours_per_week: HoursRange | null };
  return { data: { ...toSummary(row), description: row.description, expected_hours_per_week: row.expected_hours_per_week }, error: null };
}

export async function getProjectMembers(projectId: string): Promise<{ data: MemberRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('project_members')
    .select('student_id, is_owner, profiles ( full_name, username )')
    .eq('project_id', projectId)
    .is('left_at', null);
  if (error) return { data: [], error: "Couldn't load the team." };
  const rows = data as unknown as { student_id: string; is_owner: boolean; profiles: { full_name: string; username: string } | null }[];
  return {
    data: rows.map((r) => ({
      student_id: r.student_id,
      is_owner: r.is_owner,
      full_name: r.profiles?.full_name ?? 'Unknown',
      username: r.profiles?.username ?? '—',
    })),
    error: null,
  };
}

/** Only returns real rows for the caller: RLS lets a project's creator see
 * every applicant, and lets an applicant see only their own row. */
export async function getProjectApplications(
  projectId: string
): Promise<{ data: ApplicationRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('project_applications')
    .select('id, applicant_id, message, status, created_at, profiles ( full_name, username )')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: "Couldn't load applications." };
  const rows = data as unknown as {
    id: string;
    applicant_id: string;
    message: string | null;
    status: ApplicationStatus;
    created_at: string;
    profiles: { full_name: string; username: string } | null;
  }[];
  return {
    data: rows.map((r) => ({
      id: r.id,
      applicant_id: r.applicant_id,
      message: r.message,
      status: r.status,
      created_at: r.created_at,
      applicant_name: r.profiles?.full_name ?? 'Unknown',
      applicant_username: r.profiles?.username ?? '—',
    })),
    error: null,
  };
}

export type ProjectApplicationInboxItem = {
  id: string;
  project_id: string;
  project_title: string;
  applicant_id: string;
  applicant_name: string;
  applicant_username: string;
  message: string | null;
  created_at: string;
};

/** Lists pending applications for projects owned by the signed-in student. */
export async function listIncomingProjectApplications(): Promise<{
  data: ProjectApplicationInboxItem[];
  error: string | null;
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { data: [], error: 'Please sign in again.' };

  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id, title')
    .eq('creator_id', userId);
  if (projectError) {
    logDbError('listIncomingProjectApplications.projects', projectError);
    return { data: [], error: describeDbError(projectError, "Couldn't load your project applications.") };
  }

  const titles = new Map((projects ?? []).map((project) => [project.id as string, project.title as string]));
  const projectIds = [...titles.keys()];
  if (projectIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('project_applications')
    .select('id, project_id, applicant_id, message, created_at, profiles ( full_name, username )')
    .in('project_id', projectIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    logDbError('listIncomingProjectApplications.applications', error);
    return { data: [], error: describeDbError(error, "Couldn't load your project applications.") };
  }

  const rows = data as unknown as {
    id: string;
    project_id: string;
    applicant_id: string;
    message: string | null;
    created_at: string;
    profiles: { full_name: string; username: string } | null;
  }[];
  return {
    data: rows.map((row) => ({
      id: row.id,
      project_id: row.project_id,
      project_title: titles.get(row.project_id) ?? 'Project',
      applicant_id: row.applicant_id,
      applicant_name: row.profiles?.full_name ?? 'Unknown',
      applicant_username: row.profiles?.username ?? '—',
      message: row.message,
      created_at: row.created_at,
    })),
    error: null,
  };
}

/** Refresh the project request inbox as new application rows are inserted. */
export function subscribeToProjectApplications(onInsert: () => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel('project-applications-inbox')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'project_applications' },
      () => onInsert()
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

export async function createProject(input: {
  title: string;
  description: string;
  domain: string | null;
  teamSize: number;
  expectedHours: HoursRange | null;
  skillIds: string[];
  roleIds: string[];
}): Promise<{ id: string | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { id: null, error: 'Please sign in again to create a project.' };

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      // Required by the insert policy (creator_id must equal auth.uid())
      // and by the NOT NULL column -- the database can't fill this in.
      creator_id: userId,
      title: input.title,
      description: input.description,
      domain: input.domain,
      team_size: input.teamSize,
      expected_hours_per_week: input.expectedHours,
    })
    .select('id')
    .single();

  if (projectError || !project) {
    logDbError('createProject', projectError);
    return { id: null, error: describeDbError(projectError, "Couldn't create the project. Please try again.") };
  }

  const projectId = project.id as string;

  if (input.skillIds.length > 0) {
    const { error } = await supabase
      .from('project_required_skills')
      .insert(input.skillIds.map((skill_id) => ({ project_id: projectId, skill_id })));
    if (error) return { id: projectId, error: 'Project created, but adding required skills failed.' };
  }
  if (input.roleIds.length > 0) {
    const { error } = await supabase
      .from('project_required_roles')
      .insert(input.roleIds.map((role_id) => ({ project_id: projectId, role_id })));
    if (error) return { id: projectId, error: 'Project created, but adding required roles failed.' };
  }

  return { id: projectId, error: null };
}

export async function applyToProject(projectId: string, message: string): Promise<{ error: string | null }> {
  const { data: session } = await supabase.auth.getSession();
  const applicantId = session.session?.user.id;
  if (!applicantId) return { error: 'Not signed in.' };

  const { error } = await supabase
    .from('project_applications')
    .insert({ project_id: projectId, applicant_id: applicantId, message: message || null });

  if (error) {
    // Most likely cause given our schema: the partial unique index
    // project_applications_one_pending -- you already have a pending
    // application for this project.
    logDbError('applyToProject', error);
    if (error.code === '23505') {
      return { error: "You've already applied to this project — waiting on a decision." };
    }
    return { error: describeDbError(error, "Couldn't submit your application. Please try again.") };
  }
  return { error: null };
}

export async function getMyApplicationStatus(
  projectId: string,
  userId: string
): Promise<ApplicationStatus | null> {
  const { data } = await supabase
    .from('project_applications')
    .select('status')
    .eq('project_id', projectId)
    .eq('applicant_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.status as ApplicationStatus | undefined) ?? null;
}

export async function decideApplication(
  applicationId: string,
  status: 'accepted' | 'rejected'
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('project_applications').update({ status }).eq('id', applicationId);
  if (error) {
    logDbError('decideApplication', error);
    return { error: describeDbError(error, "Couldn't update that application. Try again.") };
  }
  return { error: null };
}
