import { brl } from "@/lib/format";
import { buildForecast, type ForecastItem } from "@/lib/forecast";
import { getContext } from "@/lib/profiles";

export default async function ForecastPage() {
  const { supabase, active } = await getContext();
  if (!active) return null;
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const horizon = new Date(now.getFullYear(), now.getMonth() + 12, 0).toISOString().slice(0, 10);
  const [{ data: incomeSources }, { data: installments }, { data: recurring }] = await Promise.all([
    supabase.from("income_sources").select("amount").eq("profile_id", active.id).eq("active", true),
    supabase.from("transactions").select("occurred_at,amount,transaction_type").eq("profile_id", active.id).eq("status", "confirmed").gte("occurred_at", start).lte("occurred_at", horizon).gt("installment_count", 1),
    supabase.from("v_recurring_candidates").select("average_amount,expected_next_at,transaction_type").eq("profile_id", active.id),
  ]);
  const items: ForecastItem[] = [];
  const monthlyIncome = (incomeSources ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); items.push({ date: d.toISOString().slice(0, 10), income: monthlyIncome }); }
  for (const row of installments ?? []) items.push({ date: row.occurred_at, expense: ["expense", "card_payment"].includes(row.transaction_type) ? Number(row.amount) : 0, income: row.transaction_type === "income" ? Number(row.amount) : 0 });
  for (const row of recurring ?? []) if (row.expected_next_at) items.push({ date: row.expected_next_at, expense: row.transaction_type === "expense" ? Number(row.average_amount) : 0, income: row.transaction_type === "income" ? Number(row.average_amount) : 0 });
  const forecast = buildForecast(items, now, 12);
  return <div className="flex flex-col gap-4"><header><p className="eyebrow">Visão adiante</p><h1 className="page-title">Previsão de 12 meses</h1><p className="text-sm text-muted mt-1">Baseada em rendas ativas, parcelas e recorrências identificadas.</p></header><section className="card overflow-x-auto"><table className="forecast-table"><thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead><tbody>{forecast.map((row, index) => <tr key={row.key} className={index === 0 ? "current-row" : ""}><th>{row.label}</th><td className="text-success" data-money>{brl(row.income)}</td><td className="text-danger" data-money>{brl(row.expense)}</td><td className={row.balance < 0 ? "text-danger" : "text-success"} data-money>{brl(row.balance)}</td></tr>)}</tbody></table></section><p className="status-warning text-xs">Previsão é uma estimativa: lançamentos avulsos futuros ainda não cadastrados não entram no cálculo.</p></div>;
}
