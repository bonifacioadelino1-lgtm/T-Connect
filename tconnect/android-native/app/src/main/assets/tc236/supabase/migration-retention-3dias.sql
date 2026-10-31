-- =====================================================================
-- T-Connect — RETENÇÃO: no máximo 3 DIAS (mensagens, chamadas, localização)
-- Substitui os limites anteriores. Execute UMA vez no SQL Editor do Supabase.
--
-- Regra: tudo o que completar 3 dias é APAGADO automaticamente da base de dados.
--   messages (SMS + notificações de apps) : 3 dias (pela data da mensagem)
--   calls (chamadas)                       : 3 dias (pela data da chamada)
--   location_history (localização)         : 3 dias
--   capture_signals (sinalização WebRTC)   : 1 hora
--   activity_events (atividades)           : 300 por conta
-- Os gatilhos têm um "gate" aleatório (não correm a cada linha) + há uma limpeza
-- única imediata no fim. NÃO inclui VACUUM (corra-o à parte se quiser libertar já).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) LIMITES AUTOMÁTICOS (3 dias)
-- ---------------------------------------------------------------------

-- messages: 3 dias (usa a data da mensagem; se faltar, usa a de inserção)
create or replace function public.tc_prune_messages() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.10 then
    delete from public.messages
      where device_id = NEW.device_id
        and coalesce(epoch_ms, (extract(epoch from created_at)*1000)::bigint)
            < (extract(epoch from now())*1000)::bigint - 3*86400*1000;
  end if;
  return NEW;
end; $$;
drop trigger if exists tc_trg_prune_messages on public.messages;
create trigger tc_trg_prune_messages after insert on public.messages
  for each row execute function public.tc_prune_messages();

-- calls: 3 dias
create or replace function public.tc_prune_calls() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.10 then
    delete from public.calls
      where device_id = NEW.device_id
        and coalesce(epoch_ms, (extract(epoch from created_at)*1000)::bigint)
            < (extract(epoch from now())*1000)::bigint - 3*86400*1000;
  end if;
  return NEW;
end; $$;
drop trigger if exists tc_trg_prune_calls on public.calls;
create trigger tc_trg_prune_calls after insert on public.calls
  for each row execute function public.tc_prune_calls();

-- location_history: 12 HORAS (é a que mais ocupa espaço)
create or replace function public.tc_prune_location() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.05 then
    delete from public.location_history
      where device_id = NEW.device_id
        and coalesce(epoch_ms, (extract(epoch from recorded_at)*1000)::bigint)
            < (extract(epoch from now())*1000)::bigint - 12*3600*1000;
  end if;
  return NEW;
end; $$;
drop trigger if exists tc_trg_prune_location on public.location_history;
create trigger tc_trg_prune_location after insert on public.location_history
  for each row execute function public.tc_prune_location();

-- capture_signals: 1 hora (mantém-se)
create or replace function public.tc_prune_capture_signals() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.20 then
    delete from public.capture_signals where created_at < now() - interval '1 hour';
  end if;
  return NEW;
end; $$;
drop trigger if exists tc_trg_prune_capture on public.capture_signals;
create trigger tc_trg_prune_capture after insert on public.capture_signals
  for each row execute function public.tc_prune_capture_signals();

-- activity_events: 300 por conta (mantém-se)
create or replace function public.tc_prune_activity() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.10 then
    delete from public.activity_events
      where guardian_id = NEW.guardian_id
        and id in (
          select id from (
            select id, row_number() over (partition by guardian_id order by occurred_at desc) rn
            from public.activity_events where guardian_id = NEW.guardian_id
          ) t where t.rn > 300
        );
  end if;
  return NEW;
end; $$;
drop trigger if exists tc_trg_prune_activity on public.activity_events;
create trigger tc_trg_prune_activity after insert on public.activity_events
  for each row execute function public.tc_prune_activity();

-- ---------------------------------------------------------------------
-- 2) LIMPEZA ÚNICA IMEDIATA (aplica já os 3 dias)
-- ---------------------------------------------------------------------
delete from public.messages
  where coalesce(epoch_ms, (extract(epoch from created_at)*1000)::bigint)
        < (extract(epoch from now())*1000)::bigint - 3*86400*1000;

delete from public.calls
  where coalesce(epoch_ms, (extract(epoch from created_at)*1000)::bigint)
        < (extract(epoch from now())*1000)::bigint - 3*86400*1000;

delete from public.location_history
  where coalesce(epoch_ms, (extract(epoch from recorded_at)*1000)::bigint)
        < (extract(epoch from now())*1000)::bigint - 12*3600*1000;

delete from public.capture_signals where created_at < now() - interval '1 hour';

delete from public.activity_events
  where id in (
    select id from (
      select id, row_number() over (partition by guardian_id order by occurred_at desc) rn
      from public.activity_events
    ) t where t.rn > 300
  );

-- Para libertar o espaço já (opcional, correr numa consulta SEPARADA):
--   vacuum (analyze) public.messages;
--   vacuum (analyze) public.calls;
--   vacuum (analyze) public.location_history;
