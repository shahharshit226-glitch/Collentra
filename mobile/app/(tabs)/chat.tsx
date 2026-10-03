import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { listConversations, type ConversationSummary } from '@/lib/chat';
import { acceptConnectionToProject, listIncomingConnectionRequests, rejectConnectionRequest, type IncomingConnectionRequest } from '@/lib/students';
import { decideApplication, listIncomingProjectApplications, listMyProjects, subscribeToProjectApplications, type ProjectApplicationInboxItem } from '@/lib/projects';
import type { ProjectSummary } from '@/lib/types';
import { Avatar, Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { StudentCard } from '@/components/StudentCard';

function ConversationRow({ conversation, onPress }: { conversation: ConversationSummary; onPress: () => void }) {
  const { colors, spacing, type, fontFamily } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Avatar name={conversation.title} size={48} />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: colors.ink,
            fontFamily: conversation.unread ? fontFamily.body.semibold : fontFamily.body.medium,
            fontSize: type.body.fontSize,
          }}
        >
          {conversation.type === 'project' ? `#${conversation.title}` : conversation.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: conversation.unread ? colors.ink : colors.inkMuted,
            fontFamily: fontFamily.body.regular,
            fontSize: type.bodySmall.fontSize,
          }}
        >
          {conversation.lastMessage ?? 'No messages yet'}
        </Text>
      </View>
      {conversation.unread ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
      ) : null}
    </Pressable>
  );
}

