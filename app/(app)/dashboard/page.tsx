import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { brl, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const bucketLabels: Record<string, string> = {
  essencial: "Essenciais",
  lazer: "Lazer",
  moradia: "Moradia",
  investimento: "Investimento",
  obrigatoria: "Obrigatórias",
  nao_obrig: "Não obrigatórias",
  outros: "Outros",
};

export default async function Dashboard() {
  const { supabase, active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil encontrado.</p>;

  const isCasa = active.type === "compartilhado";

  const [{ data: incomes }, { data: spending }, { data: goals }] =
    await Promise.all([
      supabase.from("income_sources").select("amount").eq("profile_id", active.id).eq("active", true),
      supabase.from("v_bucket_spending_current").select("bucket,total").eq("profile_id", active.id),
      supabase.from("v_goal_progress").select("*").eq("profile_id", active.id).order("weight", { ascending: false }),
    ]);

  const income = (incomes ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const spent = (spending ?? []).reduce((s, r) => s + Number(r.total), 0);
  const activeGoals = (goals ?? []).filter((g) => g.status !== "concluida");
  const totalSaved = activeGoals.reduce((s, g) => s + Number(g.current_amount), 0);

  // Extras da Casa
  let joint: { meta_total: number; atual_total: number; progresso: number } | null = null;
  let houseMonthly = 0;
  let enxoval = { comprado: 0, orcado: 0 };
  if (isCasa) {
    const [{ data: j }, { data: costs }, { data: products }] = await Promise.all([
      supabase.from("v_joint_goals").select("*").eq("joint_group", "casa_futura").maybeSingle(),
      supabase.from("house_costs").select("expected_value").eq("cost_type", "recorrente"),
      supabase.from("house_products").select("real_value,budget_base"),
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

      {/* Renda / gasto */}
      <div className="grid grid-cols-2 gap-3">
        {!isCasa && (
          <Link href="/renda" className="card">
            <p className="label">Renda mensal ✏️</p>
            <p className="text-xl font-bold">{brl(income)}</p>
          </Link>
        )}
        <div className="card">
          <p className="label">Gastos do mês</p>
          <p className="text-xl font-bold">{brl(spent)}</p>
          {income > 0 && (
            <p className="text-xs text-muted mt-1">
              {pct(spent / income)} da renda
            </p>
          )}
        </div>
      </div>

      {/* Gastos por categoria */}
      {(spending ?? []).length > 0 ? (
        <div className="card">
          <p className="label mb-2">Onde foi o dinheiro este mês</p>
          <div className="flex flex-col gap-2">
            {(spending ?? [])
              .sort((a, b) => Number(b.total) - Number(a.total))
              .map((r) => (
                <div key={r.bucket} className="flex justify-between text-sm">
                  <span>{bucketLabels[r.bucket] ?? r.bucket}</span>
                  <span className="font-semibold">{brl(r.total)}</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="card text-sm text-muted">
          Nenhum gasto lançado neste mês ainda. Use o botão{" "}
          <span className="font-semibold">Lançar</span> pra registrar o primeiro. 🐷
        </div>
      )}

      {/* Casa: investimento conjunto + custos */}
      {isCasa && joint && (
        <div className="card">
          <p className="label">Meta conjunta da Casa 🏡</p>
          <div className="flex justify-between items-end mb-2">
            <p className="text-xl font-bold">{brl(joint.atual_total)}</p>
            <p className="text-sm text-muted">de {brl(joint.meta_total)}</p>
          </div>
          <div className="bar">
            <span style={{ width: `${Math.min(joint.progresso * 100, 100)}%`, background: "var(--color-brand)" }} />
          </div>
          <p className="text-xs text-muted mt-1">{pct(joint.progresso)} concluído</p>
        </div>
      )}

      {isCasa && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="label">Custo mensal previsto</p>
            <p className="text-xl font-bold">{brl(houseMonthly)}</p>
            <p className="text-xs text-muted mt-1">aluguel, contas e mercado</p>
          </div>
          <div className="card">
            <p className="label">Enxoval comprado</p>
            <p className="text-xl font-bold">{brl(enxoval.comprado)}</p>
            <p className="text-xs text-muted mt-1">de {brl(enxoval.orcado)} orçado</p>
          </div>
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
                <span className="text-muted">
                  {brl(g.current_amount)} / {brl(g.target_amount)}
                </span>
              </div>
              <div className="bar">
                <span
                  style={{
                    width: `${Math.min(Number(g.progresso) * 100, 100)}%`,
                    background: active.color ?? "var(--color-brand)",
                  }}
                />
              </div>
            </div>
          ))}
          {activeGoals.length === 0 && (
            <p className="text-sm text-muted">Sem caixinhas ativas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
