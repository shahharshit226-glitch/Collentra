import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

/** Already signed in? Don't show the login/register screens -- bounce
 * straight to the tabs. This is what makes a successful sign-in in
 * login.tsx "just work" without that screen manually navigating: the
 * session updates via onAuthStateChange, this layout re-renders, and the
 * Redirect below fires. */
export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (!loading && session) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
