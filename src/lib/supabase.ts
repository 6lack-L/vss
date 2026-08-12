import { createServerClient, createBrowserClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project credentials.'
  );
}

/**
 * Request-scoped client. Sessions live in httpOnly cookies rather than
 * localStorage, so the server can read them during SSR.
 *
 * @supabase/ssr expects the getAll/setAll cookie pair; the older
 * get/set/remove triple is deprecated and misbehaves on token refresh.
 */
export function createSupabaseServerClient(
  cookies: AstroCookies,
  request: Request,
  headers: Headers
) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      // AstroCookies has no enumeration API, so read the raw request header.
      // Session tokens are chunked across several cookies, which is why
      // getAll must return all of them rather than a known name.
      getAll() {
        return parseCookieHeader(request.headers.get('cookie') ?? '')
          .filter((c): c is { name: string; value: string } => typeof c.value === 'string');
      },
      setAll(cookiesToSet, responseHeaders) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.set(name, value, { ...options, path: options?.path ?? '/' });
        }
        // Responses that set auth cookies must never be cached by a CDN,
        // or one visitor's session token can be served to another.
        for (const [key, value] of Object.entries(responseHeaders)) {
          headers.set(key, value);
        }
      },
    },
  });
}

/** Browser client, for the few places that mutate optimistically. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
