import { getContext } from "@/lib/profiles";
import { brl } from "@/lib/format";
import { updateIncome, addIncome, deleteIncome } from "../actions";

export const dynamic = "force-dynamic";

type Income = { id: string; name: string; amount: number };

export default async function Renda() {
  const { supabase, active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;

  const { data } = await supabase
    .from("income_sources")
    .select("id,name,amount")
    .eq("profile_id", active.id)
    .order("amount", { ascending: false });

  const sources = (data ?? []) as Income[];
  const total = sources.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Renda — {active.name}</h2>

      <div className="card">
        <p className="label">Renda mensal total</p>
        <p className="text-2xl font-bold">{brl(total)}</p>
        <p className="text-xs text-muted mt-1">Soma das fontes abaixo</p>
      </div>

      <div className="card flex flex-col gap-3">
        <p className="label mb-0">Fontes de renda</p>
        {sources.map((s) => (
          <div key={s.id} className="surface-muted rounded-xl p-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="flex-1 text-sm font-medium">{s.name}</span>
            <form action={updateIncome} className="flex items-center gap-2">
              <input type="hidden" name="id" value={s.id} />
              <input
                name="amount"
                type="text"
                defaultValue={Number(s.amount)}
                className="input !w-28 text-right"
                inputMode="decimal"
                aria-label={`Valor mensal de ${s.name}`}
              />
              <button className="btn text-sm px-3">Salvar</button>
            </form>
            <form action={deleteIncome}>
              <input type="hidden" name="id" value={s.id} />
              <button className="text-danger text-lg min-h-11 min-w-11" aria-label={`Remover fonte ${s.name}`}>×</button>
            </form>
          </div>
        ))}
        {sources.length === 0 && (
          <p className="text-sm text-muted">Nenhuma fonte de renda cadastrada.</p>
        )}
      </div>

      <div className="card">
        <p className="label mb-2">Adicionar fonte</p>
        <form action={addIncome} className="flex flex-col gap-2">
          <input type="hidden" name="profile_id" value={active.id} />
          <input name="name" type="text" required className="input" placeholder="Ex.: Salário, Freela, Vale..." aria-label="Nome da fonte de renda" />
          <div className="flex gap-2">
            <input name="amount" type="text" className="input" placeholder="Valor (R$)" inputMode="decimal" aria-label="Valor mensal da fonte de renda" />
            <button className="btn whitespace-nowrap">Adicionar</button>
          </div>
        </form>
      </div>

      <p className="text-xs text-muted text-center">
        💡 Em breve: quando a automação por e-mail estiver ativa, salário e PIX recebidos entram sozinhos aqui.
      </p>
    </div>
  );
}
