-- ============================================================================
-- T-Connect — Mensagens do WhatsApp (por notificação, com consentimento)
-- ----------------------------------------------------------------------------
-- A Criança concede "Acesso às notificações" ao T-Connect (ação explícita no
-- Android). A partir daí, as mensagens que o WhatsApp mostra nas notificações são
-- guardadas e enviadas ao Guardian. Não há interceção da conversa cifrada — só o
-- que aparece na notificação do próprio aparelho.
--
-- Guarda na tabela 'messages' com app='whatsapp' (as SMS ficam com app='sms').
-- Instalar: Supabase → SQL Editor → colar e executar.
-- ============================================================================

alter table public.messages add column if not exists app text not null default 'sms';
create index if not exists messages_app_idx on public.messages(device_id, app, epoch_ms desc);

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
           'whatsapp')
    on conflict (device_id, source_id, direction) do nothing;
    if found then n := n + 1; end if;
  end loop;
  update public.devices set status='online', last_seen_at=now() where id=d.id;
  return n;
end;
$$;
grant execute on function public.child_sync_whatsapp(text,jsonb) to authenticated;
