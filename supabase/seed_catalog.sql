-- seed_catalog.sql
-- Reference catalogues from spec sections 11/12/14. Safe to run directly:
-- no auth.users rows involved. Run demo student/project seeding separately
-- via seed-demo-users.ts (see SUPABASE_SETUP.md section 9) because student
-- accounts must go through Supabase Auth, not a raw INSERT into auth.users.

insert into skills (name, category) values
  ('C', 'Programming'), ('C++', 'Programming'), ('Java', 'Programming'),
  ('Python', 'Programming'), ('JavaScript', 'Programming'), ('TypeScript', 'Programming'),
  ('Kotlin', 'Programming'), ('Dart', 'Programming'),
  ('HTML', 'Web'), ('CSS', 'Web'), ('React', 'Web'), ('Next.js', 'Web'),
  ('Node.js', 'Web'), ('Express', 'Web'), ('REST API', 'Web'),
  ('MySQL', 'Database'), ('PostgreSQL', 'Database'), ('MongoDB', 'Database'), ('Firebase', 'Database'),
  ('Machine Learning', 'AI/Data'), ('Deep Learning', 'AI/Data'), ('NLP', 'AI/Data'),
  ('Computer Vision', 'AI/Data'), ('OpenCV', 'AI/Data'), ('Data Science', 'AI/Data'),
  ('SQL', 'Database'),
  ('React Native', 'Mobile'), ('Flutter', 'Mobile'), ('Android', 'Mobile'),
  ('AWS', 'Cloud/DevOps'), ('Docker', 'Cloud/DevOps'), ('Git', 'Cloud/DevOps'),
  ('GitHub', 'Cloud/DevOps'), ('CI/CD', 'Cloud/DevOps'),
  ('UI/UX', 'Design'), ('Figma', 'Design'), ('Graphic Design', 'Design'),
  ('Cybersecurity', 'Other'), ('IoT', 'Other'), ('Blockchain', 'Other'),
  ('Research', 'Other'), ('Documentation', 'Other'), ('Presentation', 'Other'),
  ('Project Management', 'Other')
on conflict (name) do nothing;

insert into interests (name, category) values
  ('Artificial Intelligence', 'Tech'), ('Web Development', 'Tech'),
  ('Mobile Development', 'Tech'), ('Cybersecurity', 'Tech'),
  ('Cloud Computing', 'Tech'), ('Data Science', 'Tech'), ('IoT', 'Tech'),
  ('Blockchain', 'Tech'), ('FinTech', 'Domain'), ('EdTech', 'Domain'),
  ('Healthcare', 'Domain'), ('Social Impact', 'Domain'), ('Startups', 'Domain'),
  ('Research', 'Domain'), ('Open Source', 'Domain')
on conflict (name) do nothing;

-- Admin-managed synonym mapping (spec section 61 example).
insert into interest_aliases (interest_id, alias)
  select id, alias from interests, (values ('ML'), ('Machine Learning')) as a(alias)
  where interests.name = 'Artificial Intelligence'
on conflict do nothing;

insert into roles (name) values
  ('Frontend Developer'), ('Backend Developer'), ('Full Stack Developer'),
  ('Mobile Developer'), ('AI/ML Developer'), ('Data Scientist'),
  ('UI/UX Designer'), ('DevOps Engineer'), ('Cybersecurity'),
  ('Researcher'), ('Project Manager'), ('Documentation'), ('Presenter'), ('Other')
on conflict (name) do nothing;
