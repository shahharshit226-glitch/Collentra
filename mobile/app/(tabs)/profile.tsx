import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { getStudentDashboard, type StudentDashboard, type DashboardProject } from '@/lib/dashboard';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';

const projectState = (p: DashboardProject) => p.bucket === 'applied' ? ['Pending', 'warning'] as const : p.status === 'completed' ? ['Completed', 'success'] as const : ['Active', 'primary'] as const;

export default function ProfileScreen() {
  const { colors, spacing, type, fontFamily } = useTheme();
  const { session, signOut } = useAuth();
  const { profile, loading: profileLoading, error: profileError, refresh, updateProfile } = useProfile();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  const load = useCallback(async () => {
    const result = await getStudentDashboard();
    setDashboard(result.data);
    setError(result.error);
  }, []);
  useEffect(() => { setLoading(true); void load().finally(() => setLoading(false)); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await Promise.all([load(), refresh()]); setRefreshing(false); };
  const student = profile ?? dashboard?.profile ?? null;
  const completeness = student ? Math.round(([student.full_name, student.username, student.branch, student.year, student.bio, profile?.github_url, profile?.linkedin_url].filter(Boolean).length / 7) * 100) : 0;

  const section = (title: string, bucket: DashboardProject['bucket']) => {
    const list = (dashboard?.projects ?? []).filter((p) => p.bucket === bucket);
    return <View style={{ gap: spacing.sm }} key={bucket}>
      <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>{title}</Text>
      {list.length ? list.map((p) => {
        const [label, tone] = projectState(p);
        return <Pressable key={`${bucket}-${p.id}`} onPress={() => router.push(`/project/${p.id}`)}>
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
              <Text numberOfLines={1} style={{ flex: 1, color: colors.ink, fontFamily: fontFamily.body.semibold, fontSize: type.body.fontSize }}>{p.title}</Text>
              <Badge label={label} tone={tone} />
            </View>
            <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>{p.role}{p.bucket === 'applied' ? ' · Application sent' : ''}</Text>
            {p.bucket === 'member' ? <Button label="Open team chat" size="sm" variant="secondary" onPress={async () => {
              const { getProjectConversationId } = await import('@/lib/chat');
              const id = await getProjectConversationId(p.id);
              if (id) router.push(`/chat/${id}`);
            }} /> : null}
          </Card>
        </Pressable>;
      }) : <EmptyState icon="folder" title={`No ${title.toLowerCase()} yet`} description={bucket === 'applied' ? 'Projects you apply to will show up here.' : 'Projects you own or join will show up here.'} />}
    </View>;
  };

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />} contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
      <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize }}>Student Dashboard</Text>
      {(error || profileError) && !dashboard ? <ErrorState description={error ?? profileError ?? ''} onRetry={onRefresh} /> : null}
      {loading || profileLoading ? <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}><Skeleton width={72} height={72} style={{ borderRadius: 36 }} /><View style={{ gap: spacing.sm }}><Skeleton width={160} height={20} /><Skeleton width={110} height={14} /></View></Card> : <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <Avatar name={student?.full_name ?? 'Student'} size={68} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h2.fontSize }}>{student?.full_name ?? 'Student'}</Text>
          <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>{student?.branch ?? 'Branch not set'} · {student?.year ? `Year ${student.year}` : 'Year not set'}</Text>
        </View>
        <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 4, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.primary, fontFamily: fontFamily.display.bold, fontSize: type.bodySmall.fontSize }}>{completeness}%</Text>
        </View>
      </Card>}
      {dashboard ? <Card style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs }}>
        {([['Active', dashboard.stats.active], ['Pending', dashboard.stats.pending], ['Connections', dashboard.stats.connections], ['Completed', dashboard.stats.completed]] as const).map(([label, value]) => <View key={label} style={{ flex: 1, alignItems: 'center', gap: 3 }}><Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h2.fontSize }}>{value}</Text><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: 10, textAlign: 'center' }}>{label}</Text></View>)}
      </Card> : null}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>My Projects</Text>
        {section('Owned', 'owned')}{section('Member of', 'member')}{section('Applied', 'applied')}
      </View>
      {dashboard ? <Card style={{ gap: spacing.md }}>
        <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>Skills & interests</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{dashboard.skills.concat(dashboard.interests).map((tag, i) => <Badge key={`${i}-${tag}`} label={tag} tone={i < dashboard.skills.length ? 'primary' : 'neutral'} />)}</View>
        {!dashboard.skills.length && !dashboard.interests.length ? <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>Add skills and interests to help teammates find you.</Text> : null}
      </Card> : null}
      <Card style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>Recent activity</Text>
        {(dashboard?.projects ?? []).slice(0, 3).map((p) => <Text key={`activity-${p.id}-${p.bucket}`} style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>• {p.bucket === 'applied' ? `Applied to ${p.title}` : `Working on ${p.title}`}</Text>)}
        {!dashboard?.projects.length ? <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>Your project activity will appear here.</Text> : null}
      </Card>
      {student?.bio ? <Card><Text style={{ color: colors.ink, fontFamily: fontFamily.body.regular, fontSize: type.body.fontSize }}>{student.bio}</Text></Card> : null}
      <View style={{ gap: spacing.sm }}>
        <Button label={profile?.is_available_to_collaborate ? 'Turn off collaboration availability' : 'Turn on collaboration availability'} onPress={async () => {
          if (!profile || availabilitySaving) return;
          setAvailabilitySaving(true); await updateProfile({ is_available_to_collaborate: !profile.is_available_to_collaborate }); setAvailabilitySaving(false);
        }} variant="secondary" loading={availabilitySaving} />
        <Button label="Edit profile" onPress={() => router.push('/edit-profile')} variant="secondary" />
        <Button label="About & Help" onPress={() => router.push('/about')} variant="secondary" />
        <Button label="Sign out" onPress={signOut} variant="ghost" />
      </View>
    </ScrollView>
  </SafeAreaView>;
}
