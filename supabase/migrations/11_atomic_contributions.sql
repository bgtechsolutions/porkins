-- Aporte e atualização do saldo da meta na mesma transação.
-- Impede divergência entre contributions e goals.current_amount.
create or replace function fn_add_contribution(p_goal_id uuid, p_amount numeric)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_contribution_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'O aporte deve ser maior que zero';
  end if;

  select profile_id into v_profile_id
  from goals
  where id = p_goal_id
  for update;

  if v_profile_id is null or not is_profile_member(v_profile_id) then
    raise exception 'Meta não encontrada ou acesso negado';
  end if;

  insert into contributions (goal_id, profile_id, amount)
  values (p_goal_id, v_profile_id, p_amount)
  returning id into v_contribution_id;

  update goals
  set current_amount = current_amount + p_amount,
      status = case
        when current_amount + p_amount >= target_amount then 'concluida'::goal_status
        else status
      end
  where id = p_goal_id;

  return v_contribution_id;
end;
$$;

revoke execute on function fn_add_contribution(uuid, numeric) from public, anon;
grant execute on function fn_add_contribution(uuid, numeric) to authenticated;
