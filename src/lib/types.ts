// Shapes returned by the Supabase queries in this app.
// Kept hand-written (rather than generated) so the app has one small,
// readable contract with the database.

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

/** The subset of a profile embedded alongside a listing or reply. */
export type AuthorRef = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;

export interface Location {
  slug: string;
  name: string;
}

export interface Listing {
  id: string;
  author_id: string;
  title: string | null;
  body: string;
  location: string | null;
  skills: string | null;
  contact: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  author?: AuthorRef | null;
  /** Aggregates from the listing_stats view. */
  reply_count?: number;
  reaction_count?: number;
  /** Whether the current viewer has reacted — resolved per-request. */
  viewer_reacted?: boolean;
}

export interface Reply {
  id: string;
  listing_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author?: AuthorRef | null;
}

/** A reply with its descendants attached, produced by buildReplyTree(). */
export interface ReplyNode extends Reply {
  children: ReplyNode[];
}
