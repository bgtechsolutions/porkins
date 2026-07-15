import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { brl } from "@/lib/format";

export const dynamic = "force-dynamic";

type Recurrence = {
  recurrence_key: string;
  label: string;
  transaction_type: string;
  occurrences: number;
  average_amount: number;
  amount_deviation: number;
  last_occurred_at: string;
  average_interval_days: number | null;
  expected_next_at: string | null;
  frequency: string;
  confidence: string;
};

type Installment = {
  id: string;
  description: string | null;
  amount: number;
  occurred_at: string;
  installment_number: number;
  installment_count: number;
  conta: { name: string } | { name: string }[] | null;
};

export default async function Recorrencias() {
  const { supabase, active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: recurring }, { data: installments }] = await Promise.all([
    supabase.from("v_recurring_candidates").select("*")
      .eq("profile_id", active.id).order("occurrences", { ascending: false }).limit(30),
    supabase.from("transactions")
      .select("id,description,amount,occurred_at,installment_number,installment_count,conta:accounts(name)")
      .eq("profile_id", active.id).eq("status", "confirmed")
      .gt("installment_count", 1).gte("occurred_at", today)
      .order("occurred_at").limit(40),
  ]);
  const recurrences = (recurring ?? []) as Recurrence[];
  const future = (installments ?? []) as Installment[];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted">{active.name}</p>
        <h2 className="text-xl font-bold">Recorrências e próximos pagamentos</h2>
        <p className="text-sm text-muted mt-1">Padrões encontrados no histórico. São sugestões, não lançamentos automáticos.</p>
      </div>

      <section className="card">
        <div className="flex justify-between items-center gap-3 mb-3">
          <div><p className="label mb-0">Parcelas futuras</p><p className="text-xs text-muted">Valores já comprometidos</p></div>
          <strong>{brl(future.reduce((sum, item) => sum + Number(item.amount), 0))}</strong>
        </div>
        {future.length === 0 ? <p className="text-sm text-muted">Nenhuma parcela futura registrada.</p> : (
          <div className="flex flex-col gap-2">
            {future.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm border-t border-border pt-2">
              <div className="min-w-0"><p className="font-medium truncate">{item.description ?? "Compra parcelada"}</p><p className="text-xs text-muted">{formatDate(item.occurred_at)} · {item.installment_number}/{item.installment_count}{accountName(item.conta) ? ` · ${accountName(item.conta)}` : ""}</p></div>
              <strong className="whitespace-nowrap text-danger">{brl(item.amount)}</strong>
            </div>)}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="patterns-title">
        <div className="flex justify-between items-end"><div><p className="label mb-0" id="patterns-title">Padrões frequentes</p><p className="text-xs text-muted">Detectados por histórico, intervalo e valor</p></div><span className="badge-neutral">{recurrences.length}</span></div>
        {recurrences.length === 0 ? <div className="card text-sm text-muted">Ainda não há histórico suficiente para detectar recorrências.</div> : recurrences.map((item) => (
          <div key={`${item.transaction_type}:${item.recurrence_key}`} className="card !p-4">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <div className="flex gap-2 items-center mb-1"><span className={item.transaction_type === "expense" ? "badge-expense" : item.transaction_type === "income" ? "badge-income" : "badge-transfer"}>{typeLabel(item.transaction_type)}</span><span className="text-xs text-muted">{frequencyLabel(item.frequency)}</span></div>
                <p className="font-semibold truncate">{item.label}</p>
                <p className="text-xs text-muted">{item.occurrences} ocorrências · última em {formatDate(item.last_occurred_at)}</p>
                {item.expected_next_at && <p className="text-xs text-info mt-1">Próxima estimada: {formatDate(item.expected_next_at)}</p>}
              </div>
              <div className="text-right"><p className="font-bold whitespace-nowrap">{brl(item.average_amount)}</p><p className="text-xs text-muted">média</p></div>
            </div>
          </div>
        ))}
      </section>

      <Link href="/extrato?tudo=1" className="btn-secondary text-center">Ver histórico completo</Link>
    </div>
  );
}

function accountName(value: Installment["conta"]) { return (Array.isArray(value) ? value[0]?.name : value?.name) ?? null; }
function formatDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR"); }
function typeLabel(type: string) { return ({ expense: "Gasto", income: "Renda", transfer_in: "Recebido", transfer_out: "Enviado" } as Record<string, string>)[type] ?? "Movimento"; }
function frequencyLabel(value: string) { return ({ monthly: "mensal", biweekly: "quinzenal", weekly: "semanal", frequent: "frequente" } as Record<string, string>)[value] ?? value; }
