-- ============================================================
-- T-Connect · Listar TODOS os emails cadastrados (Super Admin)
-- Execute este ficheiro no SQL Editor do Supabase (uma vez).
-- Permite ao Super Admin ver todas as contas registadas na
-- plataforma, mesmo as que ainda não têm subscrição.
-- ============================================================

create or replace function public.tc_admin_list_users()
returns table(email text, plan text, days integer, paid_at timestamptz, status text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Apenas o Super Admin pode listar todas as contas.
  if lower(coalesce(auth.jwt() ->> 'email','')) <> 'bonifacioadelino1@gmail.com' then
    raise exception 'not authorized';
  end if;

  return query
    select u.email::text,
           s.plan,
           s.days,
           s.paid_at,
           s.status
    from auth.users u
    left join public.subscriptions s on lower(s.email) = lower(u.email::text)
    order by u.created_at desc;
end;
$$;

grant execute on function public.tc_admin_list_users() to authenticated;
