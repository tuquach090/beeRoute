-- Saving a company and its contacts has to be all-or-nothing (CLAUDE.md §7).
-- Doing it as separate inserts from the client leaves half-written rows behind
-- whenever the second call fails.
--
-- The function is NOT security definer: it runs as the caller, so every RLS
-- policy still applies. A caller who does not own p_company_id simply updates
-- zero rows and gets the "not found" error below.

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

    -- Contacts are replaced wholesale rather than diffed: the list is short,
    -- and this keeps "delete a row in the form" working without extra calls.
    delete from public.company_contacts where company_id = v_company_id;
  end if;

  insert into public.company_contacts (company_id, contact_name, phone, sort_order)
  select
    v_company_id,
    nullif(trim(coalesce(c ->> 'contact_name', '')), ''),
    c ->> 'phone',
    (ord - 1)::int
  from jsonb_array_elements(p_contacts) with ordinality as t(c, ord)
  where coalesce(trim(c ->> 'phone'), '') <> '';

  return v_company_id;
end;
$$;

comment on function public.save_company is
  'Insert or update a company together with its contact list, in one transaction.';

revoke all on function public.save_company(
  uuid, text, text, double precision, double precision, text, boolean, jsonb
) from public, anon;

grant execute on function public.save_company(
  uuid, text, text, double precision, double precision, text, boolean, jsonb
) to authenticated;
