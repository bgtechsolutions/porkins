import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { addTransaction } from "../actions";

export const dynamic = "force-dynamic";
type Member = { user_id: string; display_name: string; email: string; role: string };

export default async function NovaTransacao() {
  const { supabase, active, userId } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;

  const [{ data: accounts }, { data: categories }, { data: members }] = await Promise.all([
    supabase.from("accounts").select("id,name").eq("profile_id", active.id).eq("active", true).order("name"),
    supabase.from("categories").select("id,name").eq("is_income", false).order("name"),
    supabase.rpc("fn_profile_member_directory", { p_profile_id: active.id }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const directory = (members ?? []) as Member[];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Lançar gasto — {active.name}</h2>

      <form action={addTransaction} className="card flex flex-col gap-4">
        <input type="hidden" name="profile_id" value={active.id} />
        <input type="hidden" name="transaction_type" value="expense" />

        <div>
          <label className="label" htmlFor="amount">Valor (R$)</label>
          <input id="amount" name="amount" type="text" required
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

        {directory.some((member) => member.user_id !== userId) && (
          <details className="rounded-xl border border-border p-3">
            <summary className="font-semibold text-sm cursor-pointer">Dividir com alguém deste espaço</summary>
            <p className="text-xs text-muted mt-2">Você pagou a compra. Escolha quem deve devolver uma parte e informe o valor.</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <select name="debtor_user_id" aria-label="Pessoa que participa da divisão" className="input" defaultValue="">
                <option value="">Escolha a pessoa</option>
                {directory.filter((member) => member.user_id !== userId).map((member) => (
                  <option key={member.user_id} value={member.user_id}>{member.display_name}</option>
                ))}
              </select>
              <input name="split_amount" aria-label="Valor devido pela outra pessoa" type="text" inputMode="decimal" className="input" placeholder="Quanto deve (R$)" />
            </div>
          </details>
        )}

        <button type="submit" className="btn">Salvar gasto</button>
        <p className="text-xs text-muted text-center">
          Sem categoria? A gente marca pra revisar e te lembra depois.
        </p>
      </form>
      <Link href="/importar" className="text-sm text-brand font-semibold text-center">Importar vários gastos por CSV</Link>
    </div>
  );
}