export default function ChatScreen() {
  const { colors, spacing, type, fontFamily } = useTheme();
  const { session } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [requests, setRequests] = useState<IncomingConnectionRequest[]>([]);
  const [projectApplications, setProjectApplications] = useState<ProjectApplicationInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestAction, setRequestAction] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [choosingProjectFor, setChoosingProjectFor] = useState<string | null>(null);
  const [projectChoices, setProjectChoices] = useState<ProjectSummary[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    const [conversationsResult, requestsResult, applicationsResult] = await Promise.all([
      listConversations(session.user.id),
      listIncomingConnectionRequests(),
      listIncomingProjectApplications(),
    ]);
    const loadError = conversationsResult.error ?? requestsResult.error ?? applicationsResult.error;
    if (loadError) setError(loadError);
    else {
      setConversations(conversationsResult.data);
      setRequests(requestsResult.data);
      setProjectApplications(applicationsResult.data);
    }
  }, [session]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => subscribeToProjectApplications(() => { void load(); }), [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleReject(requestId: string) {
    setRequestAction(requestId);
    setRequestError(null);
    const result = await rejectConnectionRequest(requestId);
    if (result.error) {
      setRequestError(result.error);
    } else {
      await load();
    }
    setRequestAction(null);
  }

  async function handleChooseProject(requestId: string) {
    if (!session) return;
    setRequestAction(requestId);
    setRequestError(null);
    const result = await listMyProjects(session.user.id);
    if (result.error) {
      setRequestError(result.error);
      setRequestAction(null);
      return;
    }
    const choices = result.data.filter((project) =>
      project.creator_id === session.user.id &&
      ['looking_for_members', 'team_forming'].includes(project.status) &&
      project.current_member_count < project.team_size
    );
    setProjectChoices(choices);
    setChoosingProjectFor(requestId);
    setRequestAction(null);
    if (choices.length === 0) setRequestError('You need an open project with an available team spot to accept this connection into a team.');
  }

  async function handleAddToProject(requestId: string, projectId: string) {
    setRequestAction(requestId);
    setRequestError(null);
    const result = await acceptConnectionToProject(requestId, projectId);
    if (result.error) {
      setRequestError(result.error);
    } else {
      setChoosingProjectFor(null);
      setProjectChoices([]);
      await load();
    }
    setRequestAction(null);
  }

  async function handleProjectApplication(applicationId: string, status: 'accepted' | 'rejected') {
    setRequestAction(applicationId);
    setRequestError(null);
    const result = await decideApplication(applicationId, status);
    if (result.error) {
      setRequestError(result.error);
    } else {
      await load();
    }
    setRequestAction(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ padding: spacing.lg, flex: 1 }}>
        <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize, marginBottom: spacing.lg }}>
          Chat
        </Text>

        {error ? (
          <ErrorState description={error} onRetry={load} />
        ) : loading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={56} />
            <Skeleton height={56} />
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ListHeaderComponent={(
              <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
                <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>
                  Project applications
                </Text>
                {projectApplications.length === 0 ? (
                  <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
                    No pending applications for your projects.
                  </Text>
                ) : projectApplications.map((application) => (
                  <Card key={application.id} style={{ gap: spacing.xs }}>
                    <Text style={{ color: colors.ink, fontFamily: fontFamily.body.semibold, fontSize: type.body.fontSize }}>
                      {application.applicant_name} · @{application.applicant_username}
                    </Text>
                    <Text style={{ color: colors.primary, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>
                      Applied to {application.project_title}
                    </Text>
                    {application.message ? (
                      <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
                        {application.message}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                      <Button
                        label="Accept"
                        onPress={() => handleProjectApplication(application.id, 'accepted')}
                        loading={requestAction === application.id}
                        disabled={requestAction !== null && requestAction !== application.id}
                        size="sm"
                        style={{ flex: 1 }}
                      />
                      <Button
                        label="Reject"
                        onPress={() => handleProjectApplication(application.id, 'rejected')}
                        loading={requestAction === application.id}
                        disabled={requestAction !== null && requestAction !== application.id}
                        variant="secondary"
                        size="sm"
                        style={{ flex: 1 }}
                      />
                    </View>
                  </Card>
                ))}

                <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>
                  Connection requests
                </Text>
                {requests.length === 0 ? (
                  <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
                    No incoming requests yet.
                  </Text>
                ) : requests.map((student) => (
                  <View key={student.id} style={{ gap: spacing.xs }}>
                    <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.caption.fontSize }}>
                      Requested to connect with you
                    </Text>
                    <StudentCard student={student.student} connectable={false} />
                    {choosingProjectFor === student.id ? (
                      <View style={{ gap: spacing.xs }}>
                        <Text style={{ color: colors.ink, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>
                          Choose your project team
                        </Text>
                        {projectChoices.map((project) => (
                          <Button
                            key={project.id}
                            label={`${project.title} · ${project.current_member_count}/${project.team_size}`}
                            onPress={() => handleAddToProject(student.id, project.id)}
                            size="sm"
                            loading={requestAction === student.id}
                            disabled={requestAction !== null && requestAction !== student.id}
                          />
                        ))}
                        <Button
                          label="Cancel"
                          onPress={() => setChoosingProjectFor(null)}
                          variant="ghost"
                          size="sm"
                          disabled={requestAction !== null}
                        />
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <Button
                          label="Accept into project"
                          onPress={() => handleChooseProject(student.id)}
                          size="sm"
                          loading={requestAction === student.id}
                          disabled={requestAction !== null && requestAction !== student.id}
                          style={{ flex: 1 }}
                        />
                        <Button
                          label="Reject"
                          onPress={() => handleReject(student.id)}
                          variant="secondary"
                          size="sm"
                          loading={requestAction === student.id}
                          disabled={requestAction !== null && requestAction !== student.id}
                          style={{ flex: 1 }}
                        />
                      </View>
                    )}
                  </View>
                ))}
                {requestError ? (
                  <Text style={{ color: colors.danger, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
                    {requestError}
                  </Text>
                ) : null}
                <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize, marginTop: spacing.md }}>
                  Conversations
                </Text>
                {conversations.length === 0 ? (
                  <EmptyState icon="message-circle" title="No conversations yet" description="Connect with a student to start collaborating." />
                ) : null}
              </View>
            )}
            renderItem={({ item }) => <ConversationRow conversation={item} onPress={() => router.push(`/chat/${item.id}`)} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
