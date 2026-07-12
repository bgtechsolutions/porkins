-- ============================================================================
-- Migration 05: Refino da função de sugestão
-- Metas de longo prazo SEM prazo (ex.: Liberdade Financeira) não devem ser
-- tratadas com urgência de 12 meses. Usa horizonte de 60 meses, evitando que
-- dominem a distribuição. Metas de curto/médio sem prazo seguem em 12 meses.
-- ============================================================================
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
    select g.id, g.name, g.current_amount, g.target_amount, g.weight, g.kind,
      greatest(g.target_amount - g.current_amount, 0) as falta,
      case
        when g.deadline is not null
          then greatest(ceil((g.deadline - current_date)::numeric / 30.0), 1)
        when g.kind = 'longo_prazo' then 60   -- horizonte longo p/ acúmulo de patrimônio
        else 12
      end as meses
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
