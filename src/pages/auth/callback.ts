import type { APIRoute } from 'astro';

/**
 * Exchanges a Supabase auth code for a session cookie.
 *
 * Two flows land here:
 *  - email confirmation / magic links, after the user clicks through
 *  - OAuth providers (Google), on the way back from the consent screen
 *
 * Set this URL as a Redirect URL in Supabase → Authentication → URL
 * Configuration, for every origin you deploy to.
 */
export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const code = url.searchParams.get('code');
  const errorDescription = url.searchParams.get('error_description');

  if (errorDescription) {
    return redirect(`/login?error=${encodeURIComponent(errorDescription)}`, 303);
  }

  if (!code) {
    return redirect('/login?error=Missing+auth+code', 303);
  }

  const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`, 303);
  }

  // Same-origin paths only, so a crafted ?next= cannot bounce a
  // freshly-authenticated user to another site.
  const raw = url.searchParams.get('next');
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  return redirect(next, 303);
};
