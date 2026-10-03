import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Button, Input } from '@/components/ui';

export default function LoginScreen() {
  const { colors, spacing, type, fontFamily } = useTheme();
  const { signInWithPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    setFormError(undefined);

    // Fast client-side check before ever hitting the network -- the
    // database trigger (migration 0008) is the real backstop, but most
    // students should never get as far as needing it (see lib/authErrors.ts).
    if (!email.toLowerCase().endsWith('@kiit.ac.in')) {
      setEmailError('Use your @kiit.ac.in email to sign in.');
      return;
    }
    setEmailError(undefined);

    setSubmitting(true);
    const { error } = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
    if (error) {
      setFormError(error);
    }
    // On success there's nothing else to do here: the session updates,
    // (auth)/_layout.tsx notices, and redirects to the tabs on its own.
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing['2xl'], justifyContent: 'center', gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.display.fontSize }}>
            Collentra
          </Text>
          <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.body.fontSize }}>
            Sign in with your KIIT account to find your next collaborator.
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <Input
            label="KIIT email"
            placeholder="yourname@kiit.ac.in"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            error={emailError}
          />
          <Input
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {formError ? (
            <Text style={{ color: colors.danger, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
              {formError}
            </Text>
          ) : null}
          <Button label="Sign in" onPress={handleContinue} loading={submitting} />
        </View>

        <Link href="/(auth)/register" style={{ alignSelf: 'center' }}>
          <Text style={{ color: colors.primary, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>
            New here? Create an account
          </Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
