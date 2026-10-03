import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { fetchRoles, fetchSkills } from '@/lib/catalog';
import { createProject } from '@/lib/projects';
import type { HoursRange, RoleRow, SkillRow } from '@/lib/types';
import { Button, Input, SelectableChip, Skeleton } from '@/components/ui';

const HOURS_OPTIONS: HoursRange[] = ['0-5', '5-10', '10-15', '15+'];

export default function CreateProjectScreen() {
  const { colors, spacing, type, fontFamily } = useTheme();
  const router = useRouter();
  const closeScreen = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/projects');
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('');
  const [teamSize, setTeamSize] = useState('4');
  const [expectedHours, setExpectedHours] = useState<HoursRange | null>(null);

  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([fetchSkills(), fetchRoles()]).then(([skillsRes, rolesRes]) => {
      setSkills(skillsRes.data);
      setRoles(rolesRes.data);
      setLoadingCatalog(false);
    });
  }, []);

  const skillsByCategory = useMemo(() => {
    const map = new Map<string, SkillRow[]>();
    for (const s of skills) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries());
  }, [skills]);

  function toggleSkill(id: string) {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleRole(id: string) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    setError(undefined);
    if (title.trim().length === 0) return setError('Give the project a title.');
    if (description.trim().length === 0) return setError('Add a short description.');
    const size = parseInt(teamSize, 10);
    if (!size || size < 1) return setError('Team size must be at least 1.');

    setSubmitting(true);
    const { id, error } = await createProject({
      title: title.trim(),
      description: description.trim(),
      domain: domain.trim() || null,
      teamSize: size,
      expectedHours,
      skillIds: Array.from(selectedSkillIds),
      roleIds: Array.from(selectedRoleIds),
    });
    setSubmitting(false);

    if (error && !id) {
      setError(error);
      return;
    }
    router.replace(id ? `/project/${id}` : '/(tabs)/projects');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Button label="Cancel" onPress={closeScreen} variant="ghost" size="sm" />
        <Text style={{ color: colors.ink, fontFamily: fontFamily.display.medium, fontSize: type.h3.fontSize }}>
          New Project
        </Text>
        <Button label="Create" onPress={handleCreate} size="sm" loading={submitting} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Input label="Title" placeholder="e.g. AI Attendance System" value={title} onChangeText={setTitle} />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
        <Input label="Domain" placeholder="e.g. AI / Computer Vision" value={domain} onChangeText={setDomain} />
        <Input label="Team size" keyboardType="number-pad" value={teamSize} onChangeText={setTeamSize} />

        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: 13 }}>
            Expected workload
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {HOURS_OPTIONS.map((h) => (
              <SelectableChip key={h} label={`${h} hrs/week`} selected={expectedHours === h} onToggle={() => setExpectedHours(h)} />
            ))}
          </View>
        </View>

        {loadingCatalog ? (
          <View style={{ gap: spacing.sm }}><Skeleton height={24} /><Skeleton height={40} /><Skeleton height={40} /></View>
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: 13 }}>
                Required skills
              </Text>
              {skillsByCategory.map(([category, items]) => (
                <View key={category} style={{ gap: spacing.xs }}>
                  <Text style={{ color: colors.inkFaint, fontFamily: fontFamily.body.regular, fontSize: type.caption.fontSize }}>
                    {category}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {items.map((s) => (
                      <SelectableChip key={s.id} label={s.name} selected={selectedSkillIds.has(s.id)} onToggle={() => toggleSkill(s.id)} />
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: 13 }}>
                Required roles
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {roles.map((r) => (
                  <SelectableChip key={r.id} label={r.name} selected={selectedRoleIds.has(r.id)} onToggle={() => toggleRole(r.id)} />
                ))}
              </View>
            </View>
          </>
        )}

        {error ? (
          <Text style={{ color: colors.danger, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
