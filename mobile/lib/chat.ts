import { supabase } from './supabase';
import { describeDbError, logDbError } from './errors';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ConversationSummary = {
  id: string;
  type: 'direct' | 'project';
  title: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: boolean;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type ConversationMember = { user_id: string; full_name: string; username: string };

type RawConversationRow = {
  id: string;
  type: 'direct' | 'project';
  projects: { title: string } | null;
  conversation_members: { user_id: string; last_read_at: string | null; profiles: { full_name: string; username: string } | null }[];
};

export async function listConversations(userId: string): Promise<{ data: ConversationSummary[]; error: string | null }> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id, type,
      projects ( title ),
      conversation_members ( user_id, last_read_at, profiles ( full_name, username ) )
    `);

  if (error) {
    logDbError('listConversations', error);
    return { data: [], error: describeDbError(error, "Couldn't load your conversations.") };
  }

  const rows = data as unknown as RawConversationRow[];
  if (rows.length === 0) return { data: [], error: null };

  // One extra query for the most recent message per conversation --
  // simpler and cheaper than a per-row subquery, and RLS still applies.
  const ids = rows.map((r) => r.id);
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('conversation_id, sender_id, content, created_at')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false });

  const lastByConversation = new Map<string, { sender_id: string; content: string; created_at: string }>();
  for (const m of recentMessages ?? []) {
    if (!lastByConversation.has(m.conversation_id)) lastByConversation.set(m.conversation_id, m);
  }

  const summaries = rows.map((row): ConversationSummary => {
    const last = lastByConversation.get(row.id) ?? null;
    const myMembership = row.conversation_members.find((m) => m.user_id === userId);

    let title: string;
    if (row.type === 'project') {
      title = row.projects?.title ?? 'Project chat';
    } else {
      const other = row.conversation_members.find((m) => m.user_id !== userId);
      title = other?.profiles?.full_name ?? 'Direct message';
    }

    const unread = !!last && last.sender_id !== userId && (!myMembership?.last_read_at || last.created_at > myMembership.last_read_at);

    return {
      id: row.id,
      type: row.type,
      title,
      lastMessage: last?.content ?? null,
      lastMessageAt: last?.created_at ?? null,
      unread,
    };
  });

  // Most recently active conversation first.
  summaries.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  return { data: summaries, error: null };
}

export async function getProjectConversationId(projectId: string): Promise<string | null> {
  const { data } = await supabase.from('conversations').select('id').eq('project_id', projectId).eq('type', 'project').maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function getConversationMembers(conversationId: string): Promise<ConversationMember[]> {
  const { data } = await supabase
    .from('conversation_members')
    .select('user_id, profiles ( full_name, username )')
    .eq('conversation_id', conversationId);
  const rows = (data ?? []) as unknown as { user_id: string; profiles: { full_name: string; username: string } | null }[];
  return rows.map((r) => ({ user_id: r.user_id, full_name: r.profiles?.full_name ?? 'Unknown', username: r.profiles?.username ?? '—' }));
}

export async function getMessages(conversationId: string): Promise<{ data: ChatMessage[]; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    logDbError('getMessages', error);
    return { data: [], error: describeDbError(error, "Couldn't load messages.") };
  }
  return { data: data as ChatMessage[], error: null };
}

export async function sendMessage(conversationId: string, content: string): Promise<{ data: ChatMessage | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const senderId = sessionData.session?.user.id;
  if (!senderId) return { data: null, error: 'Please sign in again.' };

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select('id, conversation_id, sender_id, content, created_at')
    .single();

  if (error) {
    logDbError('sendMessage', error);
    return { data: null, error: describeDbError(error, "Couldn't send that message. Try again.") };
  }
  return { data: data as ChatMessage, error: null };
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
}

/** Subscribes to new messages in one conversation. Call the returned
 * cleanup function when the screen unmounts (spec §98 -- don't leave
 * Realtime channels open longer than the screen that needs them). */
export function subscribeToMessages(conversationId: string, onInsert: (message: ChatMessage) => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as ChatMessage)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
