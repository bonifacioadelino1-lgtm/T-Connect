-- =====================================================================
-- T-Connect — APAGAR conversas/mensagens/chamadas também na BASE DE DADOS
-- Execute UMA vez no SQL Editor do Supabase.
--
-- Antes, apagar uma conversa no Guardian só a escondia no painel (localStorage).
-- Com estas políticas, quando o Guardian elimina uma conversa, uma mensagem ou uma
-- chamada, as linhas são MESMO apagadas da base de dados (Supabase).
--
-- Segurança: o Guardian só pode apagar as linhas que lhe pertencem (as que o seu
-- próprio dispositivo vinculado capturou), porque a política exige guardian_id = auth.uid().
-- Não apaga nada no telemóvel da criança — só no histórico guardado na nuvem.
-- =====================================================================

alter table public.messages enable row level security;
alter table public.calls    enable row level security;

-- Mensagens (SMS + redes sociais): o Guardian pode apagar as suas
drop policy if exists messages_guardian_delete on public.messages;
create policy messages_guardian_delete on public.messages
  for delete to authenticated using (guardian_id = auth.uid());

-- Chamadas: o Guardian pode apagar as suas
drop policy if exists calls_guardian_delete on public.calls;
create policy calls_guardian_delete on public.calls
  for delete to authenticated using (guardian_id = auth.uid());
