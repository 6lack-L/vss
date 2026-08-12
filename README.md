# V.S.S

A volunteer-work social platform. Community members post requests for help —
a park cleanup, raking leaves for a neighbour, a hand moving furniture — and
others reply in threads, mark themselves interested, and share listings out.

Built on Astro 7 (SSR, Vercel adapter) with Supabase for auth and Postgres.
The UI is derived from the [CapsuleX](https://github.com/wangjacks/capsule-x)
theme: CSS custom properties, a tri-state theme switcher, and the glassmorphism
capsule nav.

## Setup

### 1. Create a Supabase project

Then apply the schema. Either paste `supabase/migrations/0001_init.sql` into the
SQL editor, or with the Supabase CLI:

```bash
supabase db push
```

The migration creates `profiles`, `listings`, `replies`, `reactions` and
`locations`, enables row-level security on all of them, and installs a trigger
that creates a profile row for every new auth user.

Edit the seed `locations` at the bottom of the migration to your real towns.

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from
Project Settings → API. The anon key is meant to be public; RLS is what
protects the data. **Do not add a service-role key** — this app deliberately
has no way to bypass RLS.

### 3. Turn off email confirmation for local development

Authentication → Sign In / Up → Email → disable "Confirm email". With it on,
signup returns no session until the emailed link is clicked, and you cannot
test the flow locally. Leave it **on** in production.

### 4. Run

```bash
npx astro dev --background   # astro dev stop | status | logs
```

## Deploying to Vercel

Set `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` and `PUBLIC_SITE_URL`
(the real origin, e.g. `https://vss.example.com`) in the Vercel project's
environment variables. `PUBLIC_SITE_URL` is what share links and Open Graph
tags build absolute URLs from — get it wrong and shared listings unfurl
pointing at localhost.

In Supabase → Authentication → URL Configuration, add
`https://your-domain/auth/callback` as a Redirect URL.

### Optional: Google sign-in

1. Add a Google client ID/secret in Supabase → Authentication → Providers.
2. Register `/auth/callback` as a Redirect URL for every origin.
3. Set `features.googleAuth: true` in `src/config.ts`.

## Architecture

| Path | Role |
| --- | --- |
| `src/config.ts` | Single source of site settings — title, nav, feature flags |
| `src/middleware.ts` | Per-request Supabase client, session refresh, `Astro.locals` |
| `src/lib/supabase.ts` | Cookie-backed server client and browser client |
| `src/lib/listings.ts` | All listing/reply queries, plus `buildReplyTree` |
| `src/lib/format.ts` | `daysLeft`, `relativeTime`, `excerpt` and friends |
| `src/actions/index.ts` | Every mutation, as Astro Actions with Zod validation |
| `src/layouts/BaseLayout.astro` | Head, OG tags, theme script, nav and footer |
| `supabase/migrations/` | Schema and RLS policies |

### Routes

| Route | Purpose |
| --- | --- |
| `/` | Feed — composer plus open requests, newest first |
| `/listings` | Browse with `?location=`, `?sort=`, `?q=`, `?status=` |
| `/listings/[id]` | Detail, threaded replies, share buttons, OG tags |
| `/listings/[id]/edit` | Edit your own listing |
| `/login`, `/signup`, `/logout`, `/auth/callback` | Auth |
| `/settings` | Profile and account |
| `/u/[username]` | Public profile and that person's requests |
| `/about` | Static, prerendered |

### Two conventions worth knowing

**RLS is the security boundary.** Actions re-check the session server-side, but
the policies in `supabase/migrations/0001_init.sql` are what actually stop user
A from deleting user B's listing. A UI that hides a button proves nothing —
test ownership by calling Supabase directly from the browser console.

**Client scripts must init on `astro:page-load`.** View Transitions are enabled,
so a bare top-level script runs once and then dies on the first client-side
navigation.

**Forms work without JavaScript.** Every mutation is a real `<form>` posting to
an Astro Action. The composer's extra fields collapse only once JS runs; nested
reply forms use `<details>` for native collapse. Keep it that way.
