import { supabase } from './supabase';
import type { InterestRow, RoleRow, SkillRow } from './types';

export async function fetchSkills(): Promise<{ data: SkillRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('skills')
    .select('id, name, category')
    .eq('is_active', true)
    .order('category')
    .order('name');
  if (error) return { data: [], error: "Couldn't load the skills list." };
  return { data: data as SkillRow[], error: null };
}

export async function fetchRoles(): Promise<{ data: RoleRow[]; error: string | null }> {
  const { data, error } = await supabase.from('roles').select('id, name').order('name');
  if (error) return { data: [], error: "Couldn't load the roles list." };
  return { data: data as RoleRow[], error: null };
}

export async function fetchInterests(): Promise<{ data: InterestRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('interests')
    .select('id, name')
    .eq('is_active', true)
    .order('name');
  if (error) return { data: [], error: "Couldn't load the interests list." };
  return { data: data as InterestRow[], error: null };
}
