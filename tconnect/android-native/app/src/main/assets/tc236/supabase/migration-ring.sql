-- ============================================================
-- T-Connect · Tocar alarme no telemóvel da criança (encontrar)
-- Execute este ficheiro no SQL Editor do Supabase (uma vez).
-- O Guardião pede (guardian_ring) e a criança verifica (child_check_ring)
-- e toca o alarme. Fica pendente se a criança estiver offline.
-- ============================================================

alter table public.devices add column if not exists ring_at timestamptz;

-- O Guardião (dono do dispositivo) aciona o alarme.
create or replace function public.guardian_ring(p_device_code text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare d public.devices%rowtype; t timestamptz := now();
begin
  select * into d from public.devices where device_code = p_device_code and owner_id = auth.uid() limit 1;
  if d.id is null then raise exception 'Dispositivo nao encontrado'; end if;
  update public.devices set ring_at = t where id = d.id;
  return t;
end;
$$;
grant execute on function public.guardian_ring(text) to authenticated;

-- A criança verifica se há um pedido de alarme.
create or replace function public.child_check_ring(p_device_code text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare d public.devices%rowtype;
begin
  select * into d from public.devices where device_code = p_device_code and child_id = auth.uid() limit 1;
  if d.id is null then return null; end if;
  return d.ring_at;
end;
$$;
grant execute on function public.child_check_ring(text) to authenticated;
