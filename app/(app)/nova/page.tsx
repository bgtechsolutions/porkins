import { getContext } from "@/lib/profiles";
import { addTransaction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovaTransacao() {
  const { supabase, active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;

  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase.from("accounts").select("id,name").eq("profile_id", active.id).eq("active", true).order("name"),
    supabase.from("categories").select("id,name").eq("is_income", false).order("name"),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Lançar gasto — {active.name}</h2>

      <form action={addTransaction} className="card flex flex-col gap-4">
        <input type="hidden" name="profile_id" value={active.id} />

        <div>
          <label className="label" htmlFor="amount">Valor (R$)</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0" required
            inputMode="decimal" className="input" placeholder="0,00" autoFocus />
        </div>

        <div>
          <label className="label" htmlFor="description">O que foi</label>
          <input id="description" name="description" type="text" className="input"
            placeholder="Ex.: Mercado, Uber, farmácia..." />
        </div>

        <div>
          <label className="label" htmlFor="category_id">Categoria</label>
          <select id="category_id" name="category_id" className="input" defaultValue="">
            <option value="">Não sei / classificar depois</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="account_id">Conta / cartão</label>
            <select id="account_id" name="account_id" className="input" defaultValue="">
              <option value="">—</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="occurred_at">Data</label>
            <input id="occurred_at" name="occurred_at" type="date" defaultValue={today} className="input" />
          </div>
        </div>

        <button type="submit" className="btn">Salvar gasto</button>
        <p className="text-xs text-muted text-center">
          Sem categoria? A gente marca pra revisar e te lembra depois.
        </p>
      </form>
    </div>
  );
}
