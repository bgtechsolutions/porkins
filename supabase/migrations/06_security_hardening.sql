-- ============================================================================
-- Migration 06: Blindagem de segurança (aponta os alertas do linter do Supabase)
--  - Views passam a respeitar o RLS de quem consulta (security_invoker).
--  - Funções ganham search_path fixo.
--  - is_profile_member não fica exposta ao papel anônimo.
-- ============================================================================
alter view v_goal_progress             set (security_invoker = true);
alter view v_joint_goals               set (security_invoker = true);
alter view v_bucket_spending_current   set (security_invoker = true);

create or replace function is_profile_member(p_profile_id uuid)
returns boolean language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_members m
    where m.profile_id = p_profile_id and m.user_id = (select auth.uid())
  );
$$;
revoke execute on function is_profile_member(uuid) from anon;

alter function fn_suggest_contributions(uuid, numeric) set search_path = public;
