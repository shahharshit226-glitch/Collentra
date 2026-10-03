import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { fetchMyLatestOpenProjectId, fetchProjectsNeedingSkillsIds, fetchRecommendedPartnerIds } from '@/lib/matching';
import { fetchAvailableToCollaborate, fetchStudentCards, type StudentCard as StudentCardData } from '@/lib/students';
import { listMyProjects, listProjectsByIds } from '@/lib/projects';
import type { ProjectSummary } from '@/lib/types';
import { EmptyState, Skeleton } from '@/components/ui';
import { ProjectCard } from '@/components/ProjectCard';
import { StudentCard } from '@/components/StudentCard';

function SectionHeader({ title }: { title: string }) {
  const { colors, spacing, type, fontFamily } = useTheme();
  return (
    <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize, marginBottom: spacing.sm }}>
      {title}
    </Text>
  );
}

function HorizontalRow({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
      {children}
    </ScrollView>
  );
}

export default function HomeScreen() {
  const { colors, spacing, type, fontFamily } = useTheme();
  const { session } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendedPartners, setRecommendedPartners] = useState<StudentCardData[]>([]);
  const [projectsNeedingSkills, setProjectsNeedingSkills] = useState<ProjectSummary[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentCardData[]>([]);
  const [myProjects, setMyProjects] = useState<ProjectSummary[]>([]);
  const [hasOwnOpenProject, setHasOwnOpenProject] = useState(true); // avoids an empty-state flash before the first load

  const load = useCallback(async () => {
    if (!session) return;
    const userId = session.user.id;

    const [myOpenProjectId, availableRes, myProjectsRes] = await Promise.all([
      fetchMyLatestOpenProjectId(userId),
      fetchAvailableToCollaborate(userId, 8),
      listMyProjects(userId),
    ]);
    setHasOwnOpenProject(!!myOpenProjectId);
    setAvailableStudents(availableRes.data);
    setMyProjects(myProjectsRes.data.filter((p) => p.status !== 'completed' && p.status !== 'archived'));

    const [partnerIds, neededIds] = await Promise.all([
      myOpenProjectId ? fetchRecommendedPartnerIds(myOpenProjectId, 6) : Promise.resolve([]),
      fetchProjectsNeedingSkillsIds(userId, 6),
    ]);
    const [partnersRes, neededRes] = await Promise.all([fetchStudentCards(partnerIds), listProjectsByIds(neededIds)]);
    setRecommendedPartners(partnersRes.data);
    setProjectsNeedingSkills(neededRes.data);
  }, [session]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const firstName = (profile?.full_name ?? '').split(' ')[0] || 'there';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing['2xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: spacing.xl, gap: spacing.sm }}>
          <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>Your campus, your next collaboration</Text>
          <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize }}>Hi, {firstName}</Text>
          <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>Meet teammates and move your ideas forward.</Text>
        </LinearGradient>

        <View>
          <SectionHeader title="Recommended Partners" />
          {loading ? (
            <Skeleton height={120} />
          ) : !hasOwnOpenProject ? (
            <EmptyState
              icon="users"
              title="Create a project to get recommendations"
              description="Once you have an open project, we'll match students against what it needs."
              actionLabel="Create a project"
              onAction={() => router.push('/create-project')}
            />
          ) : recommendedPartners.length === 0 ? (
            <EmptyState icon="users" title="No matches yet" description="Add required skills to your project to improve matching." />
          ) : (
            <HorizontalRow>
              {recommendedPartners.map((s) => (
                <StudentCard key={s.id} student={s} compact />
              ))}
            </HorizontalRow>
          )}
        </View>

        <View>
          <SectionHeader title="Projects Needing Your Skills" />
          {loading ? (
            <Skeleton height={120} />
          ) : projectsNeedingSkills.length === 0 ? (
            <EmptyState icon="target" title="Nothing needs your skills yet" description="Add a few skills to your profile to see matches here." />
          ) : (
            <HorizontalRow>
              {projectsNeedingSkills.map((p) => (
                <ProjectCard key={p.id} project={p} compact onPress={() => router.push(`/project/${p.id}`)} />
              ))}
            </HorizontalRow>
          )}
        </View>

        <View>
          <SectionHeader title="Available to Collaborate" />
          {loading ? (
            <Skeleton height={120} />
          ) : availableStudents.length === 0 ? (
            <EmptyState icon="zap" title="No one's marked available yet" description="Students who turn on 'Available to Collaborate' will show up here." />
          ) : (
            <HorizontalRow>
              {availableStudents.map((s) => (
                <StudentCard key={s.id} student={s} compact />
              ))}
            </HorizontalRow>
          )}
        </View>

        <View>
          <SectionHeader title="My Active Projects" />
          {loading ? (
            <Skeleton height={100} />
          ) : myProjects.length === 0 ? (
            <EmptyState
              icon="folder-plus"
              title="No projects yet"
              description="Create your first project and find your team."
              actionLabel="Create a project"
              onAction={() => router.push('/create-project')}
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              {myProjects.map((p) => (
                <ProjectCard key={p.id} project={p} onPress={() => router.push(`/project/${p.id}`)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
