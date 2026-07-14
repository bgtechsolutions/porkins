import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { brl } from "@/lib/format";
import { updateTransaction, deleteTransaction, markTransactionSplitPaid } from "../actions";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const TYPES = ["expense", "income", "transfer_out", "transfer_in", "card_payment"] as const;
type TransactionType = (typeof TYPES)[number];
type Member = { user_id: string; display_name: string; email: string; role: string };
type Txn = {
  id: string;
  amount: number;
  description: string | null;
  occurred_at: string;
  category_id: string | null;
  needs_review: boolean;
  transaction_type: TransactionType;
  counterparty: string | null;
  account_label: string | null;
  paid_by_user_id: string | null;
  categoria: { name: string } | { name: string }[] | null;
  conta: { name: string } | { name: string }[] | null;
  divisoes: { id: string; debtor_user_id: string; amount: number; status: string }[] | null;
};

const TYPE_UI: Record<TransactionType, { label: string; sign: string; color: string; badge: string }> = {
  expense: { label: "Gasto", sign: "−", color: "text-red-600", badge: "bg-red-50 text-red-700" },
  income: { label: "Entrada", sign: "+", color: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700" },
  transfer_in: { label: "Recebido", sign: "+", color: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700" },
  transfer_out: { label: "Enviado", sign: "−", color: "text-amber-600", badge: "bg-amber-50 text-amber-700" },
  card_payment: { label: "Fatura", sign: "", color: "text-slate-700", badge: "bg-slate-100 text-slate-700" },
};

export default async function Extrato({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tudo?: string; importados?: string; tipo?: string }>;
}) {
  const { supabase, active, userId } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;

  const { mes: mesParam, tudo, importados, tipo = "todos" } = await searchParams;
  const now = new Date();
  const mes = tudo ? "" : mesParam || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  let query = supabase
    .from("transactions")
    .select("id,amount,description,occurred_at,category_id,needs_review,transaction_type,counterparty,account_label,paid_by_user_id,categoria:categories(name),conta:accounts(name),divisoes:transaction_splits(id,debtor_user_id,amount,status)")
    .eq("profile_id", active.id)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (mes) {
    const [y, m] = mes.split("-").map(Number);
    const from = `${y}-${pad(m)}-01`;
    const to = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
    query = query.gte("occurred_at", from).lt("occurred_at", to);
  }
  if (tipo === "entradas") query = query.in("transaction_type", ["income", "transfer_in"]);
  if (tipo === "gastos") query = query.eq("transaction_type", "expense");
  if (tipo === "movimentacoes") query = query.in("transaction_type", ["transfer_out", "card_payment"]);
  if (tipo === "revisar") query = query.eq("needs_review", true);

  const [{ data: txns }, { data: categories }, { data: members }] = await Promise.all([
    query,
    supabase.from("categories").select("id,name,is_income").order("name"),
    supabase.rpc("fn_profile_member_directory", { p_profile_id: active.id }),
  ]);
  const rows = (txns ?? []) as Txn[];
  const directory = (members ?? []) as Member[];
  const sum = (types: TransactionType[]) => rows
    .filter((item) => types.includes(item.transaction_type))
    .reduce((total, item) => total + Number(item.amount), 0);
  const entries = sum(["income", "transfer_in"]);
  const expenses = sum(["expense"]);
  const movements = sum(["transfer_out", "card_payment"]);
  const relationName = (value: { name: string } | { name: string }[] | null) =>
    (Array.isArray(value) ? value[0]?.name : value?.name) ?? null;
  const filterHref = (nextType: string) => {
    const params = new URLSearchParams();
    if (tudo) params.set("tudo", "1");
    else if (mes) params.set("mes", mes);
    if (nextType !== "todos") params.set("tipo", nextType);
    return `/extrato${params.size ? `?${params}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted">{active.name}</p>
        <h2 className="text-xl font-bold">Extrato</h2>
      </div>

      {importados && <div className="card text-sm text-green-700" role="status">{importados} lançamento(s) importado(s).</div>}

      <form method="get" className="card flex gap-2 items-end">
        <label className="flex-1">
          <span className="label">Período</span>
          <input type="month" name="mes" defaultValue={mes} className="input" />
        </label>
        {tipo !== "todos" && <input type="hidden" name="tipo" value={tipo} />}
        <button type="submit" className="btn">Aplicar</button>
      </form>

      <div className="grid grid-cols-3 gap-2">
        <Summary label="Entradas" value={entries} className="text-emerald-600" />
        <Summary label="Gastos" value={expenses} className="text-red-600" />
        <Summary label="Movimentações" value={movements} className="text-slate-700" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          ["todos", "Todos"], ["entradas", "Entradas"], ["gastos", "Gastos"],
          ["movimentacoes", "Transferências"], ["revisar", "Revisar"],
        ].map(([value, label]) => (
          <Link key={value} href={filterHref(value)} className={`px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap border ${tipo === value ? "bg-brand text-white border-brand" : "bg-white border-border text-muted"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="flex justify-between text-xs">
        <div className="flex gap-3">
          <Link href="/extrato" className="text-brand font-semibold">Mês atual</Link>
          <Link href="/extrato?tudo=1" className="text-muted">Histórico completo</Link>
        </div>
        <Link href="/importar" className="text-brand font-semibold">Importar CSV</Link>
      </div>

      {rows.length === 0 ? (
        <div className="card text-sm text-muted">Nenhum lançamento neste filtro.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((transaction) => {
            const ui = TYPE_UI[transaction.transaction_type] ?? TYPE_UI.expense;
            const category = relationName(transaction.categoria);
            const account = relationName(transaction.conta) ?? transaction.account_label;
            const split = transaction.divisoes?.[0] ?? null;
            const debtor = directory.find((member) => member.user_id === split?.debtor_user_id);
            return (
              <details key={transaction.id} className="card">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ui.badge}`}>{ui.label}</span>
                      {transaction.needs_review && <span className="text-[10px] text-amber-700 font-bold">⚠ revisar</span>}
                    </div>
                    <p className="text-sm font-semibold truncate">{transaction.description || category || "Sem descrição"}</p>
                    <p className="text-xs text-muted truncate">
                      {new Date(`${transaction.occurred_at}T00:00:00`).toLocaleDateString("pt-BR")}
                      {account ? ` · ${account}` : ""}{category ? ` · ${category}` : ""}
                    </p>
                    {split && (
                      <p className={`text-xs font-semibold mt-1 ${split.status === "paid" ? "text-emerald-600" : "text-violet-700"}`}>
                        {debtor?.display_name ?? "Outro membro"} {split.status === "paid" ? "pagou" : "deve"} {brl(split.amount)}
                      </p>
                    )}
                  </div>
                  <span className={`font-bold whitespace-nowrap ${ui.color}`}>{ui.sign}{brl(transaction.amount)}</span>
                </summary>

                <form action={updateTransaction} className="flex flex-col gap-2 mt-3 pt-3 border-t border-border">
                  <input type="hidden" name="id" value={transaction.id} />
                  <select name="transaction_type" defaultValue={transaction.transaction_type} className="input">
                    {TYPES.map((value) => <option key={value} value={value}>{TYPE_UI[value].label}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input name="amount" type="text" inputMode="decimal" defaultValue={Number(transaction.amount)} className="input" placeholder="Valor" />
                    <input name="occurred_at" type="date" defaultValue={transaction.occurred_at} className="input" />
                  </div>
                  <input name="description" type="text" defaultValue={transaction.description ?? ""} className="input" placeholder="Descrição" />
                  <select name="category_id" defaultValue={transaction.category_id ?? ""} className="input">
                    <option value="">Sem categoria</option>
                    {(categories ?? []).map((categoryItem) => <option key={categoryItem.id} value={categoryItem.id}>{categoryItem.name}</option>)}
                  </select>
                  {directory.some((member) => member.user_id !== (transaction.paid_by_user_id ?? userId)) && (
                    <div className="grid grid-cols-2 gap-2">
                      <select name="debtor_user_id" defaultValue={split?.debtor_user_id ?? ""} className="input">
                        <option value="">Não dividir</option>
                        {directory.filter((member) => member.user_id !== (transaction.paid_by_user_id ?? userId)).map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
                      </select>
                      <input name="split_amount" type="text" inputMode="decimal" defaultValue={split ? Number(split.amount) : ""} className="input" placeholder="Parte da pessoa" />
                    </div>
                  )}
                  <button className="btn">Salvar alterações</button>
                </form>
                {split && (
                  <form action={markTransactionSplitPaid} className="mt-2">
                    <input type="hidden" name="id" value={split.id} />
                    <input type="hidden" name="status" value={split.status === "paid" ? "pending" : "paid"} />
                    <button className="w-full py-2 rounded-lg text-sm font-semibold text-violet-700 border border-violet-200">
                      {split.status === "paid" ? "Marcar acerto como pendente" : "Marcar como pago"}
                    </button>
                  </form>
                )}
                <form action={deleteTransaction} className="mt-2">
                  <input type="hidden" name="id" value={transaction.id} />
                  <button className="w-full py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200">Excluir lançamento</button>
                </form>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Summary({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="card !p-3 min-w-0">
      <p className="text-[10px] text-muted truncate">{label}</p>
      <p className={`text-xs font-bold truncate ${className}`}>{brl(value)}</p>
    </div>
  );
}
