import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { listMyProjects, listOpenProjects } from '@/lib/projects';
import type { ProjectSummary } from '@/lib/types';
import { ProjectCard } from '@/components/ProjectCard';
import { EmptyState, ErrorState, Skeleton, Button } from '@/components/ui';

type Tab = 'open' | 'mine';

export default function ProjectsScreen() {
  const { colors, spacing, type, fontFamily } = useTheme();
  const { session } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('open');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    const result = tab === 'open' ? await listOpenProjects() : await listMyProjects(session.user.id);
    if (result.error) setError(result.error);
    else setProjects(result.data);
  }, [tab, session]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ padding: spacing.lg, gap: spacing.lg, flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize }}>
            Projects
          </Text>
          <Button label="New" onPress={() => router.push('/create-project')} size="sm" />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label="Open" onPress={() => setTab('open')} variant={tab === 'open' ? 'primary' : 'secondary'} size="sm" />
          <Button label="Mine" onPress={() => setTab('mine')} variant={tab === 'mine' ? 'primary' : 'secondary'} size="sm" />
        </View>

        {error ? (
          <ErrorState description={error} onRetry={load} />
        ) : loading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={100} />
            <Skeleton height={100} />
          </View>
        ) : projects.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {tab === 'open' ? (
              <EmptyState icon="folder" title="No open projects right now" description="Be the first to post one and find your team." actionLabel="Create a project" onAction={() => router.push('/create-project')} />
            ) : (
              <EmptyState icon="folder-plus" title="No projects yet" description="Create your first project and find your team." actionLabel="Create a project" onAction={() => router.push('/create-project')} />
            )}
          </View>
        ) : (
          <FlatList
            data={projects}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.md }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <ProjectCard project={item} onPress={() => router.push(`/project/${item.id}`)} />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
