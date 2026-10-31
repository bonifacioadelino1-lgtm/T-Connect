-- =====================================================================
-- T-Connect — FIX definitivo: captura de notificações de apps (WhatsApp/Telegram)
-- Execute UMA vez no SQL Editor do Supabase. É idempotente (pode correr sem risco).
--
-- Porque é que SMS e chamadas funcionam mas WhatsApp dá 0:
--   A função child_sync_whatsapp GRAVA na coluna messages.app; as SMS e as chamadas
--   NÃO usam essa coluna. Se a coluna 'app' OU a função child_sync_whatsapp não
--   existirem (migração nunca aplicada), TODA a sincronização de apps falha em
--   silêncio — exatamente o sintoma observado (apps_por_notificacao = 0).
-- Este script garante que tudo o que o pipeline precisa existe e está correto.
-- =====================================================================

-- 1) Coluna 'app' em messages (origem da mensagem: whatsapp/telegram/...).
alter table public.messages add column if not exists app text;

-- 2) Colunas de "apagada" usadas por child_sync_messages (garantia).
alter table public.messages add column if not exists deleted boolean not null default false;
alter table public.messages add column if not exists deleted_at timestamptz;

-- 3) (Re)cria a função que grava as mensagens de apps, guardando a app por item.
create or replace function public.child_sync_whatsapp(p_device_code text, p_items jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare d public.devices%rowtype; it jsonb; n integer := 0;
begin
  select * into d from public.devices where device_code=p_device_code and child_id=auth.uid() limit 1;
  if d.id is null then raise exception 'Dispositivo não vinculado'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into public.messages(guardian_id,child_id,device_id,source_id,address,body,direction,epoch_ms,sent_at,app)
    values(d.owner_id, auth.uid(), d.id,
           coalesce(it->>'id',''), it->>'sender', it->>'text', 'RECEBIDA',
           nullif(it->>'date','')::bigint,
           to_timestamp(coalesce(nullif(it->>'date','')::bigint,0)/1000.0),
           coalesce(nullif(it->>'app',''),'whatsapp'))
    on conflict (device_id, source_id, direction) do nothing;
    if found then n := n + 1; end if;
  end loop;
  update public.devices set status='online', last_seen_at=now() where id=d.id;
  return n;
end;
$$;
grant execute on function public.child_sync_whatsapp(text,jsonb) to authenticated;

-- 4) Também garante child_sync_messages (SMS) com a reposição de 'deleted' (não perde SMS).
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
    on conflict (device_id, source_id, direction) do update
      set deleted = false, deleted_at = null,
          body = coalesce(excluded.body, public.messages.body);
    if found then n := n + 1; end if;
  end loop;
  update public.devices set status='online', last_seen_at=now() where id=d.id;
  return n;
end;
$$;
grant execute on function public.child_sync_messages(text,jsonb) to authenticated;

-- 5) CONFIRMAÇÃO (o resultado desta consulta é o diagnóstico):
--    deve listar child_sync_calls, child_sync_messages e child_sync_whatsapp,
--    e a coluna 'app' deve aparecer como existente.
select
  (select string_agg(proname, ', ' order by proname) from pg_proc where proname like 'child_sync%') as funcoes,
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='messages' and column_name='app') as coluna_app_existe;
