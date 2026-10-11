-- ============================================================
-- T-Connect · Mensagens apagadas num só lugar
-- Execute este ficheiro no SQL Editor do Supabase (uma vez).
-- Acrescenta a marca de "apagada" às mensagens e um RPC para o
-- aplicativo da criança marcar as SMS que foram apagadas do
-- telemóvel. O Guardian continua a mostrá-las numa secção própria.
-- ============================================================

alter table public.messages add column if not exists deleted boolean not null default false;
alter table public.messages add column if not exists deleted_at timestamptz;

create or replace function public.child_mark_deleted(p_device_code text, p_source_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare d public.devices%rowtype; n integer := 0;
begin
  select * into d from public.devices where device_code = p_device_code and child_id = auth.uid() limit 1;
  if d.id is null then raise exception 'Dispositivo não vinculado'; end if;
  update public.messages
     set deleted = true, deleted_at = now()
   where device_id = d.id
     and source_id = any(p_source_ids)
     and deleted = false;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.child_mark_deleted(text, text[]) to authenticated;
