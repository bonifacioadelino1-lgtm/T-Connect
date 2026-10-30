-- =====================================================================
-- T-Connect — Migração: RETENÇÃO / LIMITADORES (anti-enchimento da BD)
-- Execute UMA vez no SQL Editor do Supabase (depois de schema.sql / setup).
--
-- O que faz:
--   1) Limites AUTOMÁTICOS (triggers) para a base de dados nunca mais encher:
--        location_history : mantém os últimos 7 DIAS por dispositivo
--        messages / calls : mantém as últimas 1000 por dispositivo
--        capture_signals  : mantém apenas a última 1 HORA
--        activity_events  : mantém os últimos 300 por conta (guardian)
--      (cada trigger tem um "gate" aleatório: não corre a cada linha, só de vez
--       em quando, para ser barato e, mesmo assim, manter o tamanho controlado.)
--   2) LIMPEZA ÚNICA imediata (apaga já o excesso) + VACUUM para libertar espaço.
--
-- NOTA: o mapa NÃO é afetado. O ponto ao vivo vem da tabela `devices`
--       (last_lat/last_lng), não da location_history. Só o "Trajeto" lê a
--       location_history, e manter 7 dias cobre o trajeto de hoje e dos últimos dias.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) LIMITES AUTOMÁTICOS (triggers com gate aleatório)
-- ---------------------------------------------------------------------

-- location_history: últimos 7 dias por dispositivo
create or replace function public.tc_prune_location() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.05 then
    delete from public.location_history
      where device_id = NEW.device_id
        and epoch_ms < (extract(epoch from now())*1000)::bigint - 7*86400*1000;
  end if;
  return NEW;
end; $$;
drop trigger if exists tc_trg_prune_location on public.location_history;
create trigger tc_trg_prune_location after insert on public.location_history
  for each row execute function public.tc_prune_location();

-- messages: últimas 1000 por dispositivo
create or replace function public.tc_prune_messages() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.10 then
    delete from public.messages
      where device_id = NEW.device_id
        and id in (
          select id from (
            select id, row_number() over (
              partition by device_id order by epoch_ms desc nulls last, created_at desc
            ) rn
            from public.messages where device_id = NEW.device_id
          ) t where t.rn > 1000
        );
  end if;
  return NEW;
end; $$;
drop trigger if exists tc_trg_prune_messages on public.messages;
create trigger tc_trg_prune_messages after insert on public.messages
  for each row execute function public.tc_prune_messages();

-- calls: últimas 1000 por dispositivo
create or replace function public.tc_prune_calls() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.10 then
    delete from public.calls
      where device_id = NEW.device_id
        and id in (
          select id from (
            select id, row_number() over (
              partition by device_id order by epoch_ms desc nulls last, created_at desc
            ) rn
            from public.calls where device_id = NEW.device_id
          ) t where t.rn > 1000
        );
  end if;
  return NEW;
end; $$;
drop trigger if exists tc_trg_prune_calls on public.calls;
create trigger tc_trg_prune_calls after insert on public.calls
  for each row execute function public.tc_prune_calls();

-- capture_signals: só a última 1 hora (sinalização WebRTC — só serve ao vivo)
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

-- activity_events: últimos 300 por conta (guardian)
create or replace function public.tc_prune_activity() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.10 then
    delete from public.activity_events
      where guardian_id = NEW.guardian_id
        and id in (
          select id from (
            select id, row_number() over (
              partition by guardian_id order by occurred_at desc
            ) rn
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
-- 2) LIMPEZA ÚNICA IMEDIATA (apaga já o excesso acumulado)
-- ---------------------------------------------------------------------

-- location_history: tudo com mais de 7 dias
delete from public.location_history
  where epoch_ms < (extract(epoch from now())*1000)::bigint - 7*86400*1000;

-- messages: mantém as 1000 mais recentes por dispositivo
delete from public.messages
  where id in (
    select id from (
      select id, row_number() over (
        partition by device_id order by epoch_ms desc nulls last, created_at desc
      ) rn
      from public.messages
    ) t where t.rn > 1000
  );

-- calls: mantém as 1000 mais recentes por dispositivo
delete from public.calls
  where id in (
    select id from (
      select id, row_number() over (
        partition by device_id order by epoch_ms desc nulls last, created_at desc
      ) rn
      from public.calls
    ) t where t.rn > 1000
  );

-- capture_signals: só a última 1 hora
delete from public.capture_signals where created_at < now() - interval '1 hour';

-- activity_events: mantém 300 por conta
delete from public.activity_events
  where id in (
    select id from (
      select id, row_number() over (
        partition by guardian_id order by occurred_at desc
      ) rn
      from public.activity_events
    ) t where t.rn > 300
  );

-- ---------------------------------------------------------------------
-- 3) VACUUM — liberta o espaço para reutilização (o crescimento para já).
--    IMPORTANTE: o VACUUM não corre dentro de uma transação. Se o editor
--    der o erro "VACUUM cannot run inside a transaction block", selecione e
--    corra APENAS estas 5 linhas em separado.
--    Para encolher mesmo o ficheiro em disco (devolver espaço ao sistema),
--    pode correr, com algum espaço livre: VACUUM FULL public.location_history;
-- ---------------------------------------------------------------------
vacuum (analyze) public.location_history;
vacuum (analyze) public.messages;
vacuum (analyze) public.calls;
vacuum (analyze) public.capture_signals;
vacuum (analyze) public.activity_events;
