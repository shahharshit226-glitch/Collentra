import { Redirect, Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function TabsLayout() {
  const { colors, fontFamily } = useTheme();
  const { session, loading } = useAuth();

  // Guards direct navigation to a tab URL after sign-out, not just the
  // initial route -- someone signing out from Profile shouldn't still be
  // able to see Home if they navigate back.
  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.body.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: ({ color, size }) => <Feather name="compass" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="projects"
        options={{ title: 'Projects', tabBarIcon: ({ color, size }) => <Feather name="folder" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: ({ color, size }) => <Feather name="message-circle" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
