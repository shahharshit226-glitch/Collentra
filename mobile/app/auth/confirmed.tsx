import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

type Result = 'verifying' | 'success' | 'error';

export default function EmailConfirmedScreen() {
  const { colors, spacing, type, fontFamily, radius } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ token_hash?: string; type?: string; error_description?: string }>();
  const [result, setResult] = useState<Result>('verifying');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function confirmEmail() {
      try {
        if (params.error_description) throw new Error(String(params.error_description));

        // Supabase may return either a token hash (PKCE/email template flow)
        // or a session in the URL fragment after verifying the email.
        const initialUrl = await Linking.getInitialURL();
        const fragment = initialUrl?.split('#')[1] ?? '';
        const fragmentParams = new URLSearchParams(fragment);
        const accessToken = fragmentParams.get('access_token');
        const refreshToken = fragmentParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        } else if (params.token_hash && params.type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: String(params.token_hash),
            type: String(params.type) as 'signup',
          });
          if (error) throw error;
        }

        // Supabase's verification redirect can establish the session before
        // this screen mounts. Give the auth listener a moment to publish it.
        setResult('success');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'This confirmation link may have expired.');
        setResult('error');
      }
    }

    void confirmEmail();
  }, [params.error_description, params.token_hash, params.type]);

  useEffect(() => {
    if (result !== 'success') return;
    const timer = setTimeout(() => router.replace(session ? '/(tabs)/home' : '/(auth)/login'), 2400);
    return () => clearTimeout(timer);
  }, [result, router, session]);

  const success = result === 'success';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing['2xl'], justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: spacing.xl }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: success ? colors.successMuted : colors.primaryMuted }}>
            {result === 'verifying' ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : (
              <Feather name={success ? 'check' : 'alert-circle'} size={36} color={success ? colors.success : colors.danger} />
            )}
          </View>

          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize, textAlign: 'center' }}>
              {result === 'verifying' ? 'Confirming your email' : success ? 'You’re all set!' : 'We couldn’t confirm your email'}
            </Text>
            <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, textAlign: 'center' }}>
              {result === 'verifying'
                ? 'Just a moment while we verify your KIIT email.'
                : success
                  ? 'Your Collentra account is verified. Let’s find your people and start building together.'
                  : message || 'This confirmation link may have expired. Please request a new one and try again.'}
            </Text>
          </View>

          {success ? (
            <View style={{ width: '100%', gap: spacing.md, alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ width: '100%' }}>
                <Button label={session ? 'Go to Collentra' : 'Sign in to Collentra'} onPress={() => router.replace(session ? '/(tabs)/home' : '/(auth)/login')} />
              </View>
              <Text style={{ color: colors.inkFaint, fontFamily: fontFamily.body.regular, fontSize: type.caption.fontSize }}>
                Taking you there automatically…
              </Text>
            </View>
          ) : result === 'error' ? (
            <View style={{ width: '100%', marginTop: spacing.md }}>
              <Button label="Go to sign in" onPress={() => router.replace('/(auth)/login')} />
            </View>
          ) : null}

          <View style={{ marginTop: spacing['2xl'], paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted }}>
            <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: type.caption.fontSize }}>COLLENTRA  ·  BUILT TOGETHER</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
