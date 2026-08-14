-- ---------------------------------------------------------------------------
-- Replace the placeholder towns with the real community list.
-- Safe to run on a database that already has 0001 applied. Listings that
-- pointed at a removed town fall back to null (see the on delete set null
-- reference on public.listings.location).
-- ---------------------------------------------------------------------------

insert into public.locations (slug, name, sort) values
  ('new-ferolle',         'New Ferolle',         1),
  ('reefs-harbour',       'Reefs Harbour',       2),
  ('barletts-harbour',    'Barletts Harbour',    3),
  ('castor-river-south',  'Castor River South',  4),
  ('castor-river-north',  'Castor River North',  5),
  ('birdcove',            'Birdcove',            6),
  ('brigbay',             'Brigbay',             7),
  ('plum-point',          'Plum Point',          8)
on conflict (slug) do update
  set name = excluded.name,
      sort = excluded.sort;

delete from public.locations
where slug in ('northfield', 'eastbrook', 'southgate', 'westhaven');
