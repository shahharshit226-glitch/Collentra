import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Button, Input } from '@/components/ui';

export default function RegisterScreen() {
  const { colors, spacing, type, fontFamily } = useTheme();
  const { signUpWithPassword } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [checkEmailMessage, setCheckEmailMessage] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateAccount() {
    setFormError(undefined);
    setCheckEmailMessage(undefined);

    if (!email.toLowerCase().endsWith('@kiit.ac.in')) {
      setEmailError('Only @kiit.ac.in email addresses can register.');
      return;
    }
    setEmailError(undefined);

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    const { error, needsEmailConfirmation } = await signUpWithPassword(email.trim(), password, fullName.trim());
    setSubmitting(false);

    if (error) {
      setFormError(error);
      return;
    }
    if (needsEmailConfirmation) {
      // No session yet -- this is expected with "Confirm email" turned on
      // (SUPABASE_SETUP.md §3), not an error. The (auth) layout won't
      // redirect until the student clicks the link and signs in.
      setCheckEmailMessage(`We sent a confirmation link to ${email.trim()}. Verify it, then sign in.`);
    }
    // If a session came back immediately (email confirmation disabled),
    // (auth)/_layout.tsx redirects on its own -- nothing else to do here.
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing['2xl'], justifyContent: 'center', gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize }}>
            Create your account
          </Text>
          <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.body.fontSize }}>
            You'll verify your KIIT email before you can start collaborating.
          </Text>
        </View>

        {checkEmailMessage ? (
          <View style={{ backgroundColor: colors.successMuted, borderRadius: 14, padding: spacing.md }}>
            <Text style={{ color: colors.success, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>
              {checkEmailMessage}
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Input label="Full name" placeholder="Your name" value={fullName} onChangeText={setFullName} />
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
              placeholder="At least 8 characters"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {formError ? (
              <Text style={{ color: colors.danger, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>
                {formError}
              </Text>
            ) : null}
            <Button label="Create account" onPress={handleCreateAccount} loading={submitting} />
          </View>
        )}

        <Link href="/(auth)/login" style={{ alignSelf: 'center' }}>
          <Text style={{ color: colors.primary, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize }}>
            Already have an account? Sign in
          </Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
