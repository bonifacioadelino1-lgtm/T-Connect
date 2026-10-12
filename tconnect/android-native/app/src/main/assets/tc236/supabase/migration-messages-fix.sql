-- ============================================================
-- T-Connect · Correção: recuperar mensagens recentes/escondidas
-- Execute este ficheiro no SQL Editor do Supabase (uma vez).
--
-- Problema: algumas mensagens recentes eram marcadas como "apagadas"
-- por engano (quando o Android devolvia uma leitura parcial das SMS),
-- e o Guardian deixava de as mostrar na lista principal — ficavam só
-- as antigas. Esta correção faz com que qualquer mensagem que AINDA
-- existe no telemóvel (e por isso é reenviada na sincronização) volte
-- a ficar visível automaticamente (deleted = false).
-- ============================================================

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
          body = coalesce(excluded.body, public.messages.body),
          address = coalesce(excluded.address, public.messages.address);
    if found then n := n + 1; end if;
  end loop;
  update public.devices set status='online', last_seen_at=now() where id=d.id;
  return n;
end; $$;
grant execute on function public.child_sync_messages(text,jsonb) to authenticated;

-- Opcional: recuperar JÁ as que tinham sido escondidas por engano nos últimos 30 dias.
-- (As que foram realmente apagadas no telemóvel serão remarcadas no próximo ciclo.)
update public.messages
   set deleted = false, deleted_at = null
 where deleted = true
   and deleted_at > now() - interval '30 days';
