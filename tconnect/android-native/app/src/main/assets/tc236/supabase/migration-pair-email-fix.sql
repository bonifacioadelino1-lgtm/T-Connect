-- ============================================================================
-- T-Connect — Correção do vínculo por E-MAIL
-- ----------------------------------------------------------------------------
-- Problema: a função só encontrava o Guardian se o perfil tivesse role='guardian',
-- mas muitas contas não têm esse campo definido — por isso o próprio e-mail do
-- Guardian dava "não tem guardião".
--
-- Correção: encontra a conta pelo e-mail (em auth.users) desde que NÃO seja uma
-- conta de criança, e auto-corrige o role para 'guardian'. Além disso, se a
-- criança estiver na PRÓPRIA conta do Guardian (mesmo e-mail/login), vincula já.
--
-- Requer: migration-pair-email.sql e migration-permanent-pairing.sql instalados.
-- Instalar: Supabase → SQL Editor → colar e executar.
-- ============================================================================

create or replace function public.request_pairing_by_email(
  p_email text, p_device_code text, p_device_name text default 'T-Connect Child', p_token text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare g uuid; r uuid; d uuid; tok text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if coalesce(trim(p_email),'') = '' then raise exception 'E-mail em falta'; end if;
  if coalesce(trim(p_device_code),'') = '' then raise exception 'Dispositivo sem identificador'; end if;

  -- Encontra a conta pelo e-mail (não exige role='guardian'; basta não ser 'child').
  select u.id into g
    from auth.users u
    left join public.profiles p on p.id = u.id
   where lower(u.email) = lower(trim(p_email))
     and coalesce(p.role,'guardian') <> 'child'
   limit 1;

  if g is null then
    return jsonb_build_object('ok', false);
  end if;

  -- Auto-corrige/garante o perfil do Guardian encontrado.
  insert into public.profiles(id, role) values (g, 'guardian')
    on conflict (id) do update
      set role = case when public.profiles.role is distinct from 'child' then 'guardian' else public.profiles.role end;

  tok := coalesce(nullif(p_token,''), gen_random_uuid()::text);

  -- Caso 1: a criança está na PRÓPRIA conta do Guardian → vínculo imediato.
  if g = auth.uid() then
    insert into public.devices(owner_id, child_id, device_code, device_name, platform, status, last_seen_at, pair_token)
      values (g, g, p_device_code, coalesce(nullif(trim(p_device_name),''),'T-Connect Child'), 'android', 'online', now(), tok)
    on conflict(device_code) do update set
      owner_id=excluded.owner_id, child_id=excluded.child_id, device_name=excluded.device_name,
      status='online', last_seen_at=now(), pair_token=coalesce(public.devices.pair_token, excluded.pair_token)
    returning id, pair_token into d, tok;
    return jsonb_build_object('ok', true, 'linked', true, 'device_id', d, 'guardian_id', g, 'pair_token', tok);
  end if;

  -- Caso 2: criança (sessão diferente) pede vínculo → fica pendente para o Guardian aprovar.
  insert into public.profiles(id, full_name, role)
    values (auth.uid(), 'Minha Segurança', 'child')
    on conflict (id) do nothing;

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

grant execute on function public.request_pairing_by_email(text,text,text,text) to authenticated;
