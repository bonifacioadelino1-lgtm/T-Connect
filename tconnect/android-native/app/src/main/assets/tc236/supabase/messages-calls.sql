-- ============================================================
-- T-Connect — Mensagens e Chamadas (sincronização automática)
-- Cole este ficheiro no SQL Editor do Supabase e execute.
-- É seguro executar mais do que uma vez.
-- ============================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null,
  child_id uuid not null,
  device_id uuid not null references public.devices(id) on delete cascade,
  source_id text not null,
  address text,
  body text,
  direction text,
  epoch_ms bigint,
  sent_at timestamptz,
  created_at timestamptz default now(),
  unique (device_id, source_id, direction)
);
create index if not exists messages_guardian_idx on public.messages(guardian_id, epoch_ms desc);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null,
  child_id uuid not null,
  device_id uuid not null references public.devices(id) on delete cascade,
  source_id text not null,
  number text,
  name text,
  direction text,
  duration_s bigint default 0,
  epoch_ms bigint,
  called_at timestamptz,
  created_at timestamptz default now(),
  unique (device_id, source_id, direction)
);
create index if not exists calls_guardian_idx on public.calls(guardian_id, epoch_ms desc);

alter table public.messages enable row level security;
alter table public.calls enable row level security;

drop policy if exists messages_guardian_select on public.messages;
create policy messages_guardian_select on public.messages
  for select to authenticated using (guardian_id = auth.uid());

drop policy if exists calls_guardian_select on public.calls;
create policy calls_guardian_select on public.calls
  for select to authenticated using (guardian_id = auth.uid());

-- RPC: o Child sincroniza as suas mensagens (array JSON vindo do Android)
create or replace function public.child_sync_messages(p_device_code text, p_items jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare d public.devices%rowtype; it jsonb; n integer := 0;
begin
  select * into d from public.devices where device_code=p_device_code and child_id=auth.uid() limit 1;
  if d.id is null then raise exception 'Dispositivo não vinculado'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into public.messages(guardian_id,child_id,device_id,source_id,address,body,direction,epoch_ms,sent_at)
    values(d.owner_id,auth.uid(),d.id,
           coalesce(it->>'id',''), it->>'address', it->>'body', coalesce(it->>'direction','OUTRA'),
           nullif(it->>'date','')::bigint,
           to_timestamp(coalesce(nullif(it->>'date','')::bigint,0)/1000.0))
    -- Se a mensagem AINDA existe no telemóvel (foi reenviada nesta sincronização),
    -- então não está apagada: repõe deleted=false. Isto auto-corrige mensagens que
    -- tenham sido marcadas como apagadas por engano (leitura parcial/temporária do SMS),
    -- que era o motivo de "só aparecerem as antigas".
    on conflict (device_id, source_id, direction) do update
      set deleted = false, deleted_at = null,
          body = coalesce(excluded.body, public.messages.body),
          address = coalesce(excluded.address, public.messages.address);
    if found then n := n + 1; end if;
  end loop;
  update public.devices set status='online', last_seen_at=now() where id=d.id;
  return n;
end; $$;
grant execute on function public.child_sync_messages(text,jsonb) to authenticated;

-- RPC: o Child sincroniza o seu registo de chamadas
create or replace function public.child_sync_calls(p_device_code text, p_items jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare d public.devices%rowtype; it jsonb; n integer := 0;
begin
  select * into d from public.devices where device_code=p_device_code and child_id=auth.uid() limit 1;
  if d.id is null then raise exception 'Dispositivo não vinculado'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into public.calls(guardian_id,child_id,device_id,source_id,number,name,direction,duration_s,epoch_ms,called_at)
    values(d.owner_id,auth.uid(),d.id,
           coalesce(it->>'id',''), it->>'number', it->>'name', coalesce(it->>'direction','OUTRA'),
           coalesce(nullif(it->>'duration','')::bigint,0),
           nullif(it->>'date','')::bigint,
           to_timestamp(coalesce(nullif(it->>'date','')::bigint,0)/1000.0))
    on conflict (device_id, source_id, direction) do nothing;
    if found then n := n + 1; end if;
  end loop;
  update public.devices set status='online', last_seen_at=now() where id=d.id;
  return n;
end; $$;
grant execute on function public.child_sync_calls(text,jsonb) to authenticated;

-- Realtime
do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.calls;    exception when duplicate_object then null; end $$;
