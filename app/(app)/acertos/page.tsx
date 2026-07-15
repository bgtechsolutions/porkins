import Link from "next/link";
import { brl } from "@/lib/format";
import { getContext } from "@/lib/profiles";
import { markTransactionSplitPaid } from "../actions";

export const dynamic = "force-dynamic";

type Obligation = {
  split_id: string;
  transaction_id: string;
  shared_profile_id: string;
  shared_profile_name: string;
  source_profile_name: string;
  description: string;
  occurred_at: string;
  installment_number: number;
  installment_count: number;
  amount: number;
  status: "pending" | "paid" | "waived";
  payer_user_id: string;
  payer_name: string;
  debtor_user_id: string;
  debtor_name: string;
  direction: "owe" | "receive";
};

export default async function Acertos({
  searchParams,
}: {
  searchParams: Promise<{ historico?: string }>;
}) {
  const { supabase } = await getContext();
  const { historico } = await searchParams;
  const { data, error } = await supabase.rpc("fn_profile_obligations");
  const all = (data ?? []) as Obligation[];
  const rows = historico ? all : all.filter((item) => item.status === "pending");
  const pending = all.filter((item) => item.status === "pending");
  const owe = pending.filter((item) => item.direction === "owe").reduce((sum, item) => sum + Number(item.amount), 0);
  const receive = pending.filter((item) => item.direction === "receive").reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted">Compras compartilhadas</p>
        <h2 className="text-xl font-bold">Acertos entre pessoas</h2>
        <p className="text-sm text-muted mt-1">O gasto fica na conta de quem pagou; aqui aparece somente a parte de cada participante.</p>
      </div>

      {error && <div className="status-danger" role="alert">Não foi possível carregar os acertos: {error.message}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="label">Você deve</p>
          <p className="text-xl font-bold text-warning">{brl(owe)}</p>
        </div>
        <div className="card">
          <p className="label">Devem para você</p>
          <p className="text-xl font-bold text-success">{brl(receive)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link href="/acertos" className={`filter-chip ${!historico ? "filter-chip-active" : ""}`}>Pendentes</Link>
        <Link href="/acertos?historico=1" className={`filter-chip ${historico ? "filter-chip-active" : ""}`}>Histórico</Link>
      </div>

      {!rows.length ? (
        <div className="card text-sm text-muted">
          {historico ? "Nenhum acerto registrado." : "Você não tem acertos pendentes."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((item) => (
            <article key={item.split_id} className="card">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex gap-2 items-center mb-1">
                    <span className={item.direction === "owe" ? "badge-transfer" : "badge-income"}>
                      {item.direction === "owe" ? "Você deve" : "A receber"}
                    </span>
                    {item.status !== "pending" && <span className="badge-neutral">{item.status === "paid" ? "Pago" : "Dispensado"}</span>}
                  </div>
                  <p className="font-semibold text-sm truncate">{item.description}</p>
                  <p className="text-xs text-muted">
                    {item.shared_profile_name} · {item.direction === "owe" ? `pago por ${item.payer_name}` : `${item.debtor_name} participa`}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(`${item.occurred_at}T00:00:00`).toLocaleDateString("pt-BR")}
                    {item.installment_count > 1 ? ` · parcela ${item.installment_number}/${item.installment_count}` : ""}
                  </p>
                </div>
                <p className={`font-bold whitespace-nowrap ${item.direction === "owe" ? "text-warning" : "text-success"}`}>{brl(item.amount)}</p>
              </div>
              {item.status === "pending" && (
                <form action={markTransactionSplitPaid} className="mt-3 pt-3 border-t border-border">
                  <input type="hidden" name="id" value={item.split_id} />
                  <input type="hidden" name="status" value="paid" />
                  <button className="btn-secondary w-full">Marcar como acertado</button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
