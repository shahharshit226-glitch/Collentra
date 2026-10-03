import { supabase } from './supabase';
import type { HoursRange } from './types';

export type DaysPreference = 'weekdays' | 'weekends' | 'both';

export type StudentPreferences = {
  skillIds: string[];
  interestIds: string[];
  roleIds: string[];
  hoursPerWeek: HoursRange;
  preferredDays: DaysPreference;
};

export async function fetchStudentPreferences(userId: string): Promise<{ data: StudentPreferences | null; error: string | null }> {
  const [skills, interests, roles, availability] = await Promise.all([
    supabase.from('student_skills').select('skill_id').eq('student_id', userId),
    supabase.from('student_interests').select('interest_id').eq('student_id', userId),
    supabase.from('student_preferred_roles').select('role_id').eq('student_id', userId),
    supabase.from('availability').select('hours_per_week, preferred_days').eq('profile_id', userId).maybeSingle(),
  ]);
  const error = skills.error ?? interests.error ?? roles.error ?? availability.error;
  if (error) return { data: null, error: error.message || "Couldn't load your matching preferences." };
  if (!availability.data) return { data: null, error: 'Your availability settings could not be found. Please contact support.' };
  return {
    data: {
      skillIds: (skills.data ?? []).map((row) => row.skill_id),
      interestIds: (interests.data ?? []).map((row) => row.interest_id),
      roleIds: (roles.data ?? []).map((row) => row.role_id),
      hoursPerWeek: availability.data.hours_per_week,
      preferredDays: availability.data.preferred_days,
    },
    error: null,
  };
}

export async function saveStudentPreferences(preferences: StudentPreferences): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('fn_update_student_preferences', {
    p_skill_ids: preferences.skillIds,
    p_interest_ids: preferences.interestIds,
    p_role_ids: preferences.roleIds,
    p_hours_per_week: preferences.hoursPerWeek,
    p_preferred_days: preferences.preferredDays,
  });
  return { error: error ? (error.message || "Couldn't save your matching preferences.") : null };
}
