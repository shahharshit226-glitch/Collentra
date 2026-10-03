import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  applyToProject,
  decideApplication,
  getMyApplicationStatus,
  getProjectApplications,
  getProjectDetail,
  getProjectMembers,
} from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { getProjectConversationId } from '@/lib/chat';
import { leaveProject } from '@/lib/dashboard';
import type { ApplicationRow, ApplicationStatus, MemberRow, ProjectDetail } from '@/lib/types';
import { Badge, Button, Card, ErrorState, Input, Skeleton } from '@/components/ui';
import { Toast } from '@/components/ui/Toast';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, type, fontFamily } = useTheme();
  const { session } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [myStatus, setMyStatus] = useState<ApplicationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applySent, setApplySent] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const isCreator = !!session && project?.creator_id === session.user.id;
  const isMember = members.some((m) => m.student_id === session?.user.id);

  const load = useCallback(async () => {
    if (!id || !session) return;
    setError(null);
    const [detail, memberList] = await Promise.all([getProjectDetail(id), getProjectMembers(id)]);
    if (!detail.data) {
      setError(detail.error ?? 'Project not found.');
      setLoading(false);
      return;
    }
    setProject(detail.data);
    setMembers(memberList.data);

    const amMember = memberList.data.some((m) => m.student_id === session.user.id);
    if (amMember) {
      setConversationId(await getProjectConversationId(id));
    }

    if (detail.data.creator_id === session.user.id) {
      const apps = await getProjectApplications(id);
      setApplications(apps.data);
    } else {
      const status = await getMyApplicationStatus(id, session.user.id);
      setMyStatus(status);
    }
    setLoading(false);
  }, [id, session]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`project-members:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${id}` },
        () => { void load(); }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  async function handleApply() {
    if (!id) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setApplying(true);
    const { error } = await applyToProject(id, applyMessage.trim());
    setApplying(false);
    if (error) {
      setError(error);
      return;
    }
    setApplySent(true);
    setMyStatus('pending');
  }

  async function handleDecide(applicationId: string, status: 'accepted' | 'rejected') {
    const { error } = await decideApplication(applicationId, status);
    if (error) {
      setError(error);
      return;
    }
    load(); // membership/current_member_count changed via the DB trigger -- refetch to show it
  }

  async function handleLeave() {
    if (!id || !session || isCreator) return;
    setLeaving(true);
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await leaveProject(id, leaveReason);
    setLeaving(false);
    if (error) {
      setError(error);
      return;
    }
    setLeaveDialog(false);
    await load();
    setToast('You left the project. The owner has been notified.');
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.lg }}>
        <Skeleton height={34} width="75%" /><Skeleton height={18} width="40%" /><Skeleton height={120} /><Skeleton height={100} />
      </SafeAreaView>
    );
  }

  if (error && !project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState description={error} onRetry={load} />
      </SafeAreaView>
    );
  }
  if (!project) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize }}>
            {project.title}
          </Text>
          {project.domain ? (
            <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
              {project.domain}
            </Text>
          ) : null}
        </View>

        <Text style={{ color: colors.ink, fontFamily: fontFamily.body.regular, fontSize: type.body.fontSize }}>
          {project.description}
        </Text>

        {project.required_skill_names.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: 13 }}>
              Required skills
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {project.required_skill_names.map((name) => (
                <Badge key={name} label={name} tone="primary" />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: 13 }}>
            Team {project.current_member_count} / {project.team_size}
          </Text>
          {members.map((m) => (
            <Text key={m.student_id} style={{ color: colors.ink, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
              {m.full_name} {m.is_owner ? '(Owner)' : ''}
            </Text>
          ))}
        </View>

        {conversationId ? (
          <Button label="Open team chat" onPress={() => router.push(`/chat/${conversationId}`)} variant="secondary" />
        ) : null}

        {error ? (
          <Text style={{ color: colors.danger, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
            {error}
          </Text>
        ) : null}

        {isCreator ? (
          <View style={{ gap: spacing.sm }}>
            <Card style={{ gap: spacing.xs }}>
              <Text style={{ color: colors.ink, fontFamily: fontFamily.body.semibold, fontSize: type.body.fontSize }}>You own this project</Text>
              <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>Owners cannot leave while responsible for a project. Transfer ownership to an active member or close the project.</Text>
              {members.filter((m) => m.student_id !== session?.user.id).map((member) => <Button key={member.student_id} label={`Transfer ownership to ${member.full_name}`} size="sm" variant="secondary" onPress={() => Alert.alert('Transfer ownership?', `${member.full_name} will become the project owner.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Transfer', onPress: async () => {
                const { error } = await supabase.rpc('fn_transfer_project_ownership', { p_project_id: id, p_student_id: member.student_id });
                if (error) setError("Couldn't transfer ownership. Try again."); else await load();
              } }])} />)}
              <Button label="Close project" size="sm" variant="danger" onPress={() => Alert.alert('Close project?', 'This will archive the project and stop new applications.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Close project', style: 'destructive', onPress: async () => {
                const { error } = await supabase.from('projects').update({ status: 'archived' }).eq('id', id);
                if (error) setError("Couldn't close this project. Try again."); else await load();
              } }])} />
            </Card>
            <Text style={{ color: colors.ink, fontFamily: fontFamily.display.medium, fontSize: type.h3.fontSize }}>
              Applications
            </Text>
            {applications.length === 0 ? (
              <Text style={{ color: colors.inkFaint, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
                No applications yet.
              </Text>
            ) : (
              applications.map((app) => (
                <Card key={app.id} style={{ gap: spacing.xs }}>
                  <Text style={{ color: colors.ink, fontFamily: fontFamily.body.semibold, fontSize: type.bodySmall.fontSize }}>
                    {app.applicant_name} · @{app.applicant_username}
                  </Text>
                  {app.message ? (
                    <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
                      {app.message}
                    </Text>
                  ) : null}
                  {app.status === 'pending' ? (
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                      <Button label="Accept" onPress={() => handleDecide(app.id, 'accepted')} size="sm" />
                      <Button label="Reject" onPress={() => handleDecide(app.id, 'rejected')} variant="secondary" size="sm" />
                    </View>
                  ) : (
                    <Badge label={app.status} tone={app.status === 'accepted' ? 'success' : 'neutral'} />
                  )}
                </Card>
              ))
            )}
          </View>
        ) : isMember ? (
          <Button label="Leave project" onPress={() => setLeaveDialog(true)} variant="danger" />
        ) : applySent || myStatus === 'pending' ? (
          <Badge label="Application pending" tone="warning" />
        ) : myStatus === 'rejected' ? (
          <View style={{ gap: spacing.sm }}>
            <Badge label="Application not accepted — you can re-apply" tone="neutral" />
            <Input placeholder="Why do you want to join? (optional)" value={applyMessage} onChangeText={setApplyMessage} />
            <Button label="Apply again" onPress={handleApply} loading={applying} />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Input placeholder="Why do you want to join? (optional)" value={applyMessage} onChangeText={setApplyMessage} />
            <Button label="Apply to Join" onPress={handleApply} loading={applying} />
          </View>
        )}
      </ScrollView>
      <Modal visible={leaveDialog} transparent animationType="slide" onRequestClose={() => setLeaveDialog(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, gap: spacing.md }}>
            <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h2.fontSize }}>Leave this project?</Text>
            <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>Your membership history stays recorded. You will leave the team chat and the owner will be notified.</Text>
            <TextInput value={leaveReason} onChangeText={setLeaveReason} placeholder="Reason (optional)" placeholderTextColor={colors.inkFaint} multiline style={{ color: colors.ink, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 12, minHeight: 76, padding: spacing.md, textAlignVertical: 'top' }} />
            <Button label="Confirm leave" onPress={handleLeave} variant="danger" loading={leaving} />
            <Pressable onPress={() => setLeaveDialog(false)}><Text style={{ color: colors.inkMuted, textAlign: 'center', fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>Keep working on this project</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}
