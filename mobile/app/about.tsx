import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { Button, Card } from '@/components/ui';

export default function AboutScreen() {
  const { colors, spacing, type, fontFamily } = useTheme(); const router = useRouter();
  const steps = ['Build profile', 'Get matched', 'Join or create projects', 'Chat'];
  const weights = [['Skill', 40], ['Interest', 20], ['Role', 15], ['Complementary', 10], ['Availability', 10], ['Other', 5]] as const;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
    <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize }}>About Collentra</Text>
    <Card style={{ gap: spacing.sm }}><Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h2.fontSize }}>Build something together</Text><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.body.fontSize }}>Collentra helps KIIT students find collaborators, form project teams, and keep the work moving in one place. It is built to make it easier to turn shared interests and complementary skills into real student projects.</Text></Card>
    <View style={{ gap: spacing.sm }}><Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>How it works</Text><Card style={{ gap: spacing.sm }}>{steps.map((step, i) => <View key={step} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}><Text style={{ color: colors.primary, fontFamily: fontFamily.display.bold, fontSize: type.h3.fontSize }}>0{i + 1}</Text><Text style={{ color: colors.ink, fontFamily: fontFamily.body.medium, fontSize: type.body.fontSize }}>{step}</Text></View>)}</Card></View>
    <Card style={{ gap: spacing.sm }}><Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>How matching scores work</Text><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>The score estimates how well a person’s profile fits a project. Skills carry the most weight; shared interests, role fit, and complementary strengths add context. Availability and other profile signals round it out. Use the score as a starting point and talk with potential teammates.</Text>{weights.map(([name, weight]) => <View key={name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>{name}</Text><Text style={{ color: colors.primary, fontFamily: fontFamily.body.semibold, fontSize: type.bodySmall.fontSize }}>{weight}%</Text></View>)}</Card>
    <Button label="How to use Collentra" variant="secondary" onPress={() => router.push('/how-to-use')} /><Button label="Frequently asked questions" variant="secondary" onPress={() => router.push('/faq')} /><Button label="Help & Feedback" variant="secondary" onPress={() => router.push('/help')} />
  </ScrollView></SafeAreaView>;
}
