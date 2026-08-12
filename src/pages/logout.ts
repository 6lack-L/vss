import type { APIRoute } from 'astro';

/**
 * POST only. A GET logout link would be triggered by link prefetching and by
 * the ClientRouter's speculative navigation, signing people out by accident.
 */
export const POST: APIRoute = async ({ locals, redirect }) => {
  await locals.supabase.auth.signOut();
  return redirect('/', 303);
};

export const GET: APIRoute = () => new Response('Method not allowed', { status: 405 });
