import { useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

const slides = [
  { title: 'Make your next idea a team project.', body: 'Collentra brings KIIT students together to build, learn, and create side by side.' },
  { title: 'Find people who complement you.', body: 'Show your skills and interests to discover teammates with shared goals and different strengths.' },
  { title: 'Go from match to momentum.', body: 'Create a project or join one, then keep your team connected with project chat.' },
];
export default function WelcomeScreen() {
  const { colors, spacing, type, fontFamily } = useTheme(); const { session } = useAuth(); const router = useRouter(); const [index, setIndex] = useState(0);
  async function finish() { await AsyncStorage.setItem('collentra.welcome.seen', 'true'); router.replace(session ? '/(tabs)/home' : '/(auth)/login'); }
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><View style={{ flex: 1, padding: spacing.lg, justifyContent: 'space-between' }}>
    <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 300, borderRadius: 28, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}><Text style={{ color: '#fff', fontFamily: fontFamily.display.bold, fontSize: 44 }}>C</Text><Text style={{ color: '#fff', fontFamily: fontFamily.display.semibold, fontSize: type.h2.fontSize, marginTop: spacing.sm }}>Collentra</Text></LinearGradient>
    <View style={{ gap: spacing.md }}><Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize, textAlign: 'center' }}>{slides[index].title}</Text><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.body.fontSize, textAlign: 'center' }}>{slides[index].body}</Text><View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm }}>{slides.map((_, i) => <View key={i} style={{ width: i === index ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? colors.primary : colors.border }} />)}</View></View>
    <Button label={index === slides.length - 1 ? 'Get started' : 'Continue'} onPress={() => index < slides.length - 1 ? setIndex(index + 1) : void finish()} />
  </View></SafeAreaView>;
}
