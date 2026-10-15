-- ============================================================================
-- T-Connect — Vinculação por e-mail (aprovação pelo Guardian)
-- Fluxo transparente e com consentimento:
--   1) A Criança (Shield) escreve o e-mail da conta do Guardian.
--   2) É criado um PEDIDO pendente (pairing_requests).
--   3) O Guardian vê o pedido no seu app e APROVA (ou rejeita).
--   4) Ao aprovar, o dispositivo fica vinculado (igual a claim_pairing_code).
-- Não requer SMTP/magic-link. Cole este ficheiro no SQL Editor do Supabase.
-- ============================================================================

create table if not exists public.pairing_requests (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references auth.users(id) on delete cascade,
  device_code text not null,
  device_name text,
  status text not null default 'PENDING',   -- PENDING | APPROVED | REJECTED
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists pairing_requests_guardian_idx
  on public.pairing_requests(guardian_id, status, created_at desc);
create index if not exists pairing_requests_child_idx
  on public.pairing_requests(child_id, created_at desc);

alter table public.pairing_requests enable row level security;

drop policy if exists "pair req guardian read" on public.pairing_requests;
create policy "pair req guardian read" on public.pairing_requests
  for select using (auth.uid() = guardian_id or auth.uid() = child_id);

-- (Escritas são feitas apenas através das funções security definer abaixo.)

-- ----------------------------------------------------------------------------
-- A Criança pede vínculo pelo e-mail do Guardian.
-- Devolve {ok:true} se existe um Guardian com esse e-mail (pedido criado),
-- senão {ok:false}. child_id = utilizador anónimo atual (a própria Criança).
-- ----------------------------------------------------------------------------
create or replace function public.request_pairing_by_email(
  p_email text, p_device_code text, p_device_name text default 'T-Connect Child'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare g uuid; r uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if coalesce(trim(p_email),'') = '' then raise exception 'E-mail em falta'; end if;
  if coalesce(trim(p_device_code),'') = '' then raise exception 'Dispositivo sem identificador'; end if;

  select u.id into g
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) = lower(trim(p_email))
     and p.role = 'guardian'
   limit 1;

  if g is null then
    -- Não revela se o e-mail existe; apenas informa que não foi encontrado Guardian.
    return jsonb_build_object('ok', false);
  end if;

  -- Garante o perfil da Criança.
  insert into public.profiles(id, full_name, role)
    values (auth.uid(), 'Minha Segurança', 'child')
    on conflict (id) do nothing;

  -- Evita pedidos pendentes duplicados para o mesmo Guardian+dispositivo.
  update public.pairing_requests
     set created_at = now()
   where guardian_id = g and child_id = auth.uid()
     and device_code = p_device_code and status = 'PENDING';

  if not found then
    insert into public.pairing_requests(guardian_id, child_id, device_code, device_name, status)
      values (g, auth.uid(), p_device_code, coalesce(nullif(trim(p_device_name),''),'T-Connect Child'), 'PENDING')
      returning id into r;
  else
    select id into r from public.pairing_requests
      where guardian_id = g and child_id = auth.uid()
        and device_code = p_device_code and status = 'PENDING'
      order by created_at desc limit 1;
  end if;

  return jsonb_build_object('ok', true, 'request_id', r);
end;
$$;

grant execute on function public.request_pairing_by_email(text,text,text) to authenticated;

-- ----------------------------------------------------------------------------
-- O Guardian lista os pedidos pendentes (com o e-mail da Criança).
-- ----------------------------------------------------------------------------
create or replace function public.list_pairing_requests()
returns table(id uuid, child_email text, device_code text, device_name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select pr.id,
           coalesce(cu.email, 'dispositivo'),
           pr.device_code, pr.device_name, pr.created_at
      from public.pairing_requests pr
      left join auth.users cu on cu.id = pr.child_id
     where pr.guardian_id = auth.uid()
       and pr.status = 'PENDING'
     order by pr.created_at desc;
end;
$$;

grant execute on function public.list_pairing_requests() to authenticated;

-- ----------------------------------------------------------------------------
-- O Guardian aprova (ou rejeita) um pedido. Ao aprovar, vincula o dispositivo.
-- ----------------------------------------------------------------------------
create or replace function public.approve_pairing_request(p_request_id uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pr public.pairing_requests%rowtype; d uuid;
begin
  select * into pr from public.pairing_requests where id = p_request_id;
  if pr.id is null then raise exception 'Pedido não encontrado'; end if;
  if pr.guardian_id <> auth.uid() then raise exception 'Sem permissão'; end if;
  if pr.status <> 'PENDING' then raise exception 'Pedido já tratado'; end if;

  if not p_approve then
    update public.pairing_requests set status='REJECTED', decided_at=now() where id=pr.id;
    return jsonb_build_object('ok', true, 'status', 'REJECTED');
  end if;

  update public.profiles set role='child' where id = pr.child_id;
  insert into public.guardian_children(guardian_id, child_id)
    values (pr.guardian_id, pr.child_id) on conflict do nothing;
  insert into public.devices(owner_id, child_id, device_code, device_name, platform, status, last_seen_at)
    values (pr.guardian_id, pr.child_id, pr.device_code, pr.device_name, 'android', 'online', now())
    on conflict(device_code) do update set
      owner_id = excluded.owner_id, child_id = excluded.child_id,
      device_name = excluded.device_name, status='online', last_seen_at=now()
    returning id into d;
  update public.pairing_requests set status='APPROVED', decided_at=now() where id=pr.id;

  return jsonb_build_object('ok', true, 'status','APPROVED', 'device_id', d);
end;
$$;

grant execute on function public.approve_pairing_request(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- A Criança verifica se o pedido já foi aprovado (para entrar no painel).
-- ----------------------------------------------------------------------------
create or replace function public.child_pairing_state(p_device_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare dev public.devices%rowtype; req text;
begin
  select * into dev from public.devices
    where device_code = p_device_code and child_id = auth.uid() limit 1;
  if dev.id is not null then
    return jsonb_build_object('linked', true, 'guardian_id', dev.owner_id);
  end if;
  select status into req from public.pairing_requests
    where child_id = auth.uid() and device_code = p_device_code
    order by created_at desc limit 1;
  return jsonb_build_object('linked', false, 'status', coalesce(req,'NONE'));
end;
$$;

grant execute on function public.child_pairing_state(text) to authenticated;
