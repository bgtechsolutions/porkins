import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/profiles";
import { brl, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

type ObligationSummary = { status: string; direction: "owe" | "receive"; amount: number };

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>;
}) {
  const { supabase, active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil encontrado.</p>;
  if (active.context_type === "business") redirect("/empresa");
  const params = await searchParams;

  const isPersonal = active.context_type === "personal";
  const isCasa = active.context_type === "household";
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [{ data: incomes }, { data: spending }, { data: goals }, { data: obligations }, { data: recurring }, { data: accountFlow }] = await Promise.all([
    supabase.from("income_sources").select("amount").eq("profile_id", active.id).eq("active", true),
    supabase.from("v_bucket_spending_current").select("bucket,total").eq("profile_id", active.id),
    supabase.from("v_goal_progress").select("*").eq("profile_id", active.id).order("weight", { ascending: false }),
    supabase.rpc("fn_profile_obligations"),
    supabase.from("v_recurring_candidates").select("recurrence_key").eq("profile_id", active.id).limit(30),
    supabase.from("v_account_monthly_flow").select("income,expenses,transfers_in,transfers_out,card_payments").eq("profile_id", active.id).eq("month", firstOfMonth),
  ]);

  const income = (incomes ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const spent = (spending ?? []).reduce((s, r) => s + Number(r.total), 0);
  const bucketTotal = (b: string) => Number((spending ?? []).find((r) => r.bucket === b)?.total ?? 0);
  const activeGoals = (goals ?? []).filter((g) => g.status !== "concluida");
  const totalSaved = activeGoals.reduce((s, g) => s + Number(g.current_amount), 0);
  const pendingObligations = ((obligations ?? []) as ObligationSummary[]).filter((item) => item.status === "pending");
  const amountOwed = pendingObligations.filter((item) => item.direction === "owe").reduce((sum, item) => sum + Number(item.amount), 0);
  const amountReceivable = pendingObligations.filter((item) => item.direction === "receive").reduce((sum, item) => sum + Number(item.amount), 0);
  const bankIncome = (accountFlow ?? []).reduce((sum, item) => sum + Number(item.income), 0);
  const pixReceived = (accountFlow ?? []).reduce((sum, item) => sum + Number(item.transfers_in), 0);
  const bankExpenses = (accountFlow ?? []).reduce((sum, item) => sum + Number(item.expenses), 0);

  // ---- Extras dos perfis pessoais: regra 60/30/10 + ranking ----
  let rules: { bucket: string; percentage: number }[] = [];
  let investMonth = 0;
  let ranking: { name: string; total: number }[] = [];
  if (isPersonal) {
    const [{ data: r }, { data: contribs }, { data: txns }] = await Promise.all([
      supabase.from("allocation_rules").select("bucket,percentage").eq("profile_id", active.id),
      supabase.from("contributions").select("amount").eq("profile_id", active.id).gte("contributed_at", firstOfMonth),
      supabase.from("transactions").select("amount, categoria:categories(name)").eq("profile_id", active.id).eq("transaction_type", "expense").gte("occurred_at", firstOfMonth),
    ]);
    rules = (r ?? []) as { bucket: string; percentage: number }[];
    investMonth = (contribs ?? []).reduce((s, c) => s + Number(c.amount), 0);
    const map = new Map<string, number>();
    for (const t of (txns ?? []) as { amount: number; categoria: { name: string } | { name: string }[] | null }[]) {
      const cat = Array.isArray(t.categoria) ? t.categoria[0]?.name : t.categoria?.name;
      const name = cat ?? "Sem categoria";
      if (name === "Combustível" || name === "Gasolina") continue;
      map.set(name, (map.get(name) ?? 0) + Number(t.amount));
    }
    ranking = [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }
  const ruleOf = (b: string) => Number(rules.find((r) => r.bucket === b)?.percentage ?? 0);

  // ---- Extras da Casa ----
  let joint: { meta_total: number; atual_total: number; progresso: number } | null = null;
  let houseMonthly = 0;
  let enxoval = { comprado: 0, orcado: 0 };
  if (isCasa) {
    const [{ data: j }, { data: costs }, { data: products }] = await Promise.all([
      supabase.from("v_joint_goals").select("*").eq("joint_group", "casa_futura").maybeSingle(),
      supabase.from("house_costs").select("expected_value").eq("profile_id", active.id).eq("cost_type", "recorrente"),
      supabase.from("house_products").select("real_value,budget_base").eq("profile_id", active.id),
    ]);
    if (j) joint = { meta_total: Number(j.meta_total), atual_total: Number(j.atual_total), progresso: Number(j.progresso) };
    houseMonthly = (costs ?? []).reduce((s, r) => s + Number(r.expected_value ?? 0), 0);
    enxoval = {
      comprado: (products ?? []).reduce((s, r) => s + Number(r.real_value ?? 0), 0),
      orcado: (products ?? []).reduce((s, r) => s + Number(r.budget_base ?? 0), 0),
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Olá! Resumo — {active.name}</h2>

      {params.convite === "accepted" && <div className="status-success" role="status">Convite aceito. O novo espaço já está disponível.</div>}
      {params.convite === "declined" && <div className="status-success" role="status">Convite recusado.</div>}

      <div className="grid grid-cols-2 gap-3">
        {isPersonal && (
          <Link href="/renda" className="card">
            <p className="label">Renda mensal ✏️</p>
            <p className="text-xl font-bold">{brl(income)}</p>
          </Link>
        )}
        <Link href="/extrato" className="card">
          <p className="label">Gastos do mês 📋</p>
          <p className="text-xl font-bold">{brl(spent)}</p>
          {income > 0 && <p className="text-xs text-muted mt-1">{pct(spent / income)} da renda</p>}
        </Link>
      </div>

      <Link href="/acertos" className="card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label">Acertos compartilhados</p>
            <p className="text-sm"><strong className="text-warning">Você deve {brl(amountOwed)}</strong></p>
            <p className="text-sm"><strong className="text-success">Devem para você {brl(amountReceivable)}</strong></p>
          </div>
          <span className="text-brand font-bold" aria-hidden="true">→</span>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/contas" className="card">
          <p className="label">Contas e cartões</p>
          <p className="text-lg font-bold">{brl(bankIncome - bankExpenses)}</p>
          <p className="text-xs text-muted mt-1">resultado bancário · Pix recebidos {brl(pixReceived)}</p>
        </Link>
        <Link href="/recorrencias" className="card">
          <p className="label">Recorrências</p>
          <p className="text-lg font-bold">{(recurring ?? []).length}</p>
          <p className="text-xs text-muted mt-1">padrões e parcelas futuras →</p>
        </Link>
      </div>

      {/* Regra 60/30/10 */}
      {isPersonal && income > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="label mb-0">Regra dos tetos</p>
            <Link href="/perfil" className="text-xs text-brand font-semibold">
              {active.profile_type ?? "razoavel"} · ajustar ⚙️
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <RuleRow label="Despesas obrigatórias" atual={bucketTotal("obrigatoria")} limite={income * ruleOf("obrigatoria")} teto />
            <RuleRow label="Despesas não obrigatórias" atual={bucketTotal("nao_obrig")} limite={income * ruleOf("nao_obrig")} teto />
            <RuleRow label="Investimentos" atual={investMonth} limite={income * ruleOf("investimento")} />
          </div>
          <p className="text-xs text-muted mt-3 leading-relaxed">
            Despesas são <strong>teto</strong> (ideal ficar abaixo). Investir é <strong>mínimo</strong> — passar é ótimo. 💚
          </p>
        </div>
      )}

      {/* Ranking de categorias */}
      {isPersonal && ranking.length > 0 && (
        <div className="card">
          <p className="label mb-2">Onde você mais gastou este mês</p>
          <div className="flex flex-col gap-2">
            {ranking.slice(0, 5).map((c, i) => (
              <div
                key={c.name}
                className="flex justify-between items-center text-sm"
                style={i === 0 ? { fontWeight: 700 } : undefined}
              >
                <span>
                  {i === 0 && (
                    <span className="mr-2 text-xs px-2 py-0.5 rounded-full bg-brand-solid text-brand-foreground">
                      TOP 1
                    </span>
                  )}
                  {c.name}
                </span>
                <span>{brl(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state de gastos */}
      {(spending ?? []).length === 0 && (
        <div className="card text-sm text-muted">
          Nenhum gasto lançado neste mês ainda. Use o botão <span className="font-semibold">Lançar</span> pra registrar o primeiro. 🐷
        </div>
      )}

      {/* Casa */}
      {isCasa && joint && (
        <div className="card">
          <p className="label">Meta conjunta da Casa 🏡</p>
          <div className="flex justify-between items-end mb-2">
            <p className="text-xl font-bold">{brl(joint.atual_total)}</p>
            <p className="text-sm text-muted">de {brl(joint.meta_total)}</p>
          </div>
          <div className="bar">
            <span style={{ width: `${Math.min(joint.progresso * 100, 100)}%`, background: "var(--brand-solid)" }} />
          </div>
          <p className="text-xs text-muted mt-1">{pct(joint.progresso)} concluído</p>
        </div>
      )}

      {isCasa && (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/casa/contas" className="card">
            <p className="label">Custo mensal previsto</p>
            <p className="text-xl font-bold">{brl(houseMonthly)}</p>
            <p className="text-xs text-muted mt-1">ver contas do mês →</p>
          </Link>
          <Link href="/casa/compras" className="card">
            <p className="label">Enxoval comprado</p>
            <p className="text-xl font-bold">{brl(enxoval.comprado)}</p>
            <p className="text-xs text-muted mt-1">de {brl(enxoval.orcado)} · ver compras →</p>
          </Link>
        </div>
      )}

      {/* Caixinhas */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <p className="label mb-0">Caixinhas</p>
          <p className="text-sm font-semibold">{brl(totalSaved)}</p>
        </div>
        <div className="flex flex-col gap-3">
          {activeGoals.map((g) => (
            <div key={g.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{g.name}</span>
                <span className="text-muted">{brl(g.current_amount)} / {brl(g.target_amount)}</span>
              </div>
              <div className="bar">
                <span style={{ width: `${Math.min(Number(g.progresso) * 100, 100)}%`, background: active.color ?? "var(--brand-solid)" }} />
              </div>
            </div>
          ))}
          {activeGoals.length === 0 && <p className="text-sm text-muted">Sem caixinhas ativas.</p>}
        </div>
      </div>
    </div>
  );
}

function RuleRow({ label, atual, limite, teto }: { label: string; atual: number; limite: number; teto?: boolean }) {
  const ratio = limite > 0 ? atual / limite : 0;
  const over = teto ? atual > limite : false;
  const hitGoal = !teto && atual >= limite && limite > 0;
  const color = over ? "var(--danger)" : hitGoal ? "var(--success)" : "var(--brand)";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">
          {label}
          {over && <span className="ml-1 text-xs text-danger font-semibold">passou do teto!</span>}
          {hitGoal && <span className="ml-1 text-xs text-success font-semibold">meta batida 👏</span>}
        </span>
        <span className="text-muted">{brl(atual)} / {brl(limite)}</span>
      </div>
      <div className="bar">
        <span style={{ width: `${Math.min(ratio * 100, 100)}%`, background: color }} />
      </div>
    </div>
  );
}
