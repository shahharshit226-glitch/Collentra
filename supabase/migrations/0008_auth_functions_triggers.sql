-- 0008_auth_functions_triggers.sql
-- Enforcement that must NOT depend on the client: KIIT-domain restriction,
-- profile bootstrap on signup, and syncing Supabase's own email
-- verification state into profiles.account_status.
--
-- These triggers live on auth.users. Applying this migration requires a
-- role with privileges on the auth schema -- run it via the Supabase SQL
-- editor or the Supabase CLI (`supabase db push`), not via the anon/service
-- REST API. See SUPABASE_SETUP.md section 4.

-- 1. Reject account creation outright if the email isn't a KIIT address.
--    Applies to BOTH password signup and Google OAuth, because Supabase
--    writes every provider's user into the same auth.users row.
create or replace function fn_enforce_kiit_domain()
returns trigger language plpgsql as $$
begin
  if new.email is null or new.email !~* '^[^@]+@kiit\.ac\.in$' then
    raise exception
      'Only @kiit.ac.in email addresses may register for Collentra.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_kiit_domain
  before insert on auth.users
  for each row execute function fn_enforce_kiit_domain();

-- 2. On successful (post-trigger-1) user creation, bootstrap the profile
--    rows. Username starts as the email's local part; the client should
--    prompt the user to pick a real one during onboarding (spec section 10).
create or replace function fn_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text := regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g');
  final_username text := base_username;
  suffix int := 0;
begin
  while exists (select 1 from profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into profiles (id, username, full_name, account_status)
    values (new.id, final_username, coalesce(new.raw_user_meta_data->>'full_name', 'New Student'),
            (case when new.email_confirmed_at is not null then 'verified' else 'pending' end)::account_status);

  insert into profile_private (profile_id, kiit_email)
    values (new.id, new.email);

  insert into availability (profile_id) values (new.id);

  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function fn_handle_new_user();

-- 3. When Supabase marks the email confirmed (magic link / OTP click),
--    flip the profile from pending -> verified.
create or replace function fn_handle_email_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update profiles set account_status = 'verified'
     where id = new.id and account_status = 'pending';
  end if;
  return new;
end;
$$;

create trigger trg_auth_user_confirmed
  after update on auth.users
  for each row execute function fn_handle_email_confirmed();

-- 4. Contact-email RPC used by the "Email" button (spec section 39/82).
--    Never expose profile_private.kiit_email through a normal SELECT --
--    only through this function, which checks eligibility first.
create or replace function get_contact_email(target_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  result text;
begin
  if caller is null or caller = target_id then
    return null;
  end if;

  if is_blocked_pair(caller, target_id) then
    return null;
  end if;

  if not exists (
    select 1 from connections
     where status = 'accepted'
       and ((requester_id = caller and addressee_id = target_id)
         or (requester_id = target_id and addressee_id = caller))
  ) then
    return null;
  end if;

  select kiit_email into result from profile_private where profile_id = target_id;
  return result;
end;
$$;

-- 5. Profile completion percentage, computed on demand (not stored/derived
--    via trigger, since it depends on rows in several other tables).
create or replace function fn_profile_completion_pct(p_id uuid)
returns smallint language sql stable as $$
  select (
    (case when p.bio is not null and length(p.bio) > 0 then 1 else 0 end) +
    (case when p.avatar_url is not null then 1 else 0 end) +
    (case when p.branch is not null then 1 else 0 end) +
    (case when p.year is not null then 1 else 0 end) +
    (case when exists (select 1 from student_skills where student_id = p.id) then 1 else 0 end) +
    (case when exists (select 1 from student_interests where student_id = p.id) then 1 else 0 end) +
    (case when exists (select 1 from student_preferred_roles where student_id = p.id) then 1 else 0 end) +
    (case when exists (select 1 from availability a where a.profile_id = p.id) then 1 else 0 end)
  ) * 100 / 8
  from profiles p where p.id = p_id;
$$;
