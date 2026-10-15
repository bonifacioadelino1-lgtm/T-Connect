-- ============================================================================
-- T-Connect — Limpeza de dispositivos duplicados / de teste
-- Cole no SQL Editor do Supabase e carregue em RUN.
--
-- IMPORTANTE: a tabela "devices" tem ON DELETE CASCADE, por isso apagar um
-- dispositivo também apaga os dados capturados ligados a ESSE dispositivo
-- (mensagens, chamadas, contactos, apps, histórico de localização).
-- Como estes são registos de TESTE, não há problema. Ainda assim, confirme
-- antes de correr. Faça um backup se tiver dados reais que queira manter.
-- ============================================================================

begin;

-- 1) DUPLICADOS: por cada PESSOA (child_id) mantém só UM dispositivo —
--    o que está online e/ou foi visto mais recentemente — e apaga os restantes.
with ranked as (
  select id,
         row_number() over (
           partition by coalesce(child_id::text, device_code)
           order by (status = 'online') desc,
                    last_seen_at desc nulls last,
                    created_at   desc
         ) as rn
  from public.devices
)
delete from public.devices d
using ranked r
where d.id = r.id
  and r.rn > 1;

-- 2) Pedidos de vínculo antigos ou já tratados.
delete from public.pairing_requests
where status <> 'PENDING'
   or created_at < now() - interval '1 day';

-- 3) Códigos de vinculação já usados ou expirados.
delete from public.pairing_codes
where used_at is not null
   or expires_at < now();

-- 4) Vínculos Guardian↔Child que ficaram sem nenhum dispositivo.
delete from public.guardian_children gc
where not exists (
  select 1 from public.devices d where d.child_id = gc.child_id
);

commit;

-- Confere o que ficou:
select device_name, status, last_seen_at
from public.devices
order by last_seen_at desc nulls last;


-- ----------------------------------------------------------------------------
-- OPCIONAL — RESET TOTAL DOS DISPOSITIVOS DE TESTE
-- Remove a linha de comentário (--) das 2 linhas abaixo APENAS se quiser
-- apagar TODOS os dispositivos e recomeçar do zero. Isto apaga também todos
-- os dados capturados. Não dá para desfazer.
-- ----------------------------------------------------------------------------
-- truncate table public.devices cascade;
-- delete from public.guardian_children;
