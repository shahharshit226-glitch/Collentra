type DbErrorLike = { code?: string; message?: string } | null | undefined;

/**
 * Only claim "check your connection" when the request genuinely never
 * reached the server. A 403 from Supabase means the server answered and
 * said no (a permissions/RLS rejection) -- telling the student to check
 * their Wi-Fi in that case sends them chasing the wrong problem.
 */
export function describeDbError(error: DbErrorLike, fallback: string): string {
  const code = error?.code ?? '';
  const message = (error?.message ?? '').toLowerCase();

  if (message.includes('network request failed') || message.includes('failed to fetch')) {
    return "Couldn't reach the server. Check your internet connection and try again.";
  }
  if (code === '42501') {
    return "You don't have permission to do that. Make sure your email is verified, then try again.";
  }
  if (code === '23505') {
    return 'That already exists.';
  }
  return fallback;
}

/** Dev-only breadcrumb: the error code and message, never user content. */
export function logDbError(context: string, error: DbErrorLike): void {
  if (__DEV__ && error) {
    console.warn(`[collentra] ${context} failed`, error.code ?? '', error.message ?? '');
  }
}
