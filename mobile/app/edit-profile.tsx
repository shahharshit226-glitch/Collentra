import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { fetchInterests, fetchRoles, fetchSkills } from '@/lib/catalog';
import { fetchStudentPreferences, saveStudentPreferences, type DaysPreference } from '@/lib/profilePreferences';
import type { HoursRange, InterestRow, RoleRow, SkillRow } from '@/lib/types';
import { Button, Input, SelectableChip, Skeleton } from '@/components/ui';

const YEARS = [1, 2, 3, 4, 5];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const HOURS: HoursRange[] = ['0-5', '5-10', '10-15', '15+'];
const DAYS: { value: DaysPreference; label: string }[] = [
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'both', label: 'Both' },
];

function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  const { colors, type, fontFamily } = useTheme();
  return <View style={{ gap: 3 }}>
    <Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>{title}</Text>
    {detail ? <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.caption.fontSize }}>{detail}</Text> : null}
  </View>;
}

export default function EditProfileScreen() {
  const { colors, spacing, type, fontFamily } = useTheme();
  const { session } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const router = useRouter();
  const closeScreen = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(session ? '/(tabs)/profile' : '/(auth)/login');
  }, [router, session]);

  const [fullName, setFullName] = useState('');
  const [school, setSchool] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const [bio, setBio] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);

  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [hoursPerWeek, setHoursPerWeek] = useState<HoursRange>('0-5');
  const [preferredDays, setPreferredDays] = useState<DaysPreference>('both');
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setSchool(profile.school ?? '');
    setBranch(profile.branch ?? '');
    setYear(profile.year);
    setSemester(profile.semester);
    setBio(profile.bio ?? '');
    setGithubUrl(profile.github_url ?? '');
    setLinkedinUrl(profile.linkedin_url ?? '');
    setIsAvailable(profile.is_available_to_collaborate);
  }, [profile]);

  const loadPreferences = useCallback(async () => {
    if (!session) return;
    setLoadingPreferences(true);
    setError(undefined);
    const [skillList, interestList, roleList, preferences] = await Promise.all([
      fetchSkills(), fetchInterests(), fetchRoles(), fetchStudentPreferences(session.user.id),
    ]);
    setSkills(skillList.data);
    setInterests(interestList.data);
    setRoles(roleList.data);
    if (preferences.data) {
      setPreferencesReady(true);
      setSelectedSkills(new Set(preferences.data.skillIds));
      setSelectedInterests(new Set(preferences.data.interestIds));
      setSelectedRoles(new Set(preferences.data.roleIds));
      setHoursPerWeek(preferences.data.hoursPerWeek);
      setPreferredDays(preferences.data.preferredDays);
    } else setPreferencesReady(false);
    setError(skillList.error ?? interestList.error ?? roleList.error ?? preferences.error ?? undefined);
    setLoadingPreferences(false);
  }, [session]);

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);

  const skillsByCategory = useMemo(() => {
    const groups = new Map<string, SkillRow[]>();
    skills.forEach((skill) => {
      if (!groups.has(skill.category)) groups.set(skill.category, []);
      groups.get(skill.category)!.push(skill);
    });
    return Array.from(groups.entries());
  }, [skills]);

  function toggleSelection(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!session) { setError('Please sign in again.'); return; }
    if (!preferencesReady) { setError('Your existing matching preferences have not loaded. Retry loading them before saving so they are not accidentally cleared.'); return; }
    if (!fullName.trim()) { setError('Name cannot be empty.'); return; }
    if (year !== null && (year < 1 || year > 5)) { setError('Choose a year from 1 to 5.'); return; }
    if (semester !== null && (semester < 1 || semester > 10)) { setError('Choose a semester from 1 to 10.'); return; }

    setError(undefined);
    setSaving(true);
    const profileResult = await updateProfile({
      full_name: fullName.trim(),
      school: school.trim() || null,
      branch: branch.trim() || null,
      year,
      semester,
      bio: bio.trim() || null,
      github_url: githubUrl.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      is_available_to_collaborate: isAvailable,
    });
    if (profileResult.error) {
      setError(profileResult.error);
      setSaving(false);
      return;
    }

    const preferencesResult = await saveStudentPreferences({
      skillIds: Array.from(selectedSkills),
      interestIds: Array.from(selectedInterests),
      roleIds: Array.from(selectedRoles),
      hoursPerWeek,
      preferredDays,
    });
    setSaving(false);
    if (preferencesResult.error) {
      setError(`Your profile details were saved, but matching preferences were not: ${preferencesResult.error}`);
      return;
    }
    closeScreen();
  }

  const isLoading = loading || loadingPreferences;

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Button label="Cancel" onPress={closeScreen} variant="ghost" size="sm" />
      <Text style={{ color: colors.ink, fontFamily: fontFamily.display.medium, fontSize: type.h3.fontSize }}>Edit Profile</Text>
      <Button label="Save" onPress={handleSave} size="sm" loading={saving} disabled={isLoading || !preferencesReady} />
    </View>

    {isLoading ? <View style={{ padding: spacing.lg, gap: spacing.md }}><Skeleton height={48} /><Skeleton height={100} /><Skeleton height={48} /><Skeleton height={96} /><Skeleton height={120} /></View> : <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
      <View style={{ gap: spacing.md }}>
        <SectionTitle title="About you" detail="These details help teammates understand who you are." />
        <Input label="Full name" value={fullName} onChangeText={setFullName} />
        <Input label="School / college" placeholder="e.g. KIIT School of Computer Engineering" value={school} onChangeText={setSchool} />
        <Input label="Branch" placeholder="e.g. Computer Science and Engineering" value={branch} onChangeText={setBranch} />
        <View style={{ gap: spacing.xs }}><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>Year</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{YEARS.map((value) => <SelectableChip key={value} label={`Year ${value}`} selected={year === value} onToggle={() => setYear(year === value ? null : value)} />)}<SelectableChip label="Not set" selected={year === null} onToggle={() => setYear(null)} /></View></View>
        <View style={{ gap: spacing.xs }}><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>Semester</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{SEMESTERS.map((value) => <SelectableChip key={value} label={`${value}`} selected={semester === value} onToggle={() => setSemester(semester === value ? null : value)} />)}<SelectableChip label="Not set" selected={semester === null} onToggle={() => setSemester(null)} /></View></View>
        <Input label="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: 'top' }} />
        <Input label="GitHub URL" placeholder="https://github.com/yourname" autoCapitalize="none" value={githubUrl} onChangeText={setGithubUrl} />
        <Input label="LinkedIn URL" placeholder="https://linkedin.com/in/yourname" autoCapitalize="none" value={linkedinUrl} onChangeText={setLinkedinUrl} />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Skills" detail="Choose skills you can contribute. Project recommendations use skills to find relevant teams and teammates." />
        {skillsByCategory.map(([category, items]) => <View key={category} style={{ gap: spacing.xs }}><Text style={{ color: colors.inkFaint, fontFamily: fontFamily.body.medium, fontSize: type.caption.fontSize }}>{category}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{items.map((item) => <SelectableChip key={item.id} label={item.name} selected={selectedSkills.has(item.id)} onToggle={() => toggleSelection(setSelectedSkills, item.id)} />)}</View></View>)}
        {!skills.length ? <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>No skills are available in the catalog yet.</Text> : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Interests" detail="Interests help match you with projects whose topics you care about." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{interests.map((item) => <SelectableChip key={item.id} label={item.name} selected={selectedInterests.has(item.id)} onToggle={() => toggleSelection(setSelectedInterests, item.id)} />)}</View>
        {!interests.length ? <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>No interests are available in the catalog yet.</Text> : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Preferred roles" detail="Select the kinds of work you want to take on in a project." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{roles.map((item) => <SelectableChip key={item.id} label={item.name} selected={selectedRoles.has(item.id)} onToggle={() => toggleSelection(setSelectedRoles, item.id)} />)}</View>
        {!roles.length ? <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>No roles are available in the catalog yet.</Text> : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Availability" detail="Your hours and preferred days are part of project fit. The availability switch controls whether others see you as open to collaboration." />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.md }}><View style={{ flex: 1, gap: 2 }}><Text style={{ color: colors.ink, fontFamily: fontFamily.body.semibold, fontSize: type.bodySmall.fontSize }}>Available to collaborate</Text><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.caption.fontSize }}>{isAvailable ? 'Your profile can appear in availability-based discovery.' : 'Your profile is not marked open to new collaboration.'}</Text></View><Switch value={isAvailable} onValueChange={setIsAvailable} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.surface} accessibilityLabel="Available to collaborate" /></View>
        <View style={{ gap: spacing.xs }}><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>Hours available per week</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{HOURS.map((value) => <SelectableChip key={value} label={`${value} hours`} selected={hoursPerWeek === value} onToggle={() => setHoursPerWeek(value)} />)}</View></View>
        <View style={{ gap: spacing.xs }}><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>Preferred days</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{DAYS.map((item) => <SelectableChip key={item.value} label={item.label} selected={preferredDays === item.value} onToggle={() => setPreferredDays(item.value)} />)}</View></View>
      </View>

      {error ? <View style={{ gap: spacing.sm }}><Text accessibilityRole="alert" style={{ color: colors.danger, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>{error}</Text>{!preferencesReady ? <Button label="Retry loading profile options" variant="secondary" size="sm" onPress={() => void loadPreferences()} loading={loadingPreferences} /> : null}</View> : null}
      <Button label="Save profile and matching preferences" onPress={handleSave} loading={saving} disabled={!preferencesReady} />
    </ScrollView>}
  </SafeAreaView>;
}
