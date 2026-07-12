-- ============================================================================
-- Migration 03: Seed com os dados reais das 3 planilhas
-- Valores de renda: usados os das planilhas pessoais (mais detalhadas).
-- Ajustar em profiles.monthly_income / income_sources quando confirmarem.
-- ============================================================================
do $$
declare
  g uuid;  -- Gabriel
  b uuid;  -- Bárbara
  c uuid;  -- Casa
begin
  -- ----- Perfis -------------------------------------------------------------
  insert into profiles (name, type, color, monthly_income)
    values ('Gabriel', 'pessoal', '#2563eb', 3750) returning id into g;
  insert into profiles (name, type, color, monthly_income)
    values ('Bárbara', 'pessoal', '#db2777', 5350) returning id into b;
  insert into profiles (name, type, color, monthly_income)
    values ('Casa', 'compartilhado', '#16a34a', null) returning id into c;

  -- ----- Fontes de renda ----------------------------------------------------
  insert into income_sources (profile_id, name, kind, amount, is_variable) values
    (g, 'Salário fixo', 'salario', 2000, false),
    (g, 'BG Tech', 'salario', 1750, false),
    (g, 'Vale-combustível', 'beneficio', 0, true),
    (g, 'Hora extra', 'extra', 0, true),
    (b, 'Salário líquido', 'salario', 5350, false);

  -- ----- Contas / cartões ---------------------------------------------------
  insert into accounts (profile_id, name, kind) values
    (g, 'Nubank Débito', 'debito'),
    (g, 'Nubank Crédito', 'credito'),
    (g, 'Santander', 'conta'),
    (b, 'Nubank Débito', 'debito'),
    (b, 'Nubank Crédito', 'credito'),
    (b, 'Cartão Black', 'credito');

  -- ----- Regras de distribuição --------------------------------------------
  insert into allocation_rules (profile_id, bucket, label, percentage) values
    (g, 'essencial',  'Despesas essenciais',   0.60),
    (g, 'lazer',      'Desejos / Lazer',       0.20),
    (g, 'reserva',    'Reserva de Emergência', 0.10),
    (g, 'liberdade',  'Liberdade Financeira',  0.10),
    (b, 'obrigatoria','Despesas obrigatórias',      0.60),
    (b, 'nao_obrig',  'Despesas não obrigatórias',  0.30),
    (b, 'investir',   'Investimentos',              0.10),
    (c, 'caixinha',   'Caixinha Casa',  0.70),
    (c, 'compras',    'Compras da casa',0.30);

  -- ----- Caixinhas / metas --------------------------------------------------
  -- Gabriel
  insert into goals (profile_id, name, target_amount, current_amount, deadline, priority, weight, kind, status, joint_group) values
    (g, 'Reserva de Emergência', 25000, 1791.85, '2027-07-01', 'alta',  3, 'reserva',     'em_andamento', null),
    (g, 'Projeto Audi',           5000,  600.73, '2027-07-01', 'media', 2, 'curto_prazo', 'em_andamento', null),
    (g, 'Viagem',                 5000,  595.46, '2026-08-01', 'media', 2, 'medio_prazo', 'em_andamento', null),
    (g, 'Casa',                  25000,  833.74, '2026-10-05', 'alta',  3, 'curto_prazo', 'em_andamento', 'casa_futura'),
    (g, 'Liberdade Financeira', 100000,       0, null,         'media', 2, 'longo_prazo', 'em_andamento', null);
  -- Bárbara
  insert into goals (profile_id, name, target_amount, current_amount, deadline, priority, weight, kind, status, joint_group) values
    (b, 'Reserva de Emergência', 45000, 32075.83, '2026-12-31', 'alta',  3, 'reserva',     'em_andamento', null),
    (b, 'Internacional',         50000, 14450.49, '2027-02-01', 'baixa', 1, 'longo_prazo', 'em_andamento', null),
    (b, 'Rinoplastia',           30000, 27731.78, '2026-10-19', 'media', 2, 'curto_prazo', 'em_andamento', null),
    (b, 'Viagem',                 6000,  6343.91, '2026-01-01', 'media', 2, 'medio_prazo', 'concluida',    null),
    (b, 'Casa',                  25000,  6719.65, '2026-10-05', 'alta',  3, 'curto_prazo', 'em_andamento', 'casa_futura'),
    (b, 'Turbo',                  5500,  8153.30, '2026-01-01', 'media', 2, 'medio_prazo', 'concluida',    null);

  -- ----- Categorias globais padronizadas ------------------------------------
  insert into categories (name, bucket, is_income) values
    ('Mercado',              'essencial',   false),
    ('Alimentação fora',     'lazer',       false),
    ('Transporte',           'essencial',   false),
    ('Combustível',          'essencial',   false),
    ('Saúde',                'essencial',   false),
    ('Farmácia',             'essencial',   false),
    ('Educação',             'essencial',   false),
    ('Assinaturas',          'essencial',   false),
    ('Moradia',              'moradia',     false),
    ('Casa / Utensílios',    'essencial',   false),
    ('Carro / Manutenção',   'essencial',   false),
    ('Vestuário',            'lazer',       false),
    ('Beleza / Cuidados',    'lazer',       false),
    ('Presentes',            'lazer',       false),
    ('Lazer / Entretenimento','lazer',      false),
    ('Investimento / Aporte','investimento',false),
    ('Salário / Renda',      'investimento',true),
    ('Outros',               'essencial',   false);

  -- ----- Casa: Controle de Produtos (enxoval) -------------------------------
  insert into house_products (profile_id, category, name, priority, ideal_qty, planned_month, buy_when, min_value, max_value, budget_base, real_value, status, paid_by) values
    (c,'Cozinha','Jogo de panelas inox fundo triplo',1,'1 jogo de 4 peças','Junho','Antes da mudança',420,800,610,517.75,'comprado','Casal'),
    (c,'Cozinha','Frigideira antiaderente boa',1,'1 unidade','Junho','Antes da mudança',120,306,213,229.95,'comprado','Casal'),
    (c,'Cozinha','Tábuas de corte',1,'1 unidade','Junho','Antes da mudança',100,180,140,186.10,'comprado','Casal'),
    (c,'Cozinha','Panos de prato',1,'2 a 6 unidades','Junho','Antes da mudança',60,120,90,0,'presente','Nenhum'),
    (c,'Mesa','Faqueiro inox',2,'24 peças','Julho','Antes da mudança',150,400,275,0,'pendente','Casal'),
    (c,'Mesa','Aparelho de jantar',2,'16 peças','Julho','Antes da mudança',250,700,475,0,'pendente','Casal'),
    (c,'Mesa','Copos',2,'6 unidades','Julho','Antes da mudança',60,150,105,0,'pendente','Casal'),
    (c,'Mesa','Canecas / xícaras',2,'4 unidades','Julho','Antes da mudança',60,140,100,0,'pendente','Casal'),
    (c,'Cozinha','Potes herméticos',2,'8 a 12 unidades','Julho','Antes da mudança',90,180,135,0,'pendente','Casal'),
    (c,'Cozinha','Utensílios de cozinha',2,'1 kit','Julho','Antes da mudança',100,180,140,0,'pendente','Casal'),
    (c,'Cozinha','Kit pedras de afiar duplo',3,'1 kit','Agosto','Antes da mudança',200,250,225,0,'pendente','Casal'),
    (c,'Cama e banho','Jogo de cama 100% algodão',3,'2 jogos','Agosto','Antes da mudança',300,500,400,0,'pendente','Casal'),
    (c,'Cama e banho','Travesseiros bons',3,'2 unidades','Agosto','Antes da mudança',160,350,255,0,'pendente','Casal'),
    (c,'Cama e banho','Protetor de colchão',3,'1 unidade','Agosto','Antes da mudança',100,200,150,0,'pendente','Casal'),
    (c,'Cama e banho','Toalhas de banho',3,'4 unidades','Agosto','Antes da mudança',280,500,390,0,'pendente','Casal'),
    (c,'Cama e banho','Toalhas de rosto',3,'4 unidades','Agosto','Antes da mudança',160,300,230,0,'pendente','Casal'),
    (c,'Banho','Tapete de banheiro de diatomita',4,'1 ou 2 unidades','Setembro','Pode esperar',65,150,107.5,0,'pendente','Casal'),
    (c,'Limpeza','Lixeiras cozinha / banheiro',4,'2 unidades','Setembro','Pode esperar',100,220,160,0,'pendente','Casal'),
    (c,'Limpeza','Cesto de roupa',4,'1 unidade','Setembro','Após imóvel definido',80,180,130,0,'pendente','Casal'),
    (c,'Limpeza','Varal de chão',4,'1 unidade','Setembro','Após imóvel definido',120,250,185,0,'pendente','Casal'),
    (c,'Limpeza','Kit limpeza inicial',4,'1 kit','Setembro','Pode esperar',150,250,200,0,'pendente','Casal'),
    (c,'Cozinha','Escorredor de louça',4,'1 unidade','Setembro','Após imóvel definido',50,150,100,0,'pendente','Casal'),
    (c,'Cozinha','Escorredor de macarrão',4,'1 unidade','Setembro','Pode esperar',30,80,55,0,'pendente','Casal'),
    (c,'Cozinha','Ralador',4,'1 unidade','Outubro','Pode esperar',25,80,52.5,0,'pendente','Casal'),
    (c,'Cozinha','Abridor de lata / garrafa',4,'1 unidade','Setembro','Antes da mudança',20,60,40,0,'pendente','Casal'),
    (c,'Cama e banho','Edredom / cobertor leve',4,'1 unidade','Outubro','Pode esperar',120,300,210,0,'pendente','Casal'),
    (c,'Eletrodoméstico','Geladeira Inverter',1,'1 unidade',null,'Após imóvel definido',null,null,null,0,'pendente','Casal'),
    (c,'Eletrodoméstico','Fogão',1,'1 unidade',null,'Após imóvel definido',null,null,null,0,'pendente','Casal'),
    (c,'Eletrodoméstico','Ar condicionado Inverter',1,'1 unidade',null,'Após imóvel definido',null,null,null,0,'pendente','Casal'),
    (c,'Móvel','Sofá',null,'1 unidade',null,'Depois da mudança',null,null,null,0,'pendente','Casal'),
    (c,'Móvel','Mesa de jantar',null,'1 unidade',null,'Depois da mudança',null,null,null,0,'pendente','Casal'),
    (c,'Eletrodoméstico','Air-fryer',null,null,null,'Após imóvel definido',null,null,null,0,'pendente','Casal'),
    (c,'Eletrodoméstico','Robô aspirador',null,'1 unidade',null,'Depois da mudança',null,null,null,0,'pendente','Casal');

  -- ----- Casa: Custos de mudança (recorrentes) ------------------------------
  insert into house_costs (profile_id, cost_type, name, min_value, max_value, expected_value, essential, note) values
    (c,'recorrente','Aluguel',1350,1350,1350,true,'Valor do imóvel informado'),
    (c,'recorrente','Condomínio',460,460,460,true,'Valor informado'),
    (c,'recorrente','IPTU',216.15,216.15,216.15,true,'Valor informado'),
    (c,'recorrente','Seguro fiança',209.31,209.31,209.31,true,'12x informado'),
    (c,'recorrente','Energia',250,300,300,true,'Base: gastos da irmã'),
    (c,'recorrente','Água',100,100,100,true,'Base: gastos da irmã'),
    (c,'recorrente','Internet',120,120,120,true,'Base informada'),
    (c,'recorrente','Gás mensalizado',45,65,55,true,'Botijão R$130 dura 2 a 3 meses'),
    (c,'recorrente','Mercado',1200,1600,1400,true,'Estimativa para duas pessoas'),
    (c,'recorrente','Limpeza / higiene',150,250,200,true,'Produtos de casa e higiene'),
    (c,'recorrente','Lavanderia sem máquina',150,250,200,true,'Enquanto não houver máquina'),
    (c,'recorrente','Margem de segurança',100,300,200,true,'Pequenas variações mensais');

  -- ----- Casa: Custos de mudança (entrada) ----------------------------------
  insert into house_costs (profile_id, cost_type, name, min_value, max_value, expected_value, essential, buy_when, note) values
    (c,'entrada','Primeiro mês do imóvel',2235.46,2235.46,2235.46,true,'Ao assinar','Aluguel + condomínio + IPTU + seguro'),
    (c,'entrada','Geladeira',3150,3500,3300,true,'Após imóvel definido','Ver voltagem, espaço e porta'),
    (c,'entrada','Fogão',1370,1500,1450,true,'Após imóvel definido','Ver gás encanado/botijão e medidas'),
    (c,'entrada','Mudança / instalações',800,1200,1000,true,'Mês da mudança','Transporte, instalação e imprevistos'),
    (c,'entrada','Mercado inicial',600,1000,800,true,'Mês da mudança','Primeira compra maior'),
    (c,'entrada','Itens urgentes faltantes',800,1500,1000,true,'Mês da mudança','Só o essencial'),
    (c,'entrada','Reserva mínima preservada',5000,5000,5000,true,'Antes de assinar','Não usar para decoração');
end $$;
