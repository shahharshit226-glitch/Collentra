# Collentra — Matching Algorithm

Deterministic, weighted, entirely SQL — no AI/LLM/embeddings anywhere in
this file, per the spec's hard constraint. Runnable form:
`supabase/migrations/0010_matching_functions.sql`.

## Why SQL functions, not app code

The scorers need to read every candidate's skills/interests/roles/team
membership, which a normal student's RLS grant does not allow directly
(see `RLS_POLICIES.md`). Running the scoring **inside Postgres** as
`SECURITY DEFINER` functions means: (a) it's fast — one round trip per
recommendation list, not N; (b) it can't be tampered with client-side;
(c) it satisfies §80 ("don't run matching on-device").

## The six factors

| Factor | Weight | Function | What it measures |
|---|---|---|---|
| Skill Match | 40% | `fn_skill_match_score` | `matched_required_skills / total_required_skills` |
| Interest Match | 20% | `fn_interest_match_score` | project's tagged interests ∩ student's interests, over total tagged |
| Role Match | 15% | `fn_role_match_score` | project's required roles ∩ student's preferred roles, over total required |
| Complementary Skills | 10% | `fn_complementary_score` | of the skills the **current team** is missing, how many this candidate covers |
| Availability | 10% | `fn_availability_score` | 70% weekly-hours proximity + 30% day-of-week flexibility |
| Other | 5% | `fn_other_score` | admin-extensible; MVP default is same-branch relevance to the project creator — never gender, never inferred personality (§32) |

`fn_match_score(student, project)` reads the current weights from
`matching_settings` (so an admin edit via the dashboard takes effect
immediately, no redeploy) and combines them.

### A note on "0 of 0"

If a project has no required skills/roles/interests tagged at all, the
corresponding scorer returns `100` rather than `0` or `NULL` — an empty
requirement shouldn't penalize every candidate equally toward zero. This
matters mainly during onboarding, before a project owner has filled in
requirements yet.

## Worked example (matches spec §27/§33 exactly)

Project requires: `Python, React, SQL, OpenCV`. Candidate has:
`Python, React, MongoDB`.

```
Skill match   = 2/4 = 50%      → 50 × 0.40 = 20.0
Interest match (assume 90%)    → 90 × 0.20 = 18.0
Role match (assume 100%)       → 100 × 0.15 = 15.0
Complementary (assume 90%)     → 90 × 0.10 = 9.0
Availability (assume 80%)      → 80 × 0.10 = 8.0
Other (assume 80%)             → 80 × 0.05 = 4.0
                                          ------
                                Final  =  74.0
```

(Spec §33's own example uses a skill score of 85 rather than the 50 from
its §27 example — the two sections use different candidates; the formula
is identical either way. Run `select fn_match_score(<student>, <project>)`
in the SQL editor against real seed data to see the actual number.)

## Complementary skills — why it needs the team, not just the project

A candidate who matches the project's required skills isn't necessarily
useful if the team already has three people who know Python and nobody
who knows MongoDB. `fn_complementary_score` computes the team's **current
gap** first (required skills minus skills already covered by active
`project_members`), then scores the candidate only against that gap. A
solo project (no members yet beside the creator) has its full requirement
list as the "gap", so complementarity and skill-match will often agree
early on and diverge as the team fills in.

## Recommended Partners vs. Group Recommendation

- `fn_recommended_partners(project_id, limit)` — ranks individual
  candidates by `fn_match_score`, for "find one more person."
- `fn_group_recommendation(project_id, group_size)` — a **greedy
  set-cover**: repeatedly picks the eligible candidate who covers the most
  still-uncovered required skills, until the gap is filled or
  `group_size` is reached. This directly implements §36's requirement to
  maximize *team* coverage rather than just stack-ranking individuals (a
  set-cover approach can legitimately recommend someone with a mediocre
  individual score if they're the only one who covers a skill nobody else
  does).

## Random Discovery

`fn_discover_candidate(user_id)` is not literally random over all
students — it applies the eligibility filter (verified, available, not
blocked, not skipped in the last 7 days) and a **minimum compatibility
threshold** (`matching_settings.min_discovery_threshold`, default 40)
before picking randomly from the qualifying pool, per §37. Compatibility
here (`fn_profile_compatibility`) is a lighter, project-independent score:
50% shared-interest overlap, 50% complementary (non-overlapping) skills —
which is what produces the "Potential collaboration: Web + NLP" framing
the spec's example shows, without hand-authoring it.

## "Do not display the score" (§34)

`fn_match_score` and friends return a 0–100 number for internal ranking.
The client should **never** render that number to a normal student —
translate it into qualitative copy instead, e.g.:

```
score >= 80  → "Strong Skill Match — you match N of M required skills."
score 50-79  → "Good Fit — your <skill> experience is relevant here."
score < 50   → generally not shown at all (below the discovery threshold
               or simply not surfaced in "Recommended Partners")
```

Admins can see the raw numeric score (it's the same function, just called
from the admin dashboard, which has `is_admin() = true`).

## Determinism & testing (spec §94)

Every scorer is a pure `STABLE` SQL/PL-pgSQL function: identical inputs
(same rows in the underlying tables) always produce the same output.
Unit-test them directly in the SQL editor or via `pgTAP`:

```sql
-- fixture: project P requires Python, OpenCV, React, SQL
-- fixture: student S has Python, React, MongoDB, and interest 'AI', role 'Backend Developer'
select fn_skill_match_score(S, P);      -- expect 50.00
select fn_complementary_score(S, P);    -- expect based on current team gap
select fn_match_score(S, P);            -- expect same result on repeated calls
```

Also test the eligibility filters directly (§26): an unverified, blocked,
or already-full-team candidate must never appear in
`fn_recommended_partners` output regardless of how high their raw score
would be — this is enforced in the `WHERE` clause of that function, not
inside `fn_match_score` itself, so verify both layers independently.

## Changing the weights safely

`matching_settings` has a `CHECK` constraint enforcing the six weights sum
to exactly 100 (§62) — an admin dashboard update that doesn't sum to 100
is rejected at the database level, not just in the UI, so this can't be
bypassed by calling the table's REST endpoint directly either.
