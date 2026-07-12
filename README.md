# Porkin 🐷 — Controle financeiro do Gabriel, da Bárbara e da Casa

App web para substituir as 3 planilhas de controle (pessoal do Gabriel, pessoal da
Bárbara e o projeto da Casa) por algo automático, com login, dashboards por perfil,
caixinhas com metas/prazos e sugestão inteligente de quanto investir.

## Stack

- **Supabase** (Postgres + Auth + API) — projeto `porkin-financas`, região São Paulo.
- **Next.js + Vercel** (a construir) — site + PWA pra registrar gasto rápido no celular.
- **LLM gratuita** (Fase 2) — classifica transações e lê e-mails de compra.

## Conexão

```
SUPABASE_URL      = https://obyygnysjyhsglwuvcvt.supabase.co
SUPABASE_ANON_KEY = sb_publishable_q0_gzkM-IbYJvLUtcROZgg_CW5184ra
```

Ver `.env.example`. A chave publishable é segura pro front-end — o acesso aos dados
é protegido por Row Level Security (RLS) por perfil.

## Banco de dados

Migrations em `supabase/migrations/` (já aplicadas no projeto):

| # | Arquivo | O que faz |
|---|---------|-----------|
| 01 | `01_core_schema.sql` | Perfis, contas, categorias, transações, metas, aportes, regras de distribuição + RLS |
| 02 | `02_house_module.sql` | Enxoval (`house_products`) e custos de mudança (`house_costs`) |
| 03 | `03_seed_data.sql` | Dados reais migrados das 3 planilhas |
| 04 | `04_logic_views.sql` | Views de progresso e função de sugestão de aporte |
| 05 | `05_refine_suggestion.sql` | Refino: metas de longo prazo não distorcem a distribuição |
| 06 | `06_security_hardening.sql` | Views com `security_invoker`, `search_path` fixo |

### Entidades principais

- **profiles** — Gabriel, Bárbara, Casa (compartilhado). Login via `profile_members`.
- **transactions** — gastos (valor, data, categoria, conta). `needs_review = true`
  dispara a notificação quando a LLM não souber classificar.
- **goals** (caixinhas) — meta, valor atual, prazo, prioridade, peso, tipo.
  A caixinha "Casa" dos dois é ligada por `joint_group = 'casa_futura'`.
- **contributions** — histórico de aportes.
- **allocation_rules** — a regra de cada um (Gabriel 60/20/10/10, Bárbara 60/30/10, Casa 70/30).

### Lógica de investimento

`fn_suggest_contributions(perfil, valor_disponível)` sugere quanto aportar em cada
caixinha. Ver explicação completa e as premissas em [`docs/analise-planilhas.md`](docs/analise-planilhas.md).

## Roadmap

- [x] **Fase 0** — Modelagem e migração dos dados (este commit).
- [ ] **Fase 1** — Front-end: login, cadastro rápido de transação (PWA), caixinhas, dashboards, importar CSV.
- [ ] **Fase 2** — Automático via e-mail: ler alerta de compra → LLM extrai valor/local → registra; notifica se não souber a categoria.
- [ ] **Fase 3** — Refino: sugestões ponderadas, alertas de teto, gráficos de progresso.
