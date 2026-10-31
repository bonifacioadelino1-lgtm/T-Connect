-- =====================================================================
-- T-Connect — RESET: apaga TODO o histórico antigo e começa do ZERO
-- Execute UMA vez no SQL Editor do Supabase.
--
-- Apaga tudo o que já foi capturado (mensagens, chamadas, notificações de apps
-- e histórico de localização). A partir daqui, só entram os registos NOVOS.
-- A estrutura, os limites (3 dias / 12 horas) e as funções mantêm-se — isto só
-- limpa os DADOS. Não apaga contas, planos, dispositivos nem vínculos.
-- =====================================================================

-- Mensagens (SMS + notificações de apps: WhatsApp/Telegram/...)
delete from public.messages;

-- Chamadas
delete from public.calls;

-- Histórico de localização
delete from public.location_history;

-- Arquivo de 30 dias do relatório PDF — também recomeça do zero, para o relatório
-- ficar alinhado com os dados. (Se preferir MANTER o histórico do PDF, apague/comente
-- a linha seguinte antes de correr.)
delete from public.capture_archive;

-- Atividades do terminal (opcional — pode comentar se quiser manter)
delete from public.activity_events;

-- ---------------------------------------------------------------------
-- Libertar o espaço já (opcional). O VACUUM NÃO corre dentro de uma transação:
-- se der erro, abra uma consulta NOVA e corra estas linhas uma a uma.
-- ---------------------------------------------------------------------
-- vacuum (analyze) public.messages;
-- vacuum (analyze) public.calls;
-- vacuum (analyze) public.location_history;
-- vacuum (analyze) public.capture_archive;
