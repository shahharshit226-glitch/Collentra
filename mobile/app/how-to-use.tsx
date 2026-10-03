import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/ui';

const guide = [
  { icon: 'user' as const, title: '1. Build your student profile', body: 'Add your name, branch, year, a short bio, skills, and interests. These details help other KIIT students understand what you can contribute and help Collentra suggest relevant teams.' },
  { icon: 'compass' as const, title: '2. Explore people and projects', body: 'Use Home for recommendations, Discover to meet potential collaborators, and Projects to browse open opportunities. Keep your skills and interests up to date to improve the suggestions.' },
  { icon: 'folder-plus' as const, title: '3. Join a team or create a project', body: 'Open a project to read its description, required skills, roles, and team roster. Apply with an optional note, or create a project and describe the people and skills you need.' },
  { icon: 'message-circle' as const, title: '4. Coordinate in Chat', body: 'When an owner accepts you, you join the project team chat. Use Chat for team conversations, direct messages, project applications, and connection requests.' },
  { icon: 'user-check' as const, title: '5. Manage your collaboration profile', body: 'Your Profile tab is the Student Dashboard. Review your projects and activity, update your profile, and turn collaboration availability on or off. If you leave a team, your membership history remains while you are removed from its chat.' },
];

export default function HowToUseScreen() {
  const { colors, spacing, type, fontFamily } = useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
    <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize }}>How to use Collentra</Text>
    <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.body.fontSize }}>Collentra helps KIIT students find teammates and take student projects from an idea to a working collaboration.</Text>
    {guide.map((step) => <Card key={step.title} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
      <View accessibilityLabel={`${step.title} icon`} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryMuted }}><Feather name={step.icon} size={20} color={colors.primary} /></View>
      <View style={{ flex: 1, gap: spacing.xs }}><Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>{step.title}</Text><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>{step.body}</Text></View>
    </Card>)}
    <Card style={{ gap: spacing.xs }}><Text style={{ color: colors.ink, fontFamily: fontFamily.display.semibold, fontSize: type.h3.fontSize }}>What the navigation icons mean</Text><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>Home (house) opens your recommendations. Discover (compass) helps you meet collaborators. Projects (folder) opens project listings. Chat (message bubble) opens conversations and requests. Profile (person) opens your Student Dashboard and profile settings. The icon is a shortcut to that section; tap the label or icon to open it.</Text></Card>
  </ScrollView></SafeAreaView>;
}
