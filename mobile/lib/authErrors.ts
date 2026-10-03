import type { AuthError } from '@supabase/supabase-js';

/**
 * Never show a raw Supabase/Postgres error to a student (spec §75 -- no
 * "PostgrestException 23505" equivalents). This intentionally stays a
 * short, known list rather than trying to parse every possible message;
 * anything unrecognized falls through to a safe generic line.
 *
 * One nuance worth knowing: the KIIT-domain rejection is enforced by a
 * Postgres trigger (migration 0008, fn_enforce_kiit_domain) on
 * auth.users. Supabase's GoTrue service often wraps a trigger's raised
 * exception in its own generic "Database error saving new user" message
 * rather than passing the trigger's custom text through untouched -- the
 * exact wording can vary by Supabase version. That's why both screens
 * also do a client-side @kiit.ac.in check before ever calling signUp:
 * that's what most students will actually see; the trigger is the
 * guaranteed backstop for anyone who gets past the client check.
 */
export function toFriendlyAuthMessage(error: AuthError): string {
  const msg = error.message.toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please verify your email before signing in — check your inbox for the confirmation link.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'An account already exists for that email. Try signing in instead.';
  }
  if (msg.includes('password') && msg.includes('at least')) {
    return 'Password is too short — use at least 8 characters.';
  }
  if (msg.includes('database error saving new user') || msg.includes('kiit.ac.in')) {
    return 'Only @kiit.ac.in email addresses can register for Collentra.';
  }
  if (msg.includes('network')) {
    return "Couldn't reach the server. Check your internet connection and try again.";
  }

  return 'Something went wrong. Please try again.';
}
