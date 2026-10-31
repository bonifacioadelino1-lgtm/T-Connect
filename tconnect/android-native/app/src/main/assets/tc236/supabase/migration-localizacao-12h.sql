-- =====================================================================
-- T-Connect — LOCALIZAÇÃO: retenção de 12 HORAS (em vez de 3 dias)
-- A localização é a que mais ocupa espaço, por isso guarda só 12 horas.
-- As mensagens e chamadas continuam nos 3 dias (não mexe nelas).
-- Execute UMA vez no SQL Editor do Supabase (idempotente).
-- =====================================================================

-- Gatilho automático: apaga a localização com mais de 12 horas.
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

-- Limpeza imediata: apaga já tudo o que passou das 12 horas.
delete from public.location_history
  where coalesce(epoch_ms, (extract(epoch from recorded_at)*1000)::bigint)
        < (extract(epoch from now())*1000)::bigint - 12*3600*1000;

-- Opcional (consulta SEPARADA) para libertar já o espaço:
--   vacuum (analyze) public.location_history;
