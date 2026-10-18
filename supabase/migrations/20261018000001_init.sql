-- BeeRoute initial schema: profiles, companies, company_contacts.
--
-- Design notes
--  * Supabase owns auth.users. public.profiles mirrors the few fields the app
--    shows (name, avatar) so queries never have to reach into the auth schema.
--  * A company may be shared with every other signed-in user by setting
--    is_public = true. The project owner chose for that to expose EVERYTHING on
--    the company, contact phone numbers and the internal note included. That is
--    deliberate, not an oversight — see docs/database.md before narrowing it.
--  * The column is named is_public rather than "public" because public is also
--    the schema name, and an unquoted `public` in a policy reads ambiguously.

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Basic account info copied from the Google identity at first sign-in.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Google hands these back in raw_user_meta_data. Key names differ between
-- providers, so fall back through the ones Google is known to send.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  display_name  text not null check (char_length(display_name) between 1 and 120),
  address       text not null check (char_length(address) > 0),
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  note          text,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.companies.is_public is
  'true = every signed-in user can read this row and its contacts, note included.';

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create index companies_user_id_idx on public.companies (user_id);
-- Serves the "find companies other people shared" lookup.
create index companies_is_public_idx on public.companies (is_public) where is_public;

-- ---------------------------------------------------------------------------
-- company_contacts
-- ---------------------------------------------------------------------------

create table public.company_contacts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  contact_name  text,
  phone         text not null check (char_length(phone) > 0),
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

create index company_contacts_company_id_idx
  on public.company_contacts (company_id, sort_order);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.companies        enable row level security;
alter table public.company_contacts enable row level security;

-- profiles: you read and write only your own row. Inserts come from the
-- handle_new_user trigger, which is security definer and bypasses RLS.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- companies: read your own, plus anything shared publicly.
create policy companies_select_own_or_public on public.companies
  for select to authenticated
  using (user_id = auth.uid() or is_public);

-- Writes are owner-only. The with check on insert stops a client from
-- inserting a row owned by somebody else.
create policy companies_insert_own on public.companies
  for insert to authenticated
  with check (user_id = auth.uid());

create policy companies_update_own on public.companies
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy companies_delete_own on public.companies
  for delete to authenticated
  using (user_id = auth.uid());

-- company_contacts: visibility follows the parent company exactly.
create policy company_contacts_select_via_company on public.company_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_contacts.company_id
        and (c.user_id = auth.uid() or c.is_public)
    )
  );

create policy company_contacts_insert_via_owned_company on public.company_contacts
  for insert to authenticated
  with check (
    exists (
      select 1 from public.companies c
      where c.id = company_contacts.company_id
        and c.user_id = auth.uid()
    )
  );

create policy company_contacts_update_via_owned_company on public.company_contacts
  for update to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_contacts.company_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.companies c
      where c.id = company_contacts.company_id
        and c.user_id = auth.uid()
    )
  );

create policy company_contacts_delete_via_owned_company on public.company_contacts
  for delete to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_contacts.company_id
        and c.user_id = auth.uid()
    )
  );
