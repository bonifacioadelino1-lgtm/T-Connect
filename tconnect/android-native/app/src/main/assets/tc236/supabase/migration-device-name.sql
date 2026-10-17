-- ============================================================================
-- T-Connect — Nome real do dispositivo no Guardian
-- Permite que a Criança (Shield) grave o nome/modelo real do aparelho
-- (ex.: "Samsung Galaxy A12") no seu próprio registo de dispositivo, para o
-- Guardian ler esse nome em vez de "T-Connect Child".
-- Cole no SQL Editor do Supabase e carregue em RUN.
-- (Dispositivos vinculados a partir de agora já enviam o nome na vinculação;
--  esta função serve para atualizar os que já estavam vinculados.)
-- ============================================================================

create or replace function public.child_set_device_name(p_device_code text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if coalesce(trim(p_name),'') = '' then return jsonb_build_object('ok', false); end if;
  update public.devices
     set device_name = left(trim(p_name), 80)
   where device_code = p_device_code
     and child_id = auth.uid();
  return jsonb_build_object('ok', found);
end;
$$;

grant execute on function public.child_set_device_name(text, text) to authenticated;
