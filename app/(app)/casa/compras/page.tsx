import { getContext } from "@/lib/profiles";
import { brl } from "@/lib/format";
import { markProductBought } from "../../actions";
import CasaTabs from "../CasaTabs";

export const dynamic = "force-dynamic";

const MONTHS = ["Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_NUM: Record<string, number> = {
  Junho: 6, Julho: 7, Agosto: 8, Setembro: 9, Outubro: 10, Novembro: 11, Dezembro: 12,
};

type Product = {
  id: string;
  name: string;
  category: string | null;
  ideal_qty: string | null;
  planned_month: string | null;
  buy_when: string | null;
  budget_base: number | null;
  real_value: number | null;
  status: string;
  _overdue?: boolean;
};

export default async function Compras() {
  const { supabase, profiles } = await getContext();
  const casa = profiles.find((p) => p.type === "compartilhado");
  if (!casa) return <p className="text-muted">Perfil Casa não encontrado.</p>;

  const { data } = await supabase
    .from("house_products")
    .select("*")
    .eq("profile_id", casa.id)
    .order("priority", { ascending: true, nullsFirst: false });

  const all = (data ?? []) as Product[];
  const comprados = all.filter((p) => p.status === "comprado" || p.status === "presente");
  const pendentes = all.filter((p) => p.status !== "comprado" && p.status !== "presente");

  const orcadoTotal = all.reduce((s, p) => s + Number(p.budget_base ?? 0), 0);
  const gastoTotal = all.reduce((s, p) => s + Number(p.real_value ?? 0), 0);

  // Rollover: item com mês já passado "cai" no mês atual, marcado como atrasado.
  const nowNum = new Date().getMonth() + 1;
  const comMes = pendentes
    .filter((p) => p.planned_month && MONTH_NUM[p.planned_month])
    .map((p) => {
      const itemNum = MONTH_NUM[p.planned_month as string];
      return { p, eff: Math.max(itemNum, nowNum), overdue: itemNum < nowNum };
    });
  const semMes = pendentes.filter((p) => !p.planned_month || !MONTH_NUM[p.planned_month]);

  return (
    <div className="flex flex-col gap-4">
      <CasaTabs active="compras" />

      <div className="grid grid-cols-3 gap-2">
        <div className="card"><p className="label">Orçado</p><p className="font-bold">{brl(orcadoTotal)}</p></div>
        <div className="card"><p className="label">Comprado</p><p className="font-bold">{brl(gastoTotal)}</p></div>
        <div className="card"><p className="label">Faltam</p><p className="font-bold">{pendentes.length}</p></div>
      </div>

      {MONTHS.filter((m) => MONTH_NUM[m] >= nowNum).map((m) => {
        const items = comMes
          .filter((x) => x.eff === MONTH_NUM[m])
          .map((x) => ({ ...x.p, _overdue: x.overdue }));
        if (!items.length) return null;
        const isCurrent = MONTH_NUM[m] === nowNum;
        return <MonthGroup key={m} title={isCurrent ? `${m} · este mês` : m} items={items} />;
      })}
      {semMes.length > 0 && (
        <MonthGroup title="Depende do imóvel / mais pra frente" items={semMes} />
      )}

      {comprados.length > 0 && (
        <div className="card">
          <p className="label mb-2">Já comprados / presentes 🎉</p>
          <div className="flex flex-col gap-1">
            {comprados.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span>{p.name}</span>
                <span className="text-muted">
                  {p.status === "presente" ? "Presente" : brl(p.real_value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MonthGroup({ title, items }: { title: string; items: Product[] }) {
  return (
    <div className="card">
      <p className="label mb-2">{title}</p>
      <div className="flex flex-col gap-3">
        {items.map((p) => (
          <div key={p.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-medium text-sm">
                  {p.name}
                  {p._overdue && (
                    <span className="ml-2 text-xs font-semibold text-amber-600">
                      ↪ atrasado
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {p.category}
                  {p.ideal_qty ? ` · ${p.ideal_qty}` : ""}
                </p>
              </div>
              <span className="text-xs text-muted whitespace-nowrap">
                {p.budget_base ? brl(p.budget_base) : p.buy_when}
              </span>
            </div>
            <form action={markProductBought} className="flex gap-2 mt-2">
              <input type="hidden" name="product_id" value={p.id} />
              <input
                name="real_value"
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder={p.budget_base ? `Paguei (orçado ${brl(p.budget_base)})` : "Quanto paguei"}
                inputMode="decimal"
              />
              <button className="btn whitespace-nowrap">Comprei</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
