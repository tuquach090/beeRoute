-- Trips: an optimised route saved as a dated record, with delivery paperwork.
--
-- This REVERSES the earlier rule in CLAUDE.md §3.3 / §7 ("KHÔNG lưu kết quả
-- tối ưu tuyến"). The project owner lifted it deliberately so the day's runs
-- can be looked up later and carry receipt photos. Recorded here rather than
-- applied silently, the same way the is_public decision was.
--
-- Unlike companies there is NO is_public branch anywhere below. A trip and its
-- paperwork are operational records naming third parties; they are readable by
-- their owner only.

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------

create table public.trips (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade default auth.uid(),

  -- A DATE, not a timestamptz. A trip belongs to a calendar day in UTC+7;
  -- storing an instant would put late-evening runs on the wrong day.
  trip_date          date not null,
  slot               text not null check (slot in ('morning', 'afternoon')),
  -- 0 = the slot's main trip, >0 = an extra run squeezed into the same slot.
  -- Assigned by save_trip, never sent by the client.
  --
  -- Named slot_position, not position: `position` is a SQL function
  -- (position(x in y)) and reads badly everywhere it appears.
  slot_position      int not null default 0 check (slot_position >= 0),

  travel_mode        text not null default 'two-wheeler'
                       check (travel_mode in ('two-wheeler', 'driving')),

  start_label        text not null,
  start_lat          double precision not null check (start_lat between -90 and 90),
  start_lng          double precision not null check (start_lng between -180 and 180),
  end_label          text not null,
  end_lat            double precision not null check (end_lat between -90 and 90),
  end_lng            double precision not null check (end_lng between -180 and 180),

  -- Named "straight" on purpose: this is the haversine total the optimiser used
  -- to decide the ORDER (CLAUDE.md §6.2), not road distance. Do not report it
  -- as kilometres actually ridden.
  total_straight_km  double precision not null check (total_straight_km >= 0),
  method             text not null check (method in ('exact', 'heuristic')),

  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column public.trips.total_straight_km is
  'Haversine total used for ordering only — NOT the distance actually ridden.';
comment on column public.trips.slot_position is
  '0 = the main trip of that slot; higher values are extra runs in the same slot.';

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- Serves both the calendar month view and the single-day view.
create index trips_user_date_idx on public.trips (user_id, trip_date);

-- ---------------------------------------------------------------------------
-- trip_stops
-- ---------------------------------------------------------------------------

create table public.trip_stops (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  sort_order    int not null default 0,

  -- set null, NOT cascade: deleting a company must not erase it from a trip
  -- that already happened. The snapshot below keeps the record readable.
  company_id    uuid references public.companies(id) on delete set null,

  display_name  text not null,
  address       text not null,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),

  -- Distance from the previous point on the route; null for the first stop.
  leg_km        double precision check (leg_km >= 0),

  -- Delivery record. null delivered_at means "not delivered yet".
  delivered_at  timestamptz,
  sample_taken  boolean not null default false,
  note          text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.trip_stops is
  'A stop as it was when the trip ran. display_name/address/lat/lng are a snapshot, not a live join.';

create trigger trip_stops_set_updated_at
  before update on public.trip_stops
  for each row execute function public.set_updated_at();

create index trip_stops_trip_id_idx on public.trip_stops (trip_id, sort_order);

-- ---------------------------------------------------------------------------
-- trip_stop_photos
-- ---------------------------------------------------------------------------

create table public.trip_stop_photos (
  id            uuid primary key default gen_random_uuid(),
  trip_stop_id  uuid not null references public.trip_stops(id) on delete cascade,

  -- Object key inside the delivery-photos bucket. The row is deleted by the
  -- cascade above, but the file itself is NOT — see docs/database.md.
  storage_path  text not null check (char_length(storage_path) > 0),
  kind          text not null
                  check (kind in ('order', 'receipt', 'warehouse', 'sample')),
  note          text,
  taken_at      timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index trip_stop_photos_stop_id_idx
  on public.trip_stop_photos (trip_stop_id, taken_at);

-- ---------------------------------------------------------------------------
-- Row Level Security — owner only, no public branch
-- ---------------------------------------------------------------------------

alter table public.trips            enable row level security;
alter table public.trip_stops       enable row level security;
alter table public.trip_stop_photos enable row level security;

create policy trips_select_own on public.trips
  for select to authenticated
  using (user_id = auth.uid());

create policy trips_insert_own on public.trips
  for insert to authenticated
  with check (user_id = auth.uid());

create policy trips_update_own on public.trips
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy trips_delete_own on public.trips
  for delete to authenticated
  using (user_id = auth.uid());

-- trip_stops: reachable only through a trip you own.
create policy trip_stops_select_via_trip on public.trip_stops
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_stops.trip_id
        and t.user_id = auth.uid()
    )
  );

create policy trip_stops_insert_via_owned_trip on public.trip_stops
  for insert to authenticated
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_stops.trip_id
        and t.user_id = auth.uid()
    )
  );

