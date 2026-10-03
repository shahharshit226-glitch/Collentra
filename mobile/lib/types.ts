export type HoursRange = '0-5' | '5-10' | '10-15' | '15+';

export type ProjectStatus =
  | 'looking_for_members'
  | 'team_forming'
  | 'full'
  | 'in_progress'
  | 'completed'
  | 'archived';

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export type SkillRow = { id: string; name: string; category: string };
export type InterestRow = { id: string; name: string };
export type RoleRow = { id: string; name: string };

export type ProjectSummary = {
  id: string;
  title: string;
  domain: string | null;
  status: ProjectStatus;
  team_size: number;
  current_member_count: number;
  creator_id: string;
  created_at: string;
  required_skill_names: string[];
};

export type ProjectDetail = ProjectSummary & {
  description: string;
  expected_hours_per_week: HoursRange | null;
};

export type MemberRow = {
  student_id: string;
  full_name: string;
  username: string;
  is_owner: boolean;
};

export type ApplicationRow = {
  id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_username: string;
  message: string | null;
  status: ApplicationStatus;
  created_at: string;
};
