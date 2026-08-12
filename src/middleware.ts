import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase';
import type { Profile } from './lib/types';

/** Routes that require a signed-in user; anything else is public. */
const PROTECTED_PREFIXES = ['/settings'];

export const onRequest = defineMiddleware(async (context, next) => {
  // Prerendered routes are rendered at build time, where there is no real
  // request and no cookie jar. Touching Supabase here would break the build.
  if (context.isPrerendered) {
    return next();
  }

  const headers = new Headers();
  const supabase = createSupabaseServerClient(context.cookies, context.request, headers);

  context.locals.supabase = supabase;

  context.locals.user = null;
  context.locals.profile = null;

  try {
    // getUser() revalidates the token with Supabase rather than trusting the
    // cookie contents. Called before any response is generated so a refreshed
    // session can still be written to cookies.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    context.locals.user = user ?? null;

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, created_at')
        .eq('id', user.id)
        .maybeSingle();
      context.locals.profile = (data as Profile) ?? null;
    }
  } catch (err) {
    // Supabase unreachable or misconfigured. Treat the visitor as signed out
    // so public pages still render, rather than 500-ing the whole site.
    console.error('Auth check failed; continuing as signed out.', err);
  }

  const { pathname, search } = context.url;

  if (
    !context.locals.user &&
    PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return context.redirect(`/login?next=${encodeURIComponent(pathname + search)}`, 302);
  }

  const response = await next();

  // Merge any cache headers Supabase asked for onto the outgoing response.
  headers.forEach((value, key) => response.headers.set(key, value));

  return response;
});