create policy trip_stops_update_via_owned_trip on public.trip_stops
  for update to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_stops.trip_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_stops.trip_id
        and t.user_id = auth.uid()
    )
  );

create policy trip_stops_delete_via_owned_trip on public.trip_stops
  for delete to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_stops.trip_id
        and t.user_id = auth.uid()
    )
  );

-- trip_stop_photos: two levels up to the owning trip.
create policy trip_stop_photos_select_via_trip on public.trip_stop_photos
  for select to authenticated
  using (
    exists (
      select 1
      from public.trip_stops s
      join public.trips t on t.id = s.trip_id
      where s.id = trip_stop_photos.trip_stop_id
        and t.user_id = auth.uid()
    )
  );

create policy trip_stop_photos_insert_via_owned_trip on public.trip_stop_photos
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.trip_stops s
      join public.trips t on t.id = s.trip_id
      where s.id = trip_stop_photos.trip_stop_id
        and t.user_id = auth.uid()
    )
  );

create policy trip_stop_photos_update_via_owned_trip on public.trip_stop_photos
  for update to authenticated
  using (
    exists (
      select 1
      from public.trip_stops s
      join public.trips t on t.id = s.trip_id
      where s.id = trip_stop_photos.trip_stop_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.trip_stops s
      join public.trips t on t.id = s.trip_id
      where s.id = trip_stop_photos.trip_stop_id
        and t.user_id = auth.uid()
    )
  );

