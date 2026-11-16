-- Two changes the project owner asked for on 16/11/2026.
--
-- 1. The route form no longer asks for an end point. A round finishes at the
--    last delivery; forcing a leg back to a depot reported kilometres nobody
--    rode. Trips saved before today still carry theirs, so the columns are
--    relaxed rather than dropped — deleting them would rewrite history that
--    was true when it was recorded.
--
-- 2. The start point gets a default, set once in Cài đặt instead of retyped
--    every morning. It lives on profiles because it is a per-person
--    preference, not a company, and profiles already has owner-only RLS.
--
-- save_trip is deliberately NOT redefined here. Its end parameters simply
-- receive NULL now that the columns accept it, so there is no second
-- declaration of that function to go wrong (CLAUDE.md §3.8).

-- ---------------------------------------------------------------------------
-- trips: the end point becomes optional
-- ---------------------------------------------------------------------------

alter table public.trips alter column end_label drop not null;
alter table public.trips alter column end_lat   drop not null;
alter table public.trips alter column end_lng   drop not null;

-- An end point is all three columns or none of them. Without this a trip
-- could carry a label with no coordinates, and the Maps link would quietly
-- lose its destination.
alter table public.trips add constraint trips_end_all_or_nothing check (
  (end_label is null and end_lat is null and end_lng is null)
  or (end_label is not null and end_lat is not null and end_lng is not null)
);

comment on column public.trips.end_label is
  'Null for trips saved after the end point was dropped from the form.';

-- ---------------------------------------------------------------------------
-- profiles: a default start point
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column default_start_label text,
  add column default_start_lat   double precision,
  add column default_start_lng   double precision;

alter table public.profiles add constraint profiles_default_start_complete check (
  (default_start_label is null
     and default_start_lat is null
     and default_start_lng is null)
  or (default_start_label is not null
     and default_start_lat between -90 and 90
     and default_start_lng between -180 and 180)
);

comment on column public.profiles.default_start_label is
  'Preselected start point for new routes. Null means "ask every time".';

-- No new policy: profiles_select_own and profiles_update_own in the initial
-- migration already cover every column, and these are ordinary columns on a
-- row you already owned.
