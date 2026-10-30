-- =====================================================================
-- T-Connect — VACUUM (correr DEPOIS de migration-retention.sql)
-- Correr numa consulta NOVA/SEPARADA no SQL Editor do Supabase.
-- O VACUUM não pode correr dentro de uma transação, por isso NÃO pode
-- estar no mesmo script dos triggers/limpeza. Se o editor reclamar,
-- corra cada linha isoladamente (uma de cada vez).
-- =====================================================================

vacuum (analyze) public.location_history;
vacuum (analyze) public.messages;
vacuum (analyze) public.calls;
vacuum (analyze) public.capture_signals;
vacuum (analyze) public.activity_events;

-- Opcional: devolve mesmo o espaço ao disco (bloqueia a tabela durante a
-- operação e precisa de algum espaço livre). Corra uma de cada vez:
-- vacuum full public.location_history;
-- vacuum full public.messages;
-- vacuum full public.calls;
