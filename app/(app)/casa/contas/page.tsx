import { getContext } from "@/lib/profiles";
import { brl } from "@/lib/format";
import { addHouseCost, deleteHouseCost, toggleBillPaid } from "../../actions";
import CasaTabs from "../CasaTabs";

export const dynamic = "force-dynamic";

type Cost = {
  id: string;
  cost_type: string;
  name: string;
  expected_value: number | null;
  buy_when: string | null;
  barbara_pct: number | null;
  gabriel_pct: number | null;
};

export default async function Contas() {
  const { supabase, profiles } = await getContext();
  const casa = profiles.find((p) => p.type === "compartilhado");
  if (!casa) return <p className="text-muted">Perfil Casa não encontrado.</p>;

  const ym = new Date().toISOString().slice(0, 7);
  const mesNome = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const [{ data: costs }, { data: pays }] = await Promise.all([
    supabase.from("house_costs").select("*").eq("profile_id", casa.id),
    supabase.from("house_bill_payments").select("cost_id").eq("ym", ym),
  ]);

  const all = (costs ?? []) as Cost[];
  const paidSet = new Set((pays ?? []).map((r) => r.cost_id));
  const recorrentes = all.filter((c) => c.cost_type === "recorrente");
  const entrada = all.filter((c) => c.cost_type === "entrada");

  const totalMes = recorrentes.reduce((s, c) => s + Number(c.expected_value ?? 0), 0);
  const bTotal = recorrentes.reduce((s, c) => s + Number(c.expected_value ?? 0) * Number(c.barbara_pct ?? 0), 0);
  const gTotal = recorrentes.reduce((s, c) => s + Number(c.expected_value ?? 0) * Number(c.gabriel_pct ?? 0), 0);
  const totalEntrada = entrada.reduce((s, c) => s + Number(c.expected_value ?? 0), 0);
  const pagos = recorrentes.filter((c) => paidSet.has(c.id)).length;

  return (
    <div className="flex flex-col gap-4">
      <CasaTabs active="contas" />

      <details className="card">
        <summary className="font-semibold cursor-pointer">＋ Adicionar conta ou custo</summary>
        <form action={addHouseCost} className="flex flex-col gap-2 mt-3">
          <input type="hidden" name="profile_id" value={casa.id} />
          <input name="name" required className="input" placeholder="Nome do custo" />
          <div className="grid grid-cols-2 gap-2">
            <select name="cost_type" defaultValue="recorrente" className="input">
              <option value="recorrente">Conta recorrente</option><option value="entrada">Custo de entrada</option>
            </select>
            <input name="expected_value" required inputMode="decimal" className="input" placeholder="Valor previsto" />
            <input name="barbara_pct" type="number" min="0" max="100" step="0.01" defaultValue="63.41" className="input" aria-label="Percentual da Bárbara" />
            <input name="buy_when" className="input" placeholder="Quando comprar/pagar" />
          </div>
          <button className="btn">Adicionar custo</button>
        </form>
      </details>

      <div className="card">
        <p className="label">Custo mensal previsto</p>
        <p className="text-2xl font-bold">{brl(totalMes)}</p>
        <p className="text-xs text-muted mt-1">
          {pagos}/{recorrentes.length} contas pagas em {mesNome}
        </p>
        <div className="flex gap-4 mt-2 text-sm">
          <span>Bárbara: <strong>{brl(bTotal)}</strong></span>
          <span>Gabriel: <strong>{brl(gTotal)}</strong></span>
        </div>
      </div>

      <div className="card">
        <p className="label mb-2">Contas a pagar do mês</p>
        <div className="flex flex-col gap-2">
          {recorrentes.map((c) => {
            const paid = paidSet.has(c.id);
            return (
              <form
                key={c.id}
                action={toggleBillPaid}
                className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0"
              >
                <input type="hidden" name="cost_id" value={c.id} />
                <input type="hidden" name="profile_id" value={casa.id} />
                <input type="hidden" name="ym" value={ym} />
                <input type="hidden" name="is_paid" value={paid ? "1" : "0"} />
                <div>
                  <p className={`text-sm font-medium ${paid ? "line-through text-muted" : ""}`}>
                    {c.name}
                  </p>
                  <p className="text-xs text-muted">
                    B {brl(Number(c.expected_value) * Number(c.barbara_pct))} · G{" "}
                    {brl(Number(c.expected_value) * Number(c.gabriel_pct))}
                  </p>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-sm font-semibold">{brl(c.expected_value)}</span>
                  <button
                    className={
                      paid
                        ? "px-3 py-1.5 rounded-lg text-sm font-semibold bg-border text-muted"
                        : "btn text-sm"
                    }
                  >
                    {paid ? "Pago ✓" : "Pagar"}
                  </button>
                  <button formAction={deleteHouseCost} name="id" value={c.id} className="text-xs text-red-600" title="Excluir custo">×</button>
                </div>
              </form>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-2">
          <p className="label mb-0">Gastos de entrada (mudança)</p>
          <span className="text-sm font-semibold">{brl(totalEntrada)}</span>
        </div>
        <div className="flex flex-col gap-2">
          {entrada.map((c) => (
            <div key={c.id} className="flex justify-between text-sm gap-2">
              <div>
                <p>{c.name}</p>
                <p className="text-xs text-muted">{c.buy_when}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold whitespace-nowrap">{brl(c.expected_value)}</span>
                <form action={deleteHouseCost}><button name="id" value={c.id} className="text-red-600" title="Excluir custo">×</button></form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
