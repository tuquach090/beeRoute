-- 1. One "mã vào cổng" photo per company.
-- 2. merge_companies: fold duplicate companies into one.
--
-- No new table for the photo: the rider chose exactly one image per company,
-- so a nullable column is the whole of it. The file lives in the existing
-- private bucket 'delivery-photos' under "<user_id>/companies/<uuid>.jpg";
-- the bucket policies from 20261025000002 already authorise on that first
-- segment, so nothing changes in storage.

alter table public.companies
  add column gate_photo_path text;

-- The first path segment must be the owner, for the same reason as the
-- bucket policies: a row pointing into someone else's folder would be a
-- photo its owner can never load or delete.
alter table public.companies
  add constraint companies_gate_photo_in_own_folder check (
    gate_photo_path is null
    or split_part(gate_photo_path, '/', 1) = user_id::text
  );

-- ---------------------------------------------------------------------------
-- merge_companies
--
-- Folds every source company into the target, then deletes the sources, in
-- one transaction:
--
--   contacts     moved to the target, skipping any the target already has
--                (same phone; or, for a name-only contact, same name)
--   note         each source's note appended to the target's
--   gate photo   the target keeps its own; if it has none it takes the first
--                source's (in p_source_ids order) that has one
--   trip stops   repointed at the target AND their snapshot rewritten to the
--                target's name, address and coordinates. This is a deliberate
--                exception to "trip_stops are a snapshot": the rider merges
--                because the sources were duplicates, and wants old trips to
--                read as the one company they really were.
--
-- Returns the gate-photo paths no row points at any more. The server action
-- removes those files AFTER this commits — the reverse of the usual
-- "file first, row second" rule — because a merge that fails half way must
-- not have destroyed photos the companies still show.
--
-- Only trip stops the caller can update are rewritten (RLS on trip_stops).
-- Another user's trip that stopped at one of these companies — possible when
-- a source was is_public — keeps its snapshot and has company_id set to null
-- by the foreign key when the source is deleted, exactly as a plain delete
-- would.
--
-- NOT security definer: RLS applies throughout, like save_company and
-- save_trip.
-- ---------------------------------------------------------------------------

create or replace function public.merge_companies(
  p_target_id  uuid,
  p_source_ids uuid[]
)
returns text[]
language plpgsql
as $$
declare
  v_target       public.companies%rowtype;
  v_source_count int;
  v_found        int;
  v_note         text;
  v_photo        text;
  v_orphans      text[];
  v_next_sort    int;
begin
  v_source_count := coalesce(cardinality(array(select distinct unnest(p_source_ids))), 0);

  if v_source_count = 0 then
    raise exception 'Chọn ít nhất một công ty để gộp';
  end if;

  if p_target_id = any(p_source_ids) then
    raise exception 'Công ty chính không được nằm trong danh sách bị gộp';
  end if;

  -- Ownership is checked explicitly, not left to RLS: RLS lets anyone READ a
  -- public company, and merging someone else's company into yours must fail
  -- loudly rather than half work.
  select * into v_target
    from public.companies
   where id = p_target_id and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'Không tìm thấy công ty chính, hoặc bạn không có quyền sửa';
  end if;

  select count(*) into v_found
    from (
      select id from public.companies
       where id = any(p_source_ids) and user_id = auth.uid()
       for update
    ) s;

  if v_found <> v_source_count then
    raise exception 'Không tìm thấy công ty cần gộp, hoặc bạn không có quyền sửa';
  end if;

  -- Contacts. Duplicates are dropped both against the target and between the
  -- sources themselves (distinct on), keeping the first by source order.
  select coalesce(max(sort_order) + 1, 0) into v_next_sort
    from public.company_contacts
   where company_id = p_target_id;

  insert into public.company_contacts (company_id, contact_name, phone, sort_order)
  select p_target_id, d.contact_name, d.phone,
         v_next_sort + (row_number() over (order by d.src_pos, d.sort_order))::int - 1
    from (
      select distinct on (coalesce('p:' || c.phone, 'n:' || lower(c.contact_name)))
             c.contact_name, c.phone, c.sort_order,
             array_position(p_source_ids, c.company_id) as src_pos
        from public.company_contacts c
       where c.company_id = any(p_source_ids)
         and not exists (
           select 1 from public.company_contacts t
            where t.company_id = p_target_id
              and (
                (c.phone is not null and t.phone = c.phone)
                or (c.phone is null and t.phone is null
                    and lower(t.contact_name) = lower(c.contact_name))
              )
         )
       order by coalesce('p:' || c.phone, 'n:' || lower(c.contact_name)),
                array_position(p_source_ids, c.company_id),
                c.sort_order
    ) d;

  -- Notes, in source order, skipping blanks and exact repeats.
  select string_agg(n, E'\n\n' order by pos) into v_note
    from (
      select distinct on (trim(s.note)) trim(s.note) as n,
             array_position(p_source_ids, s.id) as pos
        from public.companies s
       where s.id = any(p_source_ids)
         and coalesce(trim(s.note), '') <> ''
         and trim(s.note) is distinct from trim(v_target.note)
       order by trim(s.note), array_position(p_source_ids, s.id)
    ) x;

  -- Gate photo.
  v_photo := v_target.gate_photo_path;
  if v_photo is null then
    select s.gate_photo_path into v_photo
      from public.companies s
     where s.id = any(p_source_ids) and s.gate_photo_path is not null
     order by array_position(p_source_ids, s.id)
     limit 1;
  end if;

  select coalesce(array_agg(s.gate_photo_path), '{}') into v_orphans
    from public.companies s
   where s.id = any(p_source_ids)
     and s.gate_photo_path is not null
     and s.gate_photo_path is distinct from v_photo;

  update public.companies
     set note = case
                  when v_note is null then note
                  when coalesce(trim(note), '') = '' then v_note
                  else note || E'\n\n' || v_note
                end,
         gate_photo_path = v_photo
   where id = p_target_id;

  update public.trip_stops
     set company_id   = p_target_id,
         display_name = v_target.display_name,
         address      = v_target.address,
         lat          = v_target.lat,
         lng          = v_target.lng
   where company_id = any(p_source_ids);

  -- Contacts go with the cascade; trip stops were repointed above.
  delete from public.companies where id = any(p_source_ids);

  return v_orphans;
end;
$$;

revoke all on function public.merge_companies(uuid, uuid[]) from public, anon;
grant execute on function public.merge_companies(uuid, uuid[]) to authenticated;
