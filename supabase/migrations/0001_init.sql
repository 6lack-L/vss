-- V.S.S — initial schema
--
-- Security model: the app only ever talks to Postgres through PostgREST as the
-- signed-in user (anon key + session JWT). There is no service-role key in the
-- application. Therefore RLS is the real access control — the UI hiding a
-- button is a convenience, not a boundary.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     citext not null unique
                 check (char_length(username) between 3 and 30
                        and username ~ '^[a-z0-9_]+$'),
  display_name text check (char_length(display_name) <= 60),
  avatar_url   text check (avatar_url is null or avatar_url ~ '^https://'),
  bio          text check (char_length(bio) <= 300),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users update their own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Note: no insert policy. Profiles are only ever created by the trigger below,
-- which runs as security definer. This makes it impossible to create a profile
-- that is not backed by an auth user.

-- ---------------------------------------------------------------------------
-- Auto-create a profile for every new auth user.
--
-- The username comes from the signup form via
--   signUp({ options: { data: { username } } })
-- which lands in raw_user_meta_data. The fallback exists so that a signup can
-- never fail on a missing or colliding username — the auth endpoint surfaces
-- trigger errors as an opaque "Database error saving new user", which is
-- miserable to debug and worse to hit in production.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  requested text;
  candidate text;
  suffix    int := 0;
begin
  requested := lower(regexp_replace(
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    ),
    '[^a-zA-Z0-9_]', '', 'g'
  ));

  if char_length(requested) < 3 then
    requested := 'member';
  end if;

  requested := left(requested, 24);
  candidate := requested;

  -- Resolve collisions rather than aborting the signup.
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    suffix := suffix + 1;
    candidate := requested || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- locations — replaces the prototype's hardcoded "Town #1..4"
-- ---------------------------------------------------------------------------

create table public.locations (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  sort int not null default 0
);

alter table public.locations enable row level security;

create policy "locations are publicly readable"
  on public.locations for select
  using (true);

-- ---------------------------------------------------------------------------
-- listings — the volunteer requests, posted as status updates
-- ---------------------------------------------------------------------------

create table public.listings (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  title      text check (char_length(title) <= 120),
  body       text not null check (char_length(body) between 1 and 5000),
  location   text references public.locations (slug) on delete set null,
  skills     text check (char_length(skills) <= 1000),
  contact    text check (char_length(contact) <= 500),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_created_at_idx on public.listings (created_at desc);
create index listings_location_idx   on public.listings (location);
create index listings_author_idx     on public.listings (author_id);

alter table public.listings enable row level security;

create policy "listings are publicly readable"
  on public.listings for select
  using (true);

create policy "users create their own listings"
  on public.listings for insert
  with check ((select auth.uid()) = author_id);

create policy "users update their own listings"
  on public.listings for update
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "users delete their own listings"
  on public.listings for delete
  using ((select auth.uid()) = author_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_touch_updated_at
  before update on public.listings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- replies — threaded via a self-referencing parent_id
-- ---------------------------------------------------------------------------

create table public.replies (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid references public.replies (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index replies_listing_idx on public.replies (listing_id, created_at);
create index replies_parent_idx  on public.replies (parent_id);

alter table public.replies enable row level security;

create policy "replies are publicly readable"
  on public.replies for select
  using (true);

create policy "users create their own replies"
  on public.replies for insert
  with check ((select auth.uid()) = author_id);

create policy "users update their own replies"
  on public.replies for update
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "users delete their own replies"
  on public.replies for delete
  using ((select auth.uid()) = author_id);

-- A reply's parent must belong to the same listing. Without this, a reply could
-- be grafted onto a thread in a different listing.
create or replace function public.check_reply_parent()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null then
    if not exists (
      select 1 from public.replies r
      where r.id = new.parent_id and r.listing_id = new.listing_id
    ) then
      raise exception 'parent reply belongs to a different listing';
    end if;
  end if;
  return new;
end;
$$;

create trigger replies_check_parent
  before insert or update on public.replies
  for each row execute function public.check_reply_parent();

-- ---------------------------------------------------------------------------
-- reactions — one row per (listing, user, kind), so reacting twice is a no-op
-- ---------------------------------------------------------------------------

create table public.reactions (
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null default 'interested' check (kind in ('interested')),
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id, kind)
);

create index reactions_listing_idx on public.reactions (listing_id);

alter table public.reactions enable row level security;

create policy "reactions are publicly readable"
  on public.reactions for select
  using (true);

create policy "users create their own reactions"
  on public.reactions for insert
  with check ((select auth.uid()) = user_id);

create policy "users delete their own reactions"
  on public.reactions for delete
  using ((select auth.uid()) = user_id);

-- Reply and reaction counts are read via PostgREST's embedded aggregates
-- (`replies(count)`, `reactions(count)`) in src/lib/listings.ts, so the feed
-- stays a single round trip without a separate view to keep in sync.

-- ---------------------------------------------------------------------------
-- Seed towns — replace these with the real ones for your community.
-- ---------------------------------------------------------------------------

insert into public.locations (slug, name, sort) values
  ('northfield',  'Northfield',   1),
  ('eastbrook',   'Eastbrook',    2),
  ('southgate',   'Southgate',    3),
  ('westhaven',   'Westhaven',    4)
on conflict (slug) do nothing;
