-- =====================================================================
-- T-Connect — ARQUIVO do PDF: ciclo de 30 dias com REINÍCIO automático
-- Execute UMA vez no SQL Editor do Supabase.
--
-- Comportamento: o arquivo (capture_archive) acumula as capturas durante 30 dias.
-- Quando completa 30 dias, ZERA tudo e recomeça a contagem do zero, com as capturas
-- novas — e assim sucessivamente, ciclo após ciclo.
--
-- Não precisa de pg_cron: o reinício acontece na primeira captura que chega depois de
-- passarem os 30 dias. Guardar menos tempo é melhor para a privacidade.
-- =====================================================================

-- Tabela de controlo do ciclo (uma só linha, id = 1).
create table if not exists public.capture_cycle (
  id int primary key default 1,
  cycle_start timestamptz not null default now(),
  constraint capture_cycle_single check (id = 1)
);
insert into public.capture_cycle (id) values (1) on conflict (id) do nothing;

-- Antes de inserir uma nova captura no arquivo: se já passaram 30 dias desde o início
-- do ciclo, apaga TODO o arquivo e recomeça o ciclo a partir de agora. A linha nova
-- fica então a ser a primeira do novo ciclo.
create or replace function public.tc_archive_cycle_reset() returns trigger
  language plpgsql security definer set search_path = public as $$
declare cs timestamptz;
begin
  select cycle_start into cs from public.capture_cycle where id = 1;
  if cs is null then
    insert into public.capture_cycle (id, cycle_start) values (1, now())
      on conflict (id) do update set cycle_start = now();
  elsif now() >= cs + interval '30 days' then
    delete from public.capture_archive;
    update public.capture_cycle set cycle_start = now() where id = 1;
  end if;
  return NEW;
end; $$;

drop trigger if exists tc_trg_archive_cycle on public.capture_archive;
create trigger tc_trg_archive_cycle before insert on public.capture_archive
  for each row execute function public.tc_archive_cycle_reset();

-- Opcional: começar já um ciclo limpo agora (descomente as 2 linhas para zerar já).
-- delete from public.capture_archive;
-- update public.capture_cycle set cycle_start = now() where id = 1;
