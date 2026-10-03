import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { StudentCard as StudentCardData } from '@/lib/students';
import { getConnectionState, sendConnectionRequest, type ConnectionState } from '@/lib/students';
import { Avatar, Badge, Button, Card } from '@/components/ui';

type StudentCardProps = {
  student: StudentCardData;
  onPress?: () => void;
  compact?: boolean;
  connectable?: boolean;
};

export function StudentCard({ student, onPress, compact = false, connectable = true }: StudentCardProps) {
  const { colors, spacing, type, fontFamily } = useTheme();
  const [status, setStatus] = useState<ConnectionState | 'checking' | 'sending'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!connectable) return;
    let active = true;
    void getConnectionState(student.id).then((next) => {
      if (active) setStatus(next);
    });
    return () => { active = false; };
  }, [connectable, student.id]);

  async function handleConnect() {
    if (status !== 'none') return;
    setStatus('sending');
    setErrorMessage(null);
    const { error, status: nextStatus } = await sendConnectionRequest(student.id);
    setStatus(nextStatus);
    setErrorMessage(error);
  }

  const connectionLabel: Record<ConnectionState | 'checking' | 'sending', string> = {
    checking: 'Checking connection…',
    none: 'Connect',
    sending: 'Sending request…',
    outgoing: 'Request sent',
    incoming: 'Request received · check Chat',
    connected: 'Connected',
    rejected: 'Request declined',
    unknown: 'Connection unavailable',
  };
  const canConnect = status === 'none';

  return (
    <Card onPress={onPress} style={{ gap: spacing.sm, width: compact ? 200 : undefined }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar name={student.full_name} size={40} />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.ink, fontFamily: fontFamily.display.medium, fontSize: type.h3.fontSize }}
          >
            {student.full_name}
          </Text>
          <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.caption.fontSize }}>
            @{student.username} {student.branch ? `· ${student.branch}` : ''}
          </Text>
        </View>
      </View>
      {student.skill_names.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {student.skill_names.slice(0, 3).map((name) => (
            <Badge key={name} label={name} tone="neutral" />
          ))}
        </View>
      ) : null}
      {connectable ? <Button
        label={connectionLabel[status]}
        onPress={handleConnect}
        variant={canConnect ? 'primary' : 'secondary'}
        size="sm"
        loading={status === 'sending' || status === 'checking'}
        disabled={!canConnect}
      /> : null}
      {connectable && errorMessage ? (
        <Text style={{ color: colors.danger, fontFamily: fontFamily.body.regular, fontSize: type.caption.fontSize }}>
          {errorMessage}
        </Text>
      ) : null}
    </Card>
  );
}
