import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { brl } from "@/lib/format";
import { updateTransaction, deleteTransaction } from "../actions";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");

type Txn = {
  id: string;
  amount: number;
  description: string | null;
  occurred_at: string;
  category_id: string | null;
  needs_review: boolean;
  categoria: { name: string } | { name: string }[] | null;
};

export default async function Extrato({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tudo?: string; importados?: string }>;
}) {
  const { supabase, active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;

  const { mes: mesParam, tudo, importados } = await searchParams;
  const now = new Date();
  const mes = tudo ? "" : mesParam || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  let query = supabase
    .from("transactions")
    .select("id,amount,description,occurred_at,category_id,needs_review,categoria:categories(name)")
    .eq("profile_id", active.id)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (mes) {
    const [y, m] = mes.split("-").map(Number);
    const from = `${y}-${pad(m)}-01`;
    const to = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
    query = query.gte("occurred_at", from).lt("occurred_at", to);
  }

  const [{ data: txns }, { data: categories }] = await Promise.all([
    query,
    supabase.from("categories").select("id,name").eq("is_income", false).order("name"),
  ]);

  const rows = (txns ?? []) as Txn[];
  const total = rows.reduce((s, t) => s + Number(t.amount), 0);
  const catName = (t: Txn) =>
    (Array.isArray(t.categoria) ? t.categoria[0]?.name : t.categoria?.name) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Extrato — {active.name}</h2>

      {importados && (
        <div className="card text-sm text-green-700" role="status">
          {importados} lançamento(s) importado(s) com sucesso.
        </div>
      )}

      {/* Filtro */}
      <form method="get" className="card flex flex-col gap-2">
        <label className="label mb-0">Filtrar por mês</label>
        <div className="flex gap-2">
          <input type="month" name="mes" defaultValue={mes} className="input" />
          <button type="submit" className="btn whitespace-nowrap">Filtrar</button>
        </div>
        <div className="flex gap-4 text-xs">
          <Link href="/extrato" className="text-brand font-semibold">Mês atual</Link>
          <Link href="/extrato?tudo=1" className="text-muted">Ver tudo (histórico)</Link>
          <Link href="/importar" className="text-brand font-semibold">Importar CSV</Link>
        </div>
      </form>

      {/* Resumo do período */}
      <div className="card flex justify-between items-center">
        <div>
          <p className="label mb-0">{tudo ? "Todos os lançamentos" : "Total do período"}</p>
          <p className="text-xs text-muted">{rows.length} lançamento(s)</p>
        </div>
        <p className="text-xl font-bold">{brl(total)}</p>
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <div className="card text-sm text-muted">Nenhum lançamento neste período.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((t) => (
            <details key={t.id} className="card">
              <summary className="flex items-center justify-between gap-2 cursor-pointer list-none">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {t.description || catName(t) || "Sem descrição"}
                    {t.needs_review && (
                      <span className="ml-2 text-xs text-amber-600 font-semibold">⚠️ revisar</span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(t.occurred_at + "T00:00:00").toLocaleDateString("pt-BR")}
                    {catName(t) ? ` · ${catName(t)}` : ""}
                  </p>
                </div>
                <span className="font-semibold whitespace-nowrap">{brl(t.amount)}</span>
              </summary>

              <form action={updateTransaction} className="flex flex-col gap-2 mt-3 pt-3 border-t border-border">
                <input type="hidden" name="id" value={t.id} />
                <div className="flex gap-2">
                  <input name="amount" type="text" inputMode="decimal" defaultValue={Number(t.amount)} className="input" placeholder="Valor" />
                  <input name="occurred_at" type="date" defaultValue={t.occurred_at} className="input" />
                </div>
                <input name="description" type="text" defaultValue={t.description ?? ""} className="input" placeholder="Descrição" />
                <select name="category_id" defaultValue={t.category_id ?? ""} className="input">
                  <option value="">Sem categoria (revisar)</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button className="btn flex-1">Salvar</button>
                </div>
              </form>
              <form action={deleteTransaction} className="mt-2">
                <input type="hidden" name="id" value={t.id} />
                <button className="w-full py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200">
                  Excluir lançamento
                </button>
              </form>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
