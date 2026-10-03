import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export type ProfileRow = {
  id: string;
  username: string;
  full_name: string;
  school: string | null;
  bio: string | null;
  branch: string | null;
  year: number | null;
  semester: number | null;
  gender: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  is_available_to_collaborate: boolean;
};

type ProfileUpdate = Partial<
  Pick<ProfileRow, 'full_name' | 'school' | 'bio' | 'branch' | 'year' | 'semester' | 'gender' | 'github_url' | 'linkedin_url' | 'is_available_to_collaborate'>
>;

type ProfileContextValue = {
  profile: ProfileRow | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<{ error: string | null }>;
};

const PROFILE_COLUMNS =
  'id, username, full_name, school, bio, branch, year, semester, gender, github_url, linkedin_url, is_available_to_collaborate';

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * Single shared copy of the signed-in user's `profiles` row, so the
 * Profile tab and the Edit Profile screen never disagree with each other
 * -- a save in one immediately updates the other without a refetch race,
 * because they're reading the same context state.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', session.user.id)
      .single();

    if (error) {
      setError("Couldn't load your profile. Check your connection and try again.");
    } else {
      setProfile(data as ProfileRow);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProfile = useCallback(
    async (patch: ProfileUpdate) => {
      if (!session) return { error: 'Not signed in.' };
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session.user.id)
        .select(PROFILE_COLUMNS)
        .single();

      if (error) {
        return { error: "Couldn't save your changes. Check your connection and try again." };
      }
      setProfile(data as ProfileRow);
      return { error: null };
    },
    [session]
  );

  return (
    <ProfileContext.Provider value={{ profile, loading, error, refresh, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile() must be called inside a <ProfileProvider>.');
  }
  return ctx;
}
