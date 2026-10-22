-- ============================================================================
-- T-Connect — Redefinição SIMPLES de senha (sem e-mail)
-- ----------------------------------------------------------------------------
-- Cria a RPC public.guardian_reset_password(email, nova_senha), chamada pela
-- tela "Redefinir senha" do Guardian. A pessoa escreve o e-mail e uma nova
-- senha (duas vezes) e a senha é alterada de imediato, sem passo de e-mail.
--
-- ⚠️  AVISO DE SEGURANÇA (leia antes de instalar):
--     Esta função permite definir uma nova senha SÓ com o e-mail, sem
--     verificação. Ou seja, quem souber um e-mail registado pode mudar a
--     senha dessa conta (e, assim, ver a localização da criança associada).
--     É "fácil" como pediu, mas menos seguro do que o normal.
--     Alternativa recomendada: ativar o envio de e-mail no Supabase
--     (Authentication → Email) e usar o link de recuperação.
--
-- Como instalar: abra o Supabase → SQL Editor, cole este ficheiro e execute.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.guardian_reset_password(p_email text, p_new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid;
begin
  if p_new_password is null or length(p_new_password) < 8 then
    raise exception 'A nova senha deve ter pelo menos 8 caracteres.';
  end if;

  select id into v_id
    from auth.users
   where lower(email) = lower(trim(p_email))
   limit 1;

  if v_id is null then
    return false;  -- não existe conta com esse e-mail
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = v_id;

  return true;
end;
$$;

-- Só a função (SECURITY DEFINER) toca na tabela auth.users; os utilizadores
-- apenas podem executar a RPC, não aceder diretamente à tabela.
revoke all on function public.guardian_reset_password(text, text) from public;
grant execute on function public.guardian_reset_password(text, text) to anon, authenticated;
