-- ============================================================================
-- reset_id_sequence(p_table)
-- Run this ONCE in the Supabase SQL editor.
--
-- Repoints a table's identity sequence to MAX(id) so that deleting the top
-- (most recently created) row lets the next insert reuse that id — no skipped
-- numbers in a create -> get -> delete test cycle. Deleting a middle row still
-- leaves its gap (renumbering existing rows would break foreign keys).
--
-- Called by the API DELETE endpoints via supabase.rpc('reset_id_sequence', ...).
-- ============================================================================
create or replace function reset_id_sequence(p_table text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  seq text;
  maxid bigint;
begin
  -- Whitelist tables — hardens the dynamic format() below against bad input.
  if p_table not in ('products', 'intentions', 'leads', 'lead_answers') then
    raise exception 'reset_id_sequence: table % not allowed', p_table;
  end if;

  seq := pg_get_serial_sequence(p_table, 'id');
  if seq is null then
    return null; -- no identity/serial "id" column on this table -> nothing to reset
  end if;

  execute format('select coalesce(max(id), 0) from %I', p_table) into maxid;

  if maxid = 0 then
    perform setval(seq, 1, false);   -- empty table -> next nextval() = 1
    return 0;
  else
    perform setval(seq, maxid, true); -- next nextval() = maxid + 1
    return maxid;
  end if;
end;
$$;
