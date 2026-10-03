import { Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { ProjectSummary } from '@/lib/types';
import { Badge, Card } from '@/components/ui';

type ProjectCardProps = {
  project: ProjectSummary;
  onPress: () => void;
  /** Compact variant for horizontal-scrolling rows (Home screen sections). */
  compact?: boolean;
};

export function ProjectCard({ project, onPress, compact = false }: ProjectCardProps) {
  const { colors, spacing, type, fontFamily } = useTheme();

  return (
    <Card onPress={onPress} style={{ gap: spacing.sm, width: compact ? 220 : undefined }}>
      <Text
        numberOfLines={compact ? 2 : undefined}
        style={{ color: colors.ink, fontFamily: fontFamily.display.medium, fontSize: type.h3.fontSize }}
      >
        {project.title}
      </Text>
      {project.domain ? (
        <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
          {project.domain}
        </Text>
      ) : null}
      {project.required_skill_names.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {project.required_skill_names.slice(0, compact ? 2 : 4).map((name) => (
            <Badge key={name} label={name} tone="primary" />
          ))}
        </View>
      ) : null}
      <Text style={{ color: colors.inkFaint, fontFamily: fontFamily.body.regular, fontSize: type.caption.fontSize }}>
        Team {project.current_member_count} / {project.team_size}
      </Text>
    </Card>
  );
}
