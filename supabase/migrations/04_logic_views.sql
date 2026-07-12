-- ============================================================================
-- Migration 04: Lógica de investimento (views + função de sugestão de aporte)
--
-- Estratégia (baseada em princípios de finanças pessoais amplamente aceitos):
--  1. Reserva de Emergência é a fundação — peso alto até estar completa.
--  2. Metas com prazo têm "necessidade mensal" = falta / meses restantes.
--  3. Se o dinheiro disponível cobre a soma das necessidades, cobre todas e
--     ACELERA o restante pelas de maior peso (prioridade).
--  4. Se não cobre, rateia por URGÊNCIA × PRIORIDADE (score = peso × necessidade),
--     para que metas mais apertadas e importantes recebam mais.
--  5. Metas concluídas (Viagem, Turbo da Bárbara) saem da distribuição.
-- ============================================================================

-- Progresso de cada caixinha ------------------------------------------------
create or replace view v_goal_progress as
select
  g.id, g.profile_id, g.name, g.kind, g.priority, g.weight, g.status,
  g.target_amount, g.current_amount, g.deadline, g.joint_group,
  greatest(g.target_amount - g.current_amount, 0)                as falta,
  round(g.current_amount / nullif(g.target_amount, 0), 4)        as progresso,
  case when g.deadline is not null
       then greatest((g.deadline - current_date), 0) end         as dias_restantes,
  case when g.deadline is not null
       then greatest(ceil((g.deadline - current_date)::numeric / 30.0), 1)
       else null end                                             as meses_restantes
from goals g;

-- Visão consolidada do investimento conjunto (Casa dos dois) -----------------
create or replace view v_joint_goals as
select
  g.joint_group,
  sum(g.target_amount)                                   as meta_total,
  sum(g.current_amount)                                  as atual_total,
  round(sum(g.current_amount) / nullif(sum(g.target_amount),0), 4) as progresso,
  min(g.deadline)                                        as prazo_mais_proximo,
  count(*)                                               as qtd_contribuintes
from goals g
where g.joint_group is not null
group by g.joint_group;

-- Gastos do mês corrente por bucket (pra comparar com a regra de distribuição)
create or replace view v_bucket_spending_current as
select
  t.profile_id,
  coalesce(c.bucket, 'outros')  as bucket,
  sum(t.amount)                 as total
from transactions t
left join categories c on c.id = t.category_id
where date_trunc('month', t.occurred_at) = date_trunc('month', current_date)
group by t.profile_id, coalesce(c.bucket, 'outros');

-- Função: sugestão de aporte por caixinha ------------------------------------
create or replace function fn_suggest_contributions(p_profile_id uuid, p_available numeric)
returns table (
  goal_id        uuid,
  name           text,
  current_amount numeric,
  target_amount  numeric,
  meses_restantes numeric,
  necessidade_mensal numeric,
  sugestao       numeric,
  criterio       text
) language sql stable as $$
  with base as (
    select g.id, g.name, g.current_amount, g.target_amount, g.weight,
      greatest(g.target_amount - g.current_amount, 0) as falta,
      case when g.deadline is not null
           then greatest(ceil((g.deadline - current_date)::numeric / 30.0), 1)
           else 12 end as meses
    from goals g
    where g.profile_id = p_profile_id
      and g.status = 'em_andamento'
      and g.target_amount - g.current_amount > 0
  ),
  need as (
    select *,
      round(falta / meses, 2)      as base_need,
      weight * (falta / meses)     as score
    from base
  ),
  tot as (
    select coalesce(sum(base_need),0) sum_need,
           coalesce(sum(score),0)     sum_score,
           coalesce(sum(weight),0)    sum_weight
    from need
  )
  select
    n.id, n.name, n.current_amount, n.target_amount, n.meses, n.base_need,
    case
      when (select sum_need from tot) <= p_available then
        round(n.base_need + (p_available - (select sum_need from tot))
              * (n.weight / nullif((select sum_weight from tot),0)), 2)
      else
        round(p_available * (n.score / nullif((select sum_score from tot),0)), 2)
    end as sugestao,
    case
      when (select sum_need from tot) <= p_available
        then 'Cobre a meta no prazo + aceleração pelas de maior prioridade'
      else 'Recurso insuficiente para todas: rateio por urgência × prioridade'
    end as criterio
  from need n
  order by n.weight desc, n.meses asc;
$$;
