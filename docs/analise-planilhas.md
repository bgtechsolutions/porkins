# Análise das planilhas — o que virou banco, o que é repetitivo e o que não é usado

Este documento resume como as 3 planilhas foram interpretadas, aponta o que estava
**repetido ou sem uso** (pra não carregarmos isso pro app) e explica a **lógica de
investimento** embutida no banco.

---

## 1. Raio-X: repetitivo ou sem uso

### Planilha do Gabriel (18 abas → o app precisa de ~5 conceitos)

| Aba | Situação | No app |
|-----|----------|--------|
| `Entradas`, `Geral`, `Distribuição`, `Controle` | **Repetição.** As quatro recalculam a mesma coisa (renda × regra 60/20/10/10) por ângulos diferentes. | Vira **1 regra** (`allocation_rules`) + dashboard que calcula sozinho. |
| `2026 - Despesas` | **Derivada.** É só a soma por banco das abas `Bancos`. Mantida à mão. | Vira uma **view** somando `transactions`. |
| `Bancos - Nubank/NubankCredito` | Uma **linha por estabelecimento** (Mercado, Uber, Chipa…). Vira centenas de linhas e você tem que criar linha nova pra cada lugar novo. | Vira `transactions` + `categories`. Estabelecimento é texto livre, categoria é padronizada. |
| `Bancos - Santander` | **Sem uso.** Todos os meses zerados. | Conta cadastrada, mas sem lançamentos. |
| `Lançamento do Mês`, `Lançamentos mensais`, `Investimento mensal` | **Repetição tripla.** Três visões dos mesmos aportes. | Vira **1 tabela** `contributions`. |
| Abas `Desenhos` (×4) | **Lixo de exportação** do Numbers. Vazias. | Descartadas. |

### Planilha da Bárbara (9 abas)

| Aba | Situação | No app |
|-----|----------|--------|
| `2026` | **Derivada.** Consolida os totais de Black/Nubank Déb/Créd + caixinhas — tudo que já existe nas outras abas. | View de dashboard. |
| `Lançamentos Mensais` | **Repetição.** Duplica a matriz mensal de aportes das caixinhas. | `contributions`. |
| `Invest Nubank` | **Praticamente vazia** (valores zerados). | Ignorada por ora. |
| `Progresso Gráfico` | **Vazia.** | Descartada — o app faz os gráficos. |
| `Black`, `Nubank Débito`, `Nubank Crédito` | Mesmo padrão "1 linha por estabelecimento" do Gabriel. | `transactions` + `categories`. |

> Ponto bom da sua planilha, Bárbara: as **caixinhas com peso/prioridade e sugestão
> mensal ponderada** já são uma lógica de investimento de verdade. Foi ela que inspirou
> a função de sugestão do app (ver seção 2).

### Planilha da Casa (9 abas)

| Aba | Situação | No app |
|-----|----------|--------|
| `Controle de Produtos` | **Página "pai"** — a fonte real do enxoval. | `house_products`. |
| `Prioridades de Compras`, `Enxoval Inicial` | **Repetição.** A própria planilha diz que são "abas-filhas que puxam do Controle de Produtos". São só filtros/ordenações. | Viram **visões filtradas** da mesma tabela (por prioridade, por status). |
| `Listas` | Fonte dos menus suspensos (meses, status, categorias). | Vira enums/valores de referência no banco. |
| `Resumo`, `Plano Mensal` | Úteis, mas recalculam a regra 70/30 e o teto de compras. | Regra em `allocation_rules` + dashboard. |
| `Gastos na Mudança` | Útil e única. Despesas recorrentes + de entrada com rateio proporcional. | `house_costs`. |
| `Regras e Critérios` | Texto de apoio (checklist antes de comprar). | Vira conteúdo estático/ajuda no app. |

**Resumo do resumo:** das ~36 abas, o app precisa de **~8 tabelas**. O resto era
recálculo manual, duplicação ou artefato de exportação — coisas que um banco de dados
faz sozinho e sem risco de divergência entre abas.

---

## 2. Lógica de investimento (`fn_suggest_contributions`)

Dado um perfil e quanto ele tem disponível pra investir no mês, a função distribui
esse valor entre as caixinhas ativas. Princípios (baseados em finanças pessoais
consolidadas — reserva primeiro, metas por prazo, prioridade por peso):

1. **Necessidade mensal** de cada meta = quanto falta ÷ meses até o prazo.
2. **Se o disponível cobre a soma das necessidades:** cobre todas no prazo e usa a
   sobra pra *acelerar* as de maior prioridade (peso).
3. **Se não cobre** (caso real de vocês hoje): rateia por **urgência × prioridade**
   (`peso × necessidade`), então metas mais apertadas e importantes recebem mais.
4. **Metas de longo prazo sem prazo** (ex.: Liberdade Financeira) usam horizonte de
   60 meses, pra não "roubar" recurso das metas com data marcada.
5. **Metas concluídas** (Viagem e Turbo da Bárbara) saem da distribuição.

### Pesos por prioridade
`alta = 3`, `média = 2`, `baixa = 1` — igual ao que a Bárbara já usava. Reserva de
Emergência e Casa entram como **alta**.

### Exemplo real (julho/2026)
- **Bárbara, R$ 2.897 disponíveis:** Casa R$ 1.711 · Reserva R$ 605 · Internacional
  R$ 475 · Rinoplastia R$ 106 (já está em 92%, por isso pouco).
- **Gabriel, R$ 718 disponíveis:** Casa R$ 405 · Viagem R$ 148 (vence em 1 mês) ·
  Reserva R$ 97 · Liberdade Financeira R$ 56 · Projeto Audi R$ 12.

> Perfis diferentes, respeitados: a Bárbara é orientada a **concluir metas** (Rinoplastia
> quase lá), o Gabriel tem foco em **carro + casa + patrimônio de longo prazo**. Os pesos
> e prazos são editáveis — a lógica se adapta sozinha quando vocês mudam um valor.

---

## 3. Premissas que assumi (confirmar depois)

Estas eu preenchi com o dado mais recente/detalhado; me corrijam quando puderem:

1. **Rendas** — usei as planilhas pessoais: Gabriel **R$ 3.750** (salário 2.000 + BG
   Tech 1.750) e Bárbara **R$ 5.350** líquido. Na planilha da Casa aparecem 3.000 e
   5.200. Ajustar em `profiles.monthly_income` se estiver diferente hoje.
2. **Caixinha Casa conjunta** — assumi meta **total de R$ 50.000** (25k cada). Já
   somam R$ 7.553 (15%).
3. **Liberdade Financeira (Gabriel)** — não tinha meta/valor na planilha; coloquei um
   alvo-placeholder de R$ 100.000 sem prazo. Ajustar pro número real de vocês.
4. **Categorias** — padronizei (Mercado, Transporte, Saúde, Assinaturas, Lazer…) em vez
   de uma linha por estabelecimento. A LLM da Fase 2 classifica automaticamente.
