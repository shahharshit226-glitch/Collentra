import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toFriendlyAuthMessage } from '@/lib/authErrors';
import * as Linking from 'expo-linking';

type AuthResult = { error: string | null; needsEmailConfirmation?: boolean };

type Auth = {
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Fires on sign-in, sign-out, and token refresh -- this is what makes
    // the (auth)/(tabs) layout guards react automatically without any
    // screen having to manually navigate after a successful call below.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<Auth>(
    () => ({
      session,
      loading,
      async signInWithPassword(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? toFriendlyAuthMessage(error) : null };
      },
      async signUpWithPassword(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: Linking.createURL('auth/confirmed'),
          },
        });
        if (error) return { error: toFriendlyAuthMessage(error) };
        // With "Confirm email" enabled in Supabase (see SUPABASE_SETUP.md
        // §3), signUp succeeds but returns no session until the student
        // clicks the confirmation link -- that's not an error, it's the
        // expected next step, so the screen needs to tell them to check
        // their inbox rather than expecting an automatic redirect.
        return { error: null, needsEmailConfirmation: !data.session };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be called inside an <AuthProvider>.');
  }
  return ctx;
}
