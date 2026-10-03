import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { fetchComplementaryCandidateIds, fetchDiscoverCandidateId, fetchMyLatestOpenProjectId, skipDiscoverCandidate } from '@/lib/matching';
import { fetchStudentCards, type StudentCard as StudentCardData } from '@/lib/students';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { StudentCard } from '@/components/StudentCard';

export default function DiscoverScreen() {
  const { colors, spacing, type, fontFamily } = useTheme();
  const { session } = useAuth();

  const [candidate, setCandidate] = useState<StudentCardData | null>(null);
  const [rolling, setRolling] = useState(false);
  const [triedOnce, setTriedOnce] = useState(false);

  const [complementary, setComplementary] = useState<StudentCardData[]>([]);
  const [hasOwnOpenProject, setHasOwnOpenProject] = useState(true);
  const [loadingComplementary, setLoadingComplementary] = useState(true);

  const rollDiscovery = useCallback(async () => {
    if (!session) return;
    setRolling(true);
    setTriedOnce(true);
    const id = await fetchDiscoverCandidateId(session.user.id);
    if (!id) {
      setCandidate(null);
      setRolling(false);
      return;
    }
    const { data } = await fetchStudentCards([id]);
    setCandidate(data[0] ?? null);
    setRolling(false);
  }, [session]);

  async function handleSkip() {
    if (!session || !candidate) return;
    await skipDiscoverCandidate(session.user.id, candidate.id);
    rollDiscovery();
  }

  useEffect(() => {
    if (!session) return;
    (async () => {
      const projectId = await fetchMyLatestOpenProjectId(session.user.id);
      setHasOwnOpenProject(!!projectId);
      if (projectId) {
        const ids = await fetchComplementaryCandidateIds(projectId, 3);
        const { data } = await fetchStudentCards(ids);
        setComplementary(data);
      }
      setLoadingComplementary(false);
    })();
  }, [session]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing['2xl'] }}>
        <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize }}>
          Discover
        </Text>

        <View style={{ backgroundColor: colors.primaryMuted, borderRadius: 20, padding: spacing.xl, gap: spacing.md }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ fontSize: 28 }}>🎲</Text>
            <Text style={{ color: colors.ink, fontFamily: fontFamily.display.medium, fontSize: type.h3.fontSize }}>
              Discover someone new
            </Text>
            {!candidate ? (
              <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize, textAlign: 'center' }}>
                Meet a compatible student you haven't connected with yet.
              </Text>
            ) : null}
          </View>

          {rolling ? (
            <Skeleton height={116} />
          ) : candidate ? (
            <View style={{ gap: spacing.sm }}>
              <StudentCard student={candidate} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Skip" onPress={handleSkip} variant="secondary" size="sm" style={{ flex: 1 }} />
                <Button label="Show me another" onPress={rollDiscovery} size="sm" style={{ flex: 1 }} />
              </View>
            </View>
          ) : triedOnce ? (
            <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize, textAlign: 'center' }}>
              No new students to discover right now — check back later.
            </Text>
          ) : (
            <Button label="Show me someone" onPress={rollDiscovery} size="sm" style={{ alignSelf: 'center' }} />
          )}
        </View>

        <View>
          <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize, marginBottom: spacing.sm }}>
            Students With Complementary Skills
          </Text>
          {loadingComplementary ? (
            <View style={{ gap: spacing.md }}><Skeleton height={100} /><Skeleton height={100} /></View>
          ) : !hasOwnOpenProject ? (
            <EmptyState icon="git-merge" title="Create a project first" description="Once you have an open project, students who fill its skill gaps will appear here." />
          ) : complementary.length === 0 ? (
            <EmptyState icon="git-merge" title="Nothing to show yet" description="Your project's current team already covers its required skills, or no one fills the gap yet." />
          ) : (
            <View style={{ gap: spacing.md }}>
              {complementary.map((s) => (
                <StudentCard key={s.id} student={s} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