create policy trip_stop_photos_delete_via_owned_trip on public.trip_stop_photos
  for delete to authenticated
  using (
    exists (
      select 1
      from public.trip_stops s
      join public.trips t on t.id = s.trip_id
      where s.id = trip_stop_photos.trip_stop_id
        and t.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- save_trip
--
-- Declared in THIS migration and nowhere else (CLAUDE.md §3.8 — save_company
-- was declared twice and the later file silently undid the earlier one).
--
-- NOT security definer: it runs as the caller, so the policies above still
-- apply. A caller who does not own p_trip_id updates zero rows and gets the
-- "not found" error below.
--
-- The important difference from save_company: stops are NOT replaced
-- wholesale. Re-optimising a trip must keep the delivery record — delivered_at,
-- sample_taken, note and every photo — on stops that survive the edit. The
-- client therefore sends each stop's existing id, or null for a new one.
-- ---------------------------------------------------------------------------

create or replace function public.save_trip(
  p_trip_id      uuid,
  p_trip_date    date,
  p_slot         text,
  p_travel_mode  text,
  p_start_label  text,
  p_start_lat    double precision,
  p_start_lng    double precision,
  p_end_label    text,
  p_end_lat      double precision,
  p_end_lng      double precision,
  p_total_km     double precision,
  p_method       text,
  p_note         text,
  p_stops        jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_trip_id  uuid;
  v_slot_position int;
  v_kept     uuid[];
begin
  if p_stops is null or jsonb_typeof(p_stops) <> 'array' then
    raise exception 'p_stops phải là một mảng JSON';
  end if;

  if jsonb_array_length(p_stops) = 0 then
    raise exception 'Chuyến phải có ít nhất một điểm đến';
  end if;

  -- Two stops carrying the same stop_id would make the UPDATE below ambiguous,
  -- and Postgres resolves that by silently picking one source row rather than
  -- raising. Catch it here instead.
  if exists (
    select 1
      from jsonb_array_elements(p_stops) as t(c)
     where nullif(c ->> 'stop_id', '') is not null
     group by c ->> 'stop_id'
    having count(*) > 1
  ) then
    raise exception 'Danh sách điểm bị trùng';
  end if;

  if p_trip_id is null then
    -- First trip of this slot becomes the main one; the rest queue after it.
    select coalesce(max(slot_position) + 1, 0)
      into v_slot_position
      from public.trips
     where user_id = auth.uid()
       and trip_date = p_trip_date
       and slot = p_slot;

    insert into public.trips (
      trip_date, slot, slot_position, travel_mode,
      start_label, start_lat, start_lng,
      end_label, end_lat, end_lng,
      total_straight_km, method, note
    )
    values (
      p_trip_date, p_slot, v_slot_position, coalesce(p_travel_mode, 'two-wheeler'),
      p_start_label, p_start_lat, p_start_lng,
      p_end_label, p_end_lat, p_end_lng,
      p_total_km, p_method, p_note
    )
    returning id into v_trip_id;
  else
    -- slot_position is deliberately NOT updated: moving a trip between slots
    -- would need the whole slot renumbered, which is a separate operation.
    update public.trips
       set trip_date         = p_trip_date,
           slot              = p_slot,
           travel_mode       = coalesce(p_travel_mode, 'two-wheeler'),
           start_label       = p_start_label,
           start_lat         = p_start_lat,
           start_lng         = p_start_lng,
           end_label         = p_end_label,
           end_lat           = p_end_lat,
           end_lng           = p_end_lng,
           total_straight_km = p_total_km,
           method            = p_method,
           note              = p_note
     where id = p_trip_id
    returning id into v_trip_id;

    if v_trip_id is null then
      raise exception 'Không tìm thấy chuyến, hoặc bạn không có quyền sửa';
    end if;
  end if;

  -- Update the stops the client sent back with an id, leaving their delivery
  -- record untouched.
  update public.trip_stops s
     set sort_order   = (e.ord - 1)::int,
         company_id   = nullif(e.c ->> 'company_id', '')::uuid,
         display_name = e.c ->> 'display_name',
         address      = e.c ->> 'address',
         lat          = (e.c ->> 'lat')::double precision,
         lng          = (e.c ->> 'lng')::double precision,
         leg_km       = nullif(e.c ->> 'leg_km', '')::double precision
    from jsonb_array_elements(p_stops) with ordinality as e(c, ord)
   where s.trip_id = v_trip_id
     and nullif(e.c ->> 'stop_id', '') is not null
     and s.id = (e.c ->> 'stop_id')::uuid;

  -- Drop anything the client did not send back: it was removed from the route.
  -- Cascades to that stop's photo rows.
  --
  -- This runs BEFORE the insert below, so "everything without a surviving id"
  -- is unambiguous. Deleting afterwards would need a way to tell rows inserted
  -- by this very call from pre-existing ones.
  select coalesce(
           array_agg((c ->> 'stop_id')::uuid),
           array[]::uuid[]
         )
    into v_kept
    from jsonb_array_elements(p_stops) as t(c)
   where nullif(c ->> 'stop_id', '') is not null;

  delete from public.trip_stops
   where trip_id = v_trip_id
     and not (id = any (v_kept));

  -- Finally the stops that arrived without an id — brand new to this route.
  insert into public.trip_stops (
    trip_id, sort_order, company_id, display_name, address, lat, lng, leg_km
  )
  select
    v_trip_id,
    (ord - 1)::int,
    nullif(c ->> 'company_id', '')::uuid,
    c ->> 'display_name',
    c ->> 'address',
    (c ->> 'lat')::double precision,
    (c ->> 'lng')::double precision,
    nullif(c ->> 'leg_km', '')::double precision
  from jsonb_array_elements(p_stops) with ordinality as t(c, ord)
  where nullif(c ->> 'stop_id', '') is null;

  return v_trip_id;
end;
$$;

comment on function public.save_trip is
  'Insert or update a trip and its stops in one transaction, preserving the delivery record on stops that survive a re-optimise.';

revoke all on function public.save_trip(
  uuid, date, text, text, text, double precision, double precision,
  text, double precision, double precision, double precision, text, text, jsonb
) from public, anon;

grant execute on function public.save_trip(
  uuid, date, text, text, text, double precision, double precision,
  text, double precision, double precision, double precision, text, text, jsonb
) to authenticated;
