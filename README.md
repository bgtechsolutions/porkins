# Porkin 🐷

Controle financeiro do Gabriel, da Bárbara e da Casa. O aplicativo substitui as planilhas pessoais por lançamentos centralizados, dashboards por perfil, metas, aportes e planejamento da mudança.

## Stack

- Next.js 16 (App Router, Server Components e Server Actions)
- React 19, TypeScript e Tailwind CSS 4
- Supabase (Postgres, Auth, API e Row Level Security)
- Vercel, região `gru1` (São Paulo)
- Vitest para testes unitários

## Desenvolvimento

```bash
npm install
npm run dev
```

Crie `.env.local` a partir de `.env.example`. Apenas a chave pública do Supabase é usada no cliente; nunca adicione senhas, chaves administrativas ou tokens ao Git.

Validação completa:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Funcionalidades

- Login e perfis pessoais/compartilhado protegidos por RLS.
- Dashboard mensal, regra de tetos, ranking de categorias e visão da Casa.
- Cadastro, edição, exclusão e importação CSV de transações.
- Fontes de renda editáveis.
- Caixinhas com CRUD, histórico de aportes e sugestão de distribuição.
- Aportes transacionais no banco, sem divergência entre histórico e saldo.
- Enxoval, custos da mudança e contas recorrentes da Casa.
- Manifest instalável como PWA.
- Troca de senha dentro do perfil.

## Banco de dados

As migrations ficam em `supabase/migrations/` e devem ser aplicadas em ordem. As mais recentes são:

- `09_house_bill_payments.sql`: pagamento mensal das contas da Casa.
- `10_model_60_30_10.sql`: perfis e tetos configuráveis.
- `11_atomic_contributions.sql`: aporte e saldo da meta em uma única transação.

Usuários devem ser criados pelo Supabase Auth. A migration 07 apenas associa usuários existentes aos perfis; credenciais não são armazenadas no repositório.

## CSV

O importador aceita até 500 linhas ou 1 MB. Colunas obrigatórias: `Data` e `Valor`. Colunas opcionais: `Descrição`, `Categoria` e `Conta`. Datas podem usar `DD/MM/AAAA` ou `AAAA-MM-DD`.

## Próximos passos

- Aplicar a migration 11 em produção e validar os fluxos autenticados.
- Adicionar testes de integração do Supabase/RLS e testes end-to-end.
- Instalar service worker/offline real e ícones dedicados para ampliar o suporte PWA.
- Configurar recuperação de senha por e-mail e exigir rotação das senhas antigas.
- Fase 2: ingestão de alertas de compra e classificação assistida por LLM.

Consulte [docs/analise-planilhas.md](docs/analise-planilhas.md) para o histórico de modelagem e as premissas financeiras.
