import Constants from 'expo-constants';
import { Linking, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { Button, Card } from '@/components/ui';

const SUPPORT_EMAIL = 'support@collentra.app';
export default function HelpScreen() {
  const { colors, spacing, type, fontFamily } = useTheme(); const router = useRouter();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
    <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize }}>Help & Feedback</Text>
    <Button label="How to use Collentra" variant="secondary" onPress={() => router.push('/how-to-use')} />
    <Card style={{ gap: spacing.sm }}><Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>Report or contact us</Text><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>Email us with what happened. Include relevant project or conversation details, and avoid sending passwords or sensitive account information.</Text><Button label="Email Collentra support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Collentra%20help%20or%20feedback`)} /></Card>
    <Card style={{ gap: spacing.sm }}><Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>Community guidelines</Text><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>Be respectful, communicate clearly, credit others’ work, and use project spaces for collaboration. Do not harass, impersonate, spam, or share another student’s private information. Report harmful behavior to the team.</Text></Card>
    <Text style={{ color: colors.inkFaint, fontFamily: fontFamily.body.regular, fontSize: type.caption.fontSize, textAlign: 'center' }}>Collentra v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
  </ScrollView></SafeAreaView>;
}
