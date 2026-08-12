import type { SupabaseClient } from '@supabase/supabase-js';
import type { Listing, Location, Reply, ReplyNode } from './types';

/**
 * One select string for every listing query. Author and counts come back
 * embedded, so the feed is a single round trip rather than N+1.
 */
const LISTING_SELECT = `
  id, author_id, title, body, location, skills, contact, expires_at, created_at, updated_at,
  author:profiles!listings_author_id_fkey (id, username, display_name, avatar_url),
  replies (count),
  reactions (count)
`;

/** PostgREST returns embedded aggregates as [{ count: n }]. */
type RawListing = Omit<Listing, 'reply_count' | 'reaction_count'> & {
  replies?: { count: number }[] | null;
  reactions?: { count: number }[] | null;
};

function shape(row: RawListing): Listing {
  const { replies, reactions, ...rest } = row;
  return {
    ...rest,
    reply_count: replies?.[0]?.count ?? 0,
    reaction_count: reactions?.[0]?.count ?? 0,
  };
}

export interface ListingQuery {
  location?: string | null;
  sort?: 'newest' | 'oldest';
  q?: string | null;
  authorId?: string | null;
  /** Hide listings whose expiry has passed. */
  openOnly?: boolean;
  limit?: number;
}

export async function fetchListings(
  supabase: SupabaseClient,
  opts: ListingQuery = {}
): Promise<Listing[]> {
  const { location, sort = 'newest', q, authorId, openOnly = false, limit = 50 } = opts;

  let query = supabase.from('listings').select(LISTING_SELECT);

  if (location) query = query.eq('location', location);
  if (authorId) query = query.eq('author_id', authorId);
  if (openOnly) query = query.or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);

  if (q) {
    // Escape PostgREST's filter delimiters so a search for "a,b" or "a)b"
    // cannot break out of the or() expression.
    const safe = q.replace(/[,()\\]/g, ' ').trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,body.ilike.%${safe}%,skills.ilike.%${safe}%`);
  }

  query = query.order('created_at', { ascending: sort === 'oldest' }).limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error('fetchListings failed', error);
    return [];
  }
  return (data as unknown as RawListing[]).map(shape);
}

export async function fetchListing(
  supabase: SupabaseClient,
  id: string
): Promise<Listing | null> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('fetchListing failed', error);
    return null;
  }
  return data ? shape(data as unknown as RawListing) : null;
}

/**
 * Which of these listings the viewer has already reacted to. One extra query
 * for the whole page, rather than one per card.
 */
export async function fetchViewerReactions(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  listingIds: string[]
): Promise<Set<string>> {
  if (!userId || listingIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('reactions')
    .select('listing_id')
    .eq('user_id', userId)
    .in('listing_id', listingIds);

  if (error) {
    console.error('fetchViewerReactions failed', error);
    return new Set();
  }
  return new Set((data ?? []).map(r => r.listing_id as string));
}

export async function fetchLocations(supabase: SupabaseClient): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('slug, name')
    .order('sort', { ascending: true });

  if (error) {
    console.error('fetchLocations failed', error);
    return [];
  }
  return (data ?? []) as Location[];
}

export async function fetchReplies(
  supabase: SupabaseClient,
  listingId: string
): Promise<Reply[]> {
  const { data, error } = await supabase
    .from('replies')
    .select(`
      id, listing_id, author_id, parent_id, body, created_at,
      author:profiles!replies_author_id_fkey (id, username, display_name, avatar_url)
    `)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('fetchReplies failed', error);
    return [];
  }
  return (data ?? []) as unknown as Reply[];
}

/**
 * Turn the flat reply rows into a tree via parent_id. Replies whose parent is
 * missing (deleted mid-thread) are promoted to the top level rather than
 * disappearing.
 */
export function buildReplyTree(replies: Reply[]): ReplyNode[] {
  const nodes = new Map<string, ReplyNode>();
  for (const r of replies) nodes.set(r.id, { ...r, children: [] });

  const roots: ReplyNode[] = [];
  for (const r of replies) {
    const node = nodes.get(r.id)!;
    const parent = r.parent_id ? nodes.get(r.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
