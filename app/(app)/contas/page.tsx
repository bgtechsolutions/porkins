import { getContext } from "@/lib/profiles";
import { brl } from "@/lib/format";
import { updateAccountFinancialSettings } from "../actions";

export const dynamic = "force-dynamic";

type Account = {
  id: string;
  name: string;
  kind: "conta" | "debito" | "credito" | "dinheiro";
  institution: string | null;
  current_balance: number | null;
  balance_updated_at: string | null;
  credit_limit: number | null;
  statement_closing_day: number | null;
  due_day: number | null;
};

type Flow = {
  account_id: string | null;
  income: number;
  expenses: number;
  transfers_in: number;
  transfers_out: number;
  card_payments: number;
  net_cash_flow: number;
};

export default async function Contas() {
  const { supabase, active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [{ data: accounts }, { data: flows }, { data: future }] = await Promise.all([
    supabase.from("accounts")
      .select("id,name,kind,institution,current_balance,balance_updated_at,credit_limit,statement_closing_day,due_day")
      .eq("profile_id", active.id).eq("active", true).order("name"),
    supabase.from("v_account_monthly_flow").select("*").eq("profile_id", active.id).eq("month", month),
    supabase.from("transactions").select("account_id,amount")
      .eq("profile_id", active.id).eq("transaction_type", "expense")
      .eq("status", "confirmed").gt("occurred_at", now.toISOString().slice(0, 10)),
  ]);
  const flowMap = new Map(((flows ?? []) as Flow[]).map((item) => [item.account_id, item]));
  const futureMap = new Map<string, number>();
  for (const item of future ?? []) {
    if (item.account_id) futureMap.set(item.account_id, (futureMap.get(item.account_id) ?? 0) + Number(item.amount));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted">{active.name}</p>
        <h2 className="text-xl font-bold">Contas e cartões</h2>
        <p className="text-sm text-muted mt-1">Saldos informados, fluxo do mês e compromissos já conhecidos.</p>
      </div>

      {((accounts ?? []) as Account[]).map((account) => {
        const flow = flowMap.get(account.id);
        const futureAmount = futureMap.get(account.id) ?? 0;
        const availableLimit = account.kind === "credito" && account.credit_limit != null
          ? Math.max(Number(account.credit_limit) - futureAmount, 0) : null;
        return (
          <details key={account.id} className="card" open={account.kind === "credito"}>
            <summary className="list-none cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{account.name}</p>
                  <p className="text-xs text-muted">{account.institution ?? "Instituição não informada"} · {kindLabel(account.kind)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">{account.kind === "credito" ? "Comprometido" : "Saldo informado"}</p>
                  <p className="font-bold">{brl(account.kind === "credito" ? futureAmount : account.current_balance)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <Metric label="Entrou" value={Number(flow?.income ?? 0) + Number(flow?.transfers_in ?? 0)} tone="text-success" />
                <Metric label="Saiu" value={Number(flow?.expenses ?? 0) + Number(flow?.transfers_out ?? 0) + Number(flow?.card_payments ?? 0)} tone="text-danger" />
                <Metric label="Fluxo" value={Number(flow?.net_cash_flow ?? 0)} tone={Number(flow?.net_cash_flow ?? 0) >= 0 ? "text-success" : "text-danger"} />
              </div>
              {availableLimit != null && <p className="text-xs text-muted mt-2">Limite disponível estimado: <strong className="text-foreground">{brl(availableLimit)}</strong></p>}
            </summary>

            <form action={updateAccountFinancialSettings} className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
              <input type="hidden" name="id" value={account.id} />
              {account.kind !== "credito" && (
                <label><span className="label">Saldo atual informado</span><input name="current_balance" className="input" inputMode="decimal" defaultValue={account.current_balance ?? ""} placeholder="0,00" /></label>
              )}
              {account.kind === "credito" && (
                <>
                  <label><span className="label">Limite total</span><input name="credit_limit" className="input" inputMode="decimal" defaultValue={account.credit_limit ?? ""} placeholder="0,00" /></label>
                  <div className="grid grid-cols-2 gap-2">
                    <label><span className="label">Fecha dia</span><input name="statement_closing_day" type="number" min="1" max="31" className="input" defaultValue={account.statement_closing_day ?? ""} /></label>
                    <label><span className="label">Vence dia</span><input name="due_day" type="number" min="1" max="31" className="input" defaultValue={account.due_day ?? ""} /></label>
                  </div>
                </>
              )}
              <button className="btn">Salvar dados da conta</button>
            </form>
          </details>
        );
      })}
    </div>
  );
}

function kindLabel(kind: Account["kind"]) {
  return ({ conta: "Conta corrente", debito: "Débito", credito: "Crédito", dinheiro: "Dinheiro" })[kind];
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-xl bg-surface-muted p-2 min-w-0"><p className="text-xs text-muted">{label}</p><p className={`text-sm font-bold truncate ${tone}`}>{brl(value)}</p></div>;
}
