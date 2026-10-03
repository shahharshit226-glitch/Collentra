import { supabase } from './supabase';
import { describeDbError, logDbError } from './errors';

export type StudentCard = {
  id: string;
  full_name: string;
  username: string;
  branch: string | null;
  skill_names: string[];
};

export type IncomingConnectionRequest = {
  id: string;
  student: StudentCard;
};

export type ConnectionState = 'none' | 'outgoing' | 'incoming' | 'connected' | 'rejected' | 'unknown';

const CARD_SELECT = `
  id, full_name, username, branch,
  student_skills ( skills ( name ) )
`;

type RawStudentRow = {
  id: string;
  full_name: string;
  username: string;
  branch: string | null;
  student_skills: { skills: { name: string } | null }[] | null;
};

function toStudentCard(row: RawStudentRow): StudentCard {
  return {
    id: row.id,
    full_name: row.full_name,
    username: row.username,
    branch: row.branch,
    skill_names: (row.student_skills ?? []).map((s) => s.skills?.name).filter((n): n is string => Boolean(n)),
  };
}

/** Fetches the given students and returns them in the SAME order as `ids`
 * -- the matching engine's ranking is the point, so a plain `.in()` query
 * (which does not preserve order) would silently throw away the ranking. */
export async function fetchStudentCards(ids: string[]): Promise<{ data: StudentCard[]; error: string | null }> {
  if (ids.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.from('profiles').select(CARD_SELECT).in('id', ids);
  if (error) {
    logDbError('fetchStudentCards', error);
    return { data: [], error: describeDbError(error, "Couldn't load students.") };
  }
  const byId = new Map((data as unknown as RawStudentRow[]).map((r) => [r.id, toStudentCard(r)]));
  return { data: ids.map((id) => byId.get(id)).filter((s): s is StudentCard => Boolean(s)), error: null };
}

export async function fetchAvailableToCollaborate(
  excludeUserId: string,
  limit = 10
): Promise<{ data: StudentCard[]; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select(CARD_SELECT)
    .eq('is_available_to_collaborate', true)
    .eq('account_status', 'verified')
    .neq('id', excludeUserId)
    .limit(limit);
  if (error) {
    logDbError('fetchAvailableToCollaborate', error);
    return { data: [], error: describeDbError(error, "Couldn't load available students.") };
  }
  return { data: (data as unknown as RawStudentRow[]).map(toStudentCard), error: null };
}

export async function getConnectionState(targetId: string): Promise<ConnectionState> {
  const { data: sessionData } = await supabase.auth.getSession();
  const me = sessionData.session?.user.id;
  if (!me || me === targetId) return 'unknown';

  const [outgoing, incoming] = await Promise.all([
    supabase.from('connections').select('status').eq('requester_id', me).eq('addressee_id', targetId).maybeSingle(),
    supabase.from('connections').select('status').eq('requester_id', targetId).eq('addressee_id', me).maybeSingle(),
  ]);
  if (outgoing.error || incoming.error) return 'unknown';
  if (outgoing.data?.status === 'accepted' || incoming.data?.status === 'accepted') return 'connected';
  if (outgoing.data?.status === 'pending') return 'outgoing';
  if (incoming.data?.status === 'pending') return 'incoming';
  if (outgoing.data?.status === 'rejected' || incoming.data?.status === 'rejected') return 'rejected';
  return 'none';
}

export async function sendConnectionRequest(targetId: string): Promise<{ error: string | null; status: ConnectionState }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const me = sessionData.session?.user.id;
  if (!me) return { error: 'Please sign in again.', status: 'unknown' };

  const existingState = await getConnectionState(targetId);
  if (existingState === 'connected' || existingState === 'outgoing' || existingState === 'incoming') {
    return { error: null, status: existingState };
  }
  if (existingState === 'rejected') {
    return { error: 'A connection request between you was declined.', status: 'rejected' };
  }
  if (existingState === 'unknown') {
    return { error: "Couldn't check this connection. Try again.", status: 'unknown' };
  }

  const { error } = await supabase.from('connections').insert({ requester_id: me, addressee_id: targetId });
  if (error) {
    // Another request may have arrived after the state check. Resolve the
    // symmetric pair again so the UI reports its actual state.
    if (error.code === '23505') {
      const status = await getConnectionState(targetId);
      if (status === 'outgoing' || status === 'incoming' || status === 'connected') return { error: null, status };
      return { error: 'A connection request already exists between you.', status };
    }
    logDbError('sendConnectionRequest', error);
    return { error: describeDbError(error, "Couldn't send the request. Try again."), status: 'none' };
  }
  return { error: null, status: 'outgoing' };
}

/** Lists students who have sent the signed-in user a connection request. */
export async function listIncomingConnectionRequests(): Promise<{ data: IncomingConnectionRequest[]; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const me = sessionData.session?.user.id;
  if (!me) return { data: [], error: 'Please sign in again.' };

  const { data, error } = await supabase
    .from('connections')
    .select('id, requester_id')
    .eq('addressee_id', me)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    logDbError('listIncomingConnectionRequests', error);
    return { data: [], error: describeDbError(error, "Couldn't load connection requests.") };
  }

  const rows = (data ?? []) as { id: string; requester_id: string }[];
  const requesterIds = [...new Set(rows.map((row) => row.requester_id))];
  const { data: students, error: studentError } = await fetchStudentCards(requesterIds);
  if (studentError) return { data: [], error: studentError };
  const byId = new Map(students.map((student) => [student.id, student]));
  return {
    data: rows.flatMap((row) => {
      const student = byId.get(row.requester_id);
      return student ? [{ id: row.id, student }] : [];
    }),
    error: null,
  };
}

export async function rejectConnectionRequest(requestId: string): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const me = sessionData.session?.user.id;
  if (!me) return { error: 'Please sign in again.' };

  const { data, error } = await supabase
    .from('connections')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .eq('addressee_id', me)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) {
    logDbError('rejectConnectionRequest', error);
    return { error: describeDbError(error, "Couldn't reject the request. Try again.") };
  }
  if (!data) return { error: 'This request is no longer pending. Refresh and try again.' };
  return { error: null };
}

/** Atomically accepts a connection and joins its requester to the selected team. */
export async function acceptConnectionToProject(
  requestId: string,
  projectId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('accept_connection_to_project', {
    p_connection_id: requestId,
    p_project_id: projectId,
  });
  if (error) {
    logDbError('acceptConnectionToProject', error);
    const message = error.message ?? '';
    if (message.includes('already full')) return { error: 'This project team is already full.' };
    if (message.includes('Choose one of your open projects')) return { error: 'Choose one of your open projects.' };
    if (message.includes('already on the project team')) return { error: 'This student is already on the project team.' };
    if (message.includes('no longer pending')) return { error: 'This connection request is no longer pending. Refresh and try again.' };
    return { error: describeDbError(error, "Couldn't add this student to the project team. Try again.") };
  }
  return { error: null };
}
