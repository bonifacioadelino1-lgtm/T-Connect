-- ============================================================================
-- T-Connect — Limite de dispositivos por plano (no SERVIDOR)
-- ----------------------------------------------------------------------------
-- Impede ligar mais telemóveis do que o plano permite, mesmo que alguém tente
-- fora da app. Vale para os dois caminhos de vínculo (código e pedido por
-- e-mail), porque ambos inserem em public.devices.
--
--   • Familiar ............ 5 dispositivos
--   • Premium / Anual ..... ilimitado
--   • Grátis .............. ilimitado (mas a conta fecha aos 7 dias)
--   • Sem plano definido .. tratado como Familiar (5), por segurança
--
-- Re-vincular um aparelho JÁ existente (mesmo device_code) não conta como novo.
-- Como instalar: Supabase → SQL Editor → colar e executar.
-- ============================================================================

create or replace function public.tc_guardian_device_limit(p_owner uuid)
returns integer language sql stable security definer set search_path = public, auth as $$
  select case
    when pl in ('premium','anual','free') then 2147483647
    when pl = 'familiar' then 5
    else 5
  end
  from (
    select coalesce(
      (select s.plan from public.subscriptions s where s.user_id = p_owner order by s.updated_at desc limit 1),
      (select s.plan from public.subscriptions s
         join auth.users u on lower(u.email) = lower(s.email)
        where u.id = p_owner order by s.updated_at desc limit 1)
    ) as pl
  ) q;
$$;

create or replace function public.tc_enforce_device_limit()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_limit integer; v_count integer;
begin
  -- Re-vínculo do MESMO aparelho (device_code já existe) não conta como novo.
  if exists (select 1 from public.devices where device_code = NEW.device_code) then
    return NEW;
  end if;
  v_limit := coalesce(public.tc_guardian_device_limit(NEW.owner_id), 5);
  select count(*) into v_count from public.devices where owner_id = NEW.owner_id;
  if v_count >= v_limit then
    raise exception 'LIMITE_DISPOSITIVOS: o seu plano permite % dispositivo(s) e já tem %. Atualize o plano para ligar mais.', v_limit, v_count
      using errcode = 'check_violation';
  end if;
  return NEW;
end; $$;

drop trigger if exists tc_device_limit on public.devices;
create trigger tc_device_limit
  before insert on public.devices
  for each row execute function public.tc_enforce_device_limit();
