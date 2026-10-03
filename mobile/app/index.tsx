import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function Index() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);

  useEffect(() => { AsyncStorage.getItem('collentra.welcome.seen').then((value) => setWelcomeSeen(value === 'true')).catch(() => setWelcomeSeen(false)); }, []);

  if (loading || welcomeSeen === null) {
    // Brief -- getSession() resolves from local storage almost instantly.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!welcomeSeen) return <Redirect href="/welcome" />;

  return <Redirect href={session ? '/(tabs)/home' : '/(auth)/login'} />;
}
