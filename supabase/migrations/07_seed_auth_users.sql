-- ============================================================================
-- Migration 07: vínculo de usuários já criados no Supabase Auth com os perfis.
-- As contas e senhas devem ser criadas pelo painel/API administrativa do Auth;
-- credenciais nunca devem ser armazenadas em migrations ou no Git.
-- gabriel@porkin.app -> perfil Gabriel + Casa
-- barbara@porkin.app -> perfil Bárbara + Casa
-- ============================================================================
do $$
declare gp uuid; bp uuid; cp uuid; gu uuid; bu uuid;
begin
  select id into gp from profiles where name = 'Gabriel';
  select id into bp from profiles where name = 'Bárbara';
  select id into cp from profiles where name = 'Casa';

  select id into gu from auth.users where lower(email) = 'gabriel@porkin.app';
  select id into bu from auth.users where lower(email) = 'barbara@porkin.app';

  if gu is null or bu is null then
    raise exception 'Crie gabriel@porkin.app e barbara@porkin.app no Supabase Auth antes desta migration';
  end if;

  insert into profile_members (profile_id, user_id, role)
  values (gp, gu, 'owner'), (cp, gu, 'owner'), (bp, bu, 'owner'), (cp, bu, 'owner')
  on conflict (profile_id, user_id) do nothing;
end $$;
