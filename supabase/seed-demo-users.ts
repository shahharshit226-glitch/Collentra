/**
 * seed-demo-users.ts
 *
 * Creates fake demo accounts for local development / the college demo
 * (spec sections 105-106). Run with: `npx tsx supabase/seed-demo-users.ts`
 *
 * Why not raw SQL? auth.users rows must be created through Supabase Auth
 * (GoTrue) so passwords are hashed correctly and email_confirmed_at is set
 * consistently -- inserting directly into auth.users bypasses that and is
 * unsupported. This script uses the SERVICE ROLE key, which must never
 * ship in the mobile app or be committed to git.
 *
 * Requires in .env (NOT .env.example -- keep this file out of git):
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoConfirm: true } }
);

const DEMO_USERS = [
  { email: "priya.demo@kiit.ac.in", full_name: "Priya Sharma", skills: ["React", "UI/UX", "Figma"], interests: ["Web Development"], roles: ["Frontend Developer", "UI/UX Designer"] },
  { email: "rahul.demo@kiit.ac.in", full_name: "Rahul Verma", skills: ["Python", "Machine Learning", "NLP"], interests: ["Artificial Intelligence"], roles: ["AI/ML Developer"] },
  { email: "aman.demo@kiit.ac.in", full_name: "Aman Gupta", skills: ["Node.js", "MongoDB", "REST API"], interests: ["Web Development"], roles: ["Backend Developer"] },
  { email: "sneha.demo@kiit.ac.in", full_name: "Sneha Das", skills: ["Cybersecurity", "Docker"], interests: ["Cybersecurity", "Cloud Computing"], roles: ["Cybersecurity"] },
];

async function main() {
  const nameToSkillId = new Map<string, string>();
  const nameToInterestId = new Map<string, string>();
  const nameToRoleId = new Map<string, string>();

  for (const table of ["skills", "interests", "roles"] as const) {
    const { data, error } = await supabase.from(table).select("id, name");
    if (error) throw error;
    const map = table === "skills" ? nameToSkillId : table === "interests" ? nameToInterestId : nameToRoleId;
    data!.forEach((row) => map.set(row.name, row.id));
  }

  for (const u of DEMO_USERS) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: "Demo@1234",
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (error) {
      console.error(`skip ${u.email}: ${error.message}`);
      continue;
    }
    const uid = created.user!.id;

    // Profile row + availability row already exist via fn_handle_new_user().
    await supabase.from("profiles").update({
      is_available_to_collaborate: true,
      branch: "CSE",
      year: 3,
    }).eq("id", uid);

    for (const s of u.skills) {
      const id = nameToSkillId.get(s);
      if (id) await supabase.from("student_skills").insert({ student_id: uid, skill_id: id });
    }
    for (const i of u.interests) {
      const id = nameToInterestId.get(i);
      if (id) await supabase.from("student_interests").insert({ student_id: uid, interest_id: id });
    }
    for (const r of u.roles) {
      const id = nameToRoleId.get(r);
      if (id) await supabase.from("student_preferred_roles").insert({ student_id: uid, role_id: id });
    }
    console.log(`seeded ${u.email}`);
  }

  console.log("Done. Create a sample project through the app UI (or an "
    + "authenticated insert) using one seeded user as creator, then run "
    + "fn_recommended_partners() from the SQL editor to sanity-check scores.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
