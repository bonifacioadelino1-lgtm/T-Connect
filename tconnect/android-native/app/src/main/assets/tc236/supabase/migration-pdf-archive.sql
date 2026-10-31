-- =====================================================================
-- T-Connect — ARQUIVO de 30 dias para o RELATÓRIO PDF mensal
-- Execute UMA vez no SQL Editor do Supabase (idempotente).
--
-- Ideia: as tabelas principais (messages/calls) apagam-se aos 3 DIAS para poupar
-- armazenamento, MAS cada mensagem/chamada é copiada para 'capture_archive', que
-- guarda 30 DIAS (só texto — leve). O relatório PDF mensal lê deste arquivo, por
-- isso inclui tudo o que já foi apagado das tabelas principais, com datas e horas,
-- separado por Redes sociais / Mensagens / Chamadas.
-- =====================================================================

create table if not exists public.capture_archive (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null,
  device_id uuid,
  kind text not null,          -- 'sms' | 'social' | 'call'
  app text,                    -- whatsapp/telegram/... (para 'social')
  direction text,              -- RECEBIDA / ENVIADA / EFETUADA
  who text,                    -- remetente/grupo/número
  body text,                   -- texto da mensagem (ou duração da chamada)
  epoch_ms bigint,             -- data/hora real do item
  created_at timestamptz not null default now()
);
create index if not exists capture_archive_g_idx on public.capture_archive(guardian_id, epoch_ms desc);
create index if not exists capture_archive_c_idx on public.capture_archive(guardian_id, created_at desc);

alter table public.capture_archive enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='capture_archive' and policyname='archive self select') then
    create policy "archive self select" on public.capture_archive for select using (guardian_id = auth.uid() or public.tc_is_super_admin());
  end if;
end $$;

-- ---- Copia cada MENSAGEM nova para o arquivo (robusto: nunca quebra a sincronização) ----
create or replace function public.tc_archive_message() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.capture_archive(guardian_id,device_id,kind,app,direction,who,body,epoch_ms)
    values(NEW.guardian_id, NEW.device_id,
           case when coalesce(NEW.app,'') not in ('','sms') then 'social' else 'sms' end,
           NEW.app, NEW.direction, NEW.address, NEW.body, NEW.epoch_ms);
  exception when others then null;
  end;
  return NEW;
end; $$;
drop trigger if exists tc_trg_archive_message on public.messages;
create trigger tc_trg_archive_message after insert on public.messages
  for each row execute function public.tc_archive_message();

-- ---- Copia cada CHAMADA nova para o arquivo ----
create or replace function public.tc_archive_call() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.capture_archive(guardian_id,device_id,kind,direction,who,body,epoch_ms)
    values(NEW.guardian_id, NEW.device_id, 'call', NEW.direction, coalesce(NEW.name,NEW.number),
           'Duração: '||coalesce(NEW.duration_s,0)||'s'||case when NEW.name is not null then ' ('||NEW.number||')' else '' end,
           NEW.epoch_ms);
  exception when others then null;
  end;
  return NEW;
end; $$;
drop trigger if exists tc_trg_archive_call on public.calls;
create trigger tc_trg_archive_call after insert on public.calls
  for each row execute function public.tc_archive_call();

-- ---- Retenção do arquivo: 30 dias ----
create or replace function public.tc_prune_archive() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.05 then
    delete from public.capture_archive where created_at < now() - interval '30 days';
  end if;
  return NEW;
end; $$;
drop trigger if exists tc_trg_prune_archive on public.capture_archive;
create trigger tc_trg_prune_archive after insert on public.capture_archive
  for each row execute function public.tc_prune_archive();

-- ---- Semente: traz já para o arquivo o que ainda existe nas tabelas (últimos dias) ----
insert into public.capture_archive(guardian_id,device_id,kind,app,direction,who,body,epoch_ms)
  select guardian_id, device_id,
         case when coalesce(app,'') not in ('','sms') then 'social' else 'sms' end,
         app, direction, address, body, epoch_ms
  from public.messages
  on conflict do nothing;
insert into public.capture_archive(guardian_id,device_id,kind,direction,who,body,epoch_ms)
  select guardian_id, device_id, 'call', direction, coalesce(name,number),
         'Duração: '||coalesce(duration_s,0)||'s', epoch_ms
  from public.calls
  on conflict do nothing;

-- Limpeza imediata do arquivo (aplica já os 30 dias).
delete from public.capture_archive where created_at < now() - interval '30 days';
