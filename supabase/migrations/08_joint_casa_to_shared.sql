-- ============================================================================
-- Migration 08: caixinha conjunta sob o perfil Casa (compartilhado)
-- Assim os dois enxergam a visão consolidada (RLS liberado p/ membros da Casa).
-- Cada linha guarda de quem é o aporte no próprio nome.
-- ============================================================================
do $$
declare gp uuid; bp uuid; cp uuid;
begin
  select id into gp from profiles where name = 'Gabriel';
  select id into bp from profiles where name = 'Bárbara';
  select id into cp from profiles where name = 'Casa';

  update goals set name = 'Casa — Gabriel', profile_id = cp
    where joint_group = 'casa_futura' and profile_id = gp;
  update goals set name = 'Casa — Bárbara', profile_id = cp
    where joint_group = 'casa_futura' and profile_id = bp;
end $$;
