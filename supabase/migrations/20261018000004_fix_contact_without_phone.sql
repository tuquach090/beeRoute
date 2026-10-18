-- Re-asserts the save_company body from 20261018000003.
--
-- 002 and 003 declare the same function signature, so whichever ran LAST wins.
-- Applying them out of order leaves the 002 body in place, whose WHERE clause
-- keeps only rows that have a phone — silently discarding a contact entered as
-- a name alone.
--
-- Safe to run repeatedly, and safe to run before or after the others.

alter table public.company_contacts
  drop constraint if exists company_contacts_phone_check;

alter table public.company_contacts
  alter column phone drop not null;

create or replace function public.save_company(
  p_company_id   uuid,
  p_display_name text,
  p_address      text,
  p_lat          double precision,
  p_lng          double precision,
  p_note         text,
  p_is_public    boolean,
  p_contacts     jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_company_id uuid;
begin
  if p_contacts is null or jsonb_typeof(p_contacts) <> 'array' then
    raise exception 'p_contacts phải là một mảng JSON';
  end if;

  if p_company_id is null then
    insert into public.companies
      (display_name, address, lat, lng, note, is_public)
    values
      (p_display_name, p_address, p_lat, p_lng, p_note, coalesce(p_is_public, false))
    returning id into v_company_id;
  else
    update public.companies
       set display_name = p_display_name,
           address      = p_address,
           lat          = p_lat,
           lng          = p_lng,
           note         = p_note,
           is_public    = coalesce(p_is_public, false)
     where id = p_company_id
    returning id into v_company_id;

    if v_company_id is null then
      raise exception 'Không tìm thấy công ty, hoặc bạn không có quyền sửa';
    end if;

    delete from public.company_contacts where company_id = v_company_id;
  end if;

  insert into public.company_contacts (company_id, contact_name, phone, sort_order)
  select
    v_company_id,
    nullif(trim(coalesce(c ->> 'contact_name', '')), ''),
    nullif(trim(coalesce(c ->> 'phone', '')), ''),
    (ord - 1)::int
  from jsonb_array_elements(p_contacts) with ordinality as t(c, ord)
  -- A name on its own is a valid contact. Only rows blank in BOTH fields go.
  where coalesce(trim(c ->> 'contact_name'), '') <> ''
     or coalesce(trim(c ->> 'phone'), '') <> '';

  return v_company_id;
end;
$$;

revoke all on function public.save_company(
  uuid, text, text, double precision, double precision, text, boolean, jsonb
) from public, anon;

grant execute on function public.save_company(
  uuid, text, text, double precision, double precision, text, boolean, jsonb
) to authenticated;
