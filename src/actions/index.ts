import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import type { ActionAPIContext } from 'astro:actions';
import { siteConfig } from '../config';

/**
 * Every mutation goes through here. Two independent checks protect each one:
 * this server-side session check, and the row-level security policies in
 * supabase/migrations. Neither is sufficient alone — RLS is the boundary that
 * survives a bug in this file.
 */
function requireUser(context: ActionAPIContext) {
  const user = context.locals.user;
  if (!user) {
    throw new ActionError({
      code: 'UNAUTHORIZED',
      message: 'You need to be signed in to do that.',
    });
  }
  return user;
}

/** Surface a Postgres error without leaking internals to the browser. */
function dbError(message: string, error: unknown): never {
  console.error(message, error);
  throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message });
}

/**
 * `nullish`, not `optional`: a form field that is absent from the submission
 * arrives as `null` (FormData.get returns null for a missing key), which an
 * `.optional()` string rejects with a 400 before the handler ever runs.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform(v => (v ? v : null));

export const server = {
  createListing: defineAction({
    accept: 'form',
    input: z.object({
      title: optionalText(120),
      body: z.string().trim().min(1, 'Say what you need help with.').max(5000),
      location: optionalText(60),
      skills: optionalText(1000),
      contact: optionalText(500),
      days: z.coerce.number().int().min(1).max(365).default(siteConfig.defaultListingDays),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const expires = new Date();
      expires.setDate(expires.getDate() + input.days);

      const { data, error } = await context.locals.supabase
        .from('listings')
        .insert({
          author_id: user.id,
          title: input.title,
          body: input.body,
          location: input.location,
          skills: input.skills,
          contact: input.contact,
          expires_at: expires.toISOString(),
        })
        .select('id')
        .single();

      if (error) dbError('Could not publish your listing.', error);
      return { id: data.id as string };
    },
  }),

  updateListing: defineAction({
    accept: 'form',
    input: z.object({
      id: z.uuid(),
      title: optionalText(120),
      body: z.string().trim().min(1).max(5000),
      location: optionalText(60),
      skills: optionalText(1000),
      contact: optionalText(500),
    }),
    handler: async ({ id, ...fields }, context) => {
      requireUser(context);

      // No author_id filter here on purpose: the RLS update policy is what
      // enforces ownership, and it applies whether or not this file gets it right.
      const { data, error } = await context.locals.supabase
        .from('listings')
        .update(fields)
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) dbError('Could not save your changes.', error);
      if (!data) {
        throw new ActionError({ code: 'FORBIDDEN', message: 'That is not your listing.' });
      }
      return { id };
    },
  }),

  deleteListing: defineAction({
    accept: 'form',
    input: z.object({ id: z.uuid() }),
    handler: async ({ id }, context) => {
      requireUser(context);

      // RLS turns "not yours" into zero rows deleted rather than an error, so
      // check what came back — otherwise a failed delete reports success.
      const { data, error } = await context.locals.supabase
        .from('listings')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) dbError('Could not delete that listing.', error);
      if (!data) {
        throw new ActionError({ code: 'FORBIDDEN', message: 'That is not your listing.' });
      }
      return { ok: true };
    },
  }),

  createReply: defineAction({
    accept: 'form',
    input: z.object({
      listing_id: z.uuid(),
      parent_id: z
        .string()
        .nullish()
        .transform(v => (v && v.length > 0 ? v : null))
        .refine(v => v === null || z.uuid().safeParse(v).success, 'Invalid parent'),
      body: z.string().trim().min(1, 'Write something first.').max(2000),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const { data, error } = await context.locals.supabase
        .from('replies')
        .insert({
          listing_id: input.listing_id,
          parent_id: input.parent_id,
          author_id: user.id,
          body: input.body,
        })
        .select('id')
        .single();

      if (error) dbError('Could not post your reply.', error);
      return { id: data.id as string };
    },
  }),

  deleteReply: defineAction({
    accept: 'form',
    input: z.object({ id: z.uuid() }),
    handler: async ({ id }, context) => {
      requireUser(context);
      const { data, error } = await context.locals.supabase
        .from('replies')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) dbError('Could not delete that reply.', error);
      if (!data) {
        throw new ActionError({ code: 'FORBIDDEN', message: 'That is not your reply.' });
      }
      return { ok: true };
    },
  }),

  toggleReaction: defineAction({
    accept: 'form',
    input: z.object({
      listing_id: z.uuid(),
      kind: z.string().default('interested'),
    }),
    handler: async ({ listing_id, kind }, context) => {
      const user = requireUser(context);
      const supabase = context.locals.supabase;

      const { data: existing, error: readError } = await supabase
        .from('reactions')
        .select('listing_id')
        .eq('listing_id', listing_id)
        .eq('user_id', user.id)
        .eq('kind', kind)
        .maybeSingle();

      if (readError) dbError('Could not read your reaction.', readError);

      if (existing) {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('listing_id', listing_id)
          .eq('user_id', user.id)
          .eq('kind', kind);
        if (error) dbError('Could not remove your reaction.', error);
        return { reacted: false };
      }

      const { error } = await supabase
        .from('reactions')
        .insert({ listing_id, user_id: user.id, kind });
      if (error) dbError('Could not save your reaction.', error);
      return { reacted: true };
    },
  }),

  updateProfile: defineAction({
    accept: 'form',
    input: z.object({
      username: z
        .string()
        .trim()
        .toLowerCase()
        .min(3, 'Usernames need at least 3 characters.')
        .max(30)
        .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores only.'),
      display_name: optionalText(60),
      avatar_url: z
        .string()
        .trim()
        .nullish()
        .transform(v => (v ? v : null))
        .refine(
          v => v === null || /^https:\/\//.test(v),
          'Avatar URLs must start with https://'
        ),
      bio: optionalText(300),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const { error } = await context.locals.supabase
        .from('profiles')
        .update(input)
        .eq('id', user.id);

      if (error) {
        // 23505 = unique_violation, i.e. the username is taken.
        if ((error as { code?: string }).code === '23505') {
          throw new ActionError({
            code: 'CONFLICT',
            message: 'That username is already taken.',
          });
        }
        dbError('Could not save your profile.', error);
      }
      return { username: input.username };
    },
  }),
};
