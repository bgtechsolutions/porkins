-- ============================================================================
-- Migration 07: Usuários de login (já confirmados) e vínculo com os perfis
-- Senha temporária: Porkin@2026  (trocar depois pela tela de conta)
-- gabriel@porkin.app -> perfil Gabriel + Casa
-- barbara@porkin.app -> perfil Bárbara + Casa
-- ============================================================================
do $$
declare gp uuid; bp uuid; cp uuid; gu uuid; bu uuid;
begin
  select id into gp from profiles where name = 'Gabriel';
  select id into bp from profiles where name = 'Bárbara';
  select id into cp from profiles where name = 'Casa';

  -- ----- Gabriel -----
  gu := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', gu, 'authenticated', 'authenticated',
    'gabriel@porkin.app', extensions.crypt('Porkin@2026', extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Gabriel"}', false,
    '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), gu, jsonb_build_object('sub', gu::text, 'email', 'gabriel@porkin.app'),
    'email', 'gabriel@porkin.app', now(), now(), now()
  );
  insert into profile_members (profile_id, user_id, role) values (gp, gu, 'owner'), (cp, gu, 'owner');

  -- ----- Bárbara -----
  bu := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', bu, 'authenticated', 'authenticated',
    'barbara@porkin.app', extensions.crypt('Porkin@2026', extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Bárbara"}', false,
    '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), bu, jsonb_build_object('sub', bu::text, 'email', 'barbara@porkin.app'),
    'email', 'barbara@porkin.app', now(), now(), now()
  );
  insert into profile_members (profile_id, user_id, role) values (bp, bu, 'owner'), (cp, bu, 'owner');
end $$;
