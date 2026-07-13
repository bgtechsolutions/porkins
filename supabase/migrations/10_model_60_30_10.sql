-- ============================================================================
-- Migration 10: Modelo 60/30/10 (educação financeira)
--  60% Despesas obrigatórias · 30% Não obrigatórias · 10% Investimentos (inclui reserva)
--  As despesas são TETO (não podem passar). Investimento pode passar (é bom).
--  Configurável por perfil (profile_type + allocation_rules).
-- ============================================================================
alter table profiles add column if not exists profile_type text not null default 'razoavel';

-- Recategoriza os buckets para o vocabulário 60/30/10
update categories set bucket = 'obrigatoria' where bucket in ('essencial', 'moradia');
update categories set bucket = 'nao_obrig'  where bucket = 'lazer';
-- 'investimento' permanece

-- Zera as regras dos perfis pessoais e recria em 60/30/10
delete from allocation_rules ar
  using profiles p
  where ar.profile_id = p.id and p.type = 'pessoal';

insert into allocation_rules (profile_id, bucket, label, percentage)
select p.id, v.bucket, v.label, v.pct
from profiles p
cross join (values
  ('obrigatoria',  'Despesas obrigatórias',           0.60),
  ('nao_obrig',    'Despesas não obrigatórias',       0.30),
  ('investimento', 'Investimentos (inclui reserva)',  0.10)
) as v(bucket, label, pct)
where p.type = 'pessoal';
