-- ============================================================================
-- T-Connect — Vínculo PERMANENTE
-- ----------------------------------------------------------------------------
-- Problema: o aplicativo da criança usa sessão anónima. Se a identidade anónima
-- muda (token perdido, limpeza, etc.), o dispositivo ficava "órfão" e deixava de
-- enviar dados — o vínculo parecia quebrar e as mensagens/chamadas recentes não
-- chegavam ao Guardian.
--
-- Solução: cada dispositivo passa a ter um "pair_token" (segredo) guardado também
-- no telemóvel. Com ele, a criança RE-VINCULA a sessão atual ao mesmo dispositivo
-- sem precisar de novo código. Vale para os dois caminhos (código/QR/link e e-mail).
--
-- Instalar: Supabase → SQL Editor → colar e executar. (Depois de instalar o
-- migration-device-limit.sql, se ainda não o fez.)
-- ============================================================================

alter table public.devices add column if not exists pair_token text;

-- 1) claim_pairing_code com token (gera um se não vier) e devolve-o à criança.
create or replace function public.claim_pairing_code(p_code text, p_device_code text, p_device_name text default 'T-Connect Child', p_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.pairing_codes%rowtype; d uuid; g uuid; tok text;
begin
  select * into p from public.pairing_codes where code=upper(trim(p_code)) and used_at is null and expires_at>now() order by created_at desc limit 1;
  if p.id is null then raise exception 'Código inválido ou expirado'; end if;
  if not exists (select 1 from public.profiles where id=auth.uid()) then
    raise exception 'Perfil não encontrado';
  end if;
  update public.profiles set role='child' where id=auth.uid();
  insert into public.guardian_children(guardian_id,child_id) values(p.guardian_id,auth.uid()) on conflict do nothing;
  tok := coalesce(nullif(p_token,''), gen_random_uuid()::text);
  insert into public.devices(owner_id,child_id,device_code,device_name,platform,status,last_seen_at,pair_token)
  values(p.guardian_id,auth.uid(),p_device_code,p_device_name,'web','online',now(),tok)
  on conflict(device_code) do update set
    owner_id=excluded.owner_id, child_id=excluded.child_id, device_name=excluded.device_name,
    status='online', last_seen_at=now(),
    pair_token=coalesce(public.devices.pair_token, excluded.pair_token)
  returning id, pair_token into d, tok;
  update public.pairing_codes set used_at=now() where id=p.id;
  g:=p.guardian_id;
  return jsonb_build_object('guardian_id',g,'device_id',d,'child_id',auth.uid(),'pair_token',tok);
end;
$$;
grant execute on function public.claim_pairing_code(text,text,text,text) to authenticated;

-- 2) child_set_token: define o token UMA vez (para o fluxo por e-mail e dispositivos
--    antigos). Só o dono atual (a criança vinculada) pode definir, e só se ainda não houver.
create or replace function public.child_set_token(p_device_code text, p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare d public.devices%rowtype;
begin
  select * into d from public.devices where device_code=p_device_code limit 1;
  if d.id is null then return false; end if;
  if d.child_id is distinct from auth.uid() then return false; end if;
  if d.pair_token is not null then return true; end if;
  update public.devices set pair_token=coalesce(nullif(p_token,''), gen_random_uuid()::text) where id=d.id;
  return true;
end;
$$;
grant execute on function public.child_set_token(text,text) to authenticated;

-- 3) child_relink: re-vincula a sessão ATUAL ao dispositivo, exigindo o token
--    (permanência segura — sem o token ninguém rouba o dispositivo).
create or replace function public.child_relink(p_device_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.devices%rowtype;
begin
  select * into d from public.devices where device_code=p_device_code limit 1;
  if d.id is null then return jsonb_build_object('linked',false,'reason','no_device'); end if;
  if d.pair_token is null or d.pair_token <> p_token then
    return jsonb_build_object('linked',false,'reason','bad_token');
  end if;
  update public.devices set child_id=auth.uid(), status='online', last_seen_at=now() where id=d.id;
  insert into public.guardian_children(guardian_id,child_id) values(d.owner_id,auth.uid()) on conflict do nothing;
  return jsonb_build_object('linked',true,'guardian_id',d.owner_id,'device_id',d.id);
end;
$$;
grant execute on function public.child_relink(text,text) to authenticated;
