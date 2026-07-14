import { getContext } from "@/lib/profiles";
import { brl, pct, parseBRL } from "@/lib/format";
import { addContribution, addGoal, deleteGoal, updateGoal } from "../actions";

export const dynamic = "force-dynamic";

export default async function Caixinhas({
  searchParams,
}: {
  searchParams: Promise<{ disp?: string }>;
}) {
  const { supabase, active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;

  const { disp } = await searchParams;
  const disponivel = disp ? parseBRL(disp) : 0;

  const { data: goals } = await supabase
    .from("v_goal_progress")
    .select("*")
    .eq("profile_id", active.id)
    .order("weight", { ascending: false });

  const sugestoes: Record<string, number> = {};
  let criterio = "";
  if (disponivel > 0) {
    const { data } = await supabase.rpc("fn_suggest_contributions", {
      p_profile_id: active.id,
      p_available: disponivel,
    });
    for (const row of data ?? []) {
      sugestoes[row.goal_id] = Number(row.sugestao);
      criterio = row.criterio;
    }
  }

  const ativas = (goals ?? []).filter((g) => g.status !== "concluida");
  const concluidas = (goals ?? []).filter((g) => g.status === "concluida");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Caixinhas — {active.name}</h2>

      <details className="card">
        <summary className="font-semibold cursor-pointer">＋ Nova caixinha</summary>
        <form action={addGoal} className="flex flex-col gap-2 mt-3">
          <input type="hidden" name="profile_id" value={active.id} />
          <input name="name" required className="input" placeholder="Nome da meta" aria-label="Nome da meta" />
          <div className="grid grid-cols-2 gap-2">
            <input name="target_amount" required inputMode="decimal" className="input" placeholder="Valor da meta" aria-label="Valor da meta" />
            <input name="deadline" type="date" className="input" aria-label="Prazo da meta" />
            <select name="priority" defaultValue="media" className="input" aria-label="Prioridade da meta">
              <option value="alta">Prioridade alta</option><option value="media">Prioridade média</option><option value="baixa">Prioridade baixa</option>
            </select>
            <select name="kind" defaultValue="curto_prazo" className="input" aria-label="Tipo da meta">
              <option value="reserva">Reserva</option><option value="curto_prazo">Curto prazo</option><option value="medio_prazo">Médio prazo</option><option value="longo_prazo">Longo prazo</option>
            </select>
          </div>
          <button className="btn">Criar caixinha</button>
        </form>
      </details>

      {/* Sugestão de aporte */}
      <form method="get" className="card flex flex-col gap-3">
        <label className="label mb-0" htmlFor="disp">
          Quanto você tem pra investir este mês?
        </label>
        <div className="flex gap-2">
          <input
            id="disp"
            name="disp"
            type="text"
            defaultValue={disp ?? ""}
            className="input"
            placeholder="Ex.: 718,50"
            inputMode="decimal"
          />
          <button type="submit" className="btn whitespace-nowrap">
            Sugerir
          </button>
        </div>
        {criterio && (
          <p className="text-xs text-muted">
            Critério: {criterio}
          </p>
        )}
      </form>

      {/* Metas ativas */}
      <div className="flex flex-col gap-3">
        {ativas.map((g) => {
          const sug = sugestoes[g.id];
          return (
            <div key={g.id} className="card">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-xs text-muted">
                    {g.deadline
                      ? `Prazo: ${new Date(g.deadline).toLocaleDateString("pt-BR")}`
                      : "Sem prazo definido"}
                    {g.priority ? ` · prioridade ${g.priority}` : ""}
                  </p>
                </div>
                <span className="text-sm text-muted">{pct(g.progresso)}</span>
              </div>

              <div
                className="bar mb-1"
                role="progressbar"
                aria-label={`Progresso de ${g.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(Math.round(Number(g.progresso) * 100), 100)}
              >
                <span
                  style={{
                    width: `${Math.min(Number(g.progresso) * 100, 100)}%`,
                    background: active.color ?? "var(--brand-solid)",
                  }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>{brl(g.current_amount)}</span>
                <span className="text-muted">meta {brl(g.target_amount)}</span>
              </div>

              {sug > 0 && (
                <div className="mt-2 status-warning">
                  💡 Sugestão de aporte: <strong>{brl(sug)}</strong>
                </div>
              )}

              {/* Registrar aporte */}
              <form action={addContribution} className="flex gap-2 mt-3">
                <input type="hidden" name="goal_id" value={g.id} />
                <input
                  name="amount"
                  type="text"
                  className="input"
                  placeholder={sug > 0 ? String(sug) : "Registrar aporte"}
                  inputMode="decimal"
                  aria-label={`Valor do aporte para ${g.name}`}
                />
                <button type="submit" className="btn whitespace-nowrap">
                  Aportar
                </button>
              </form>

              <details className="mt-3 border-t border-border pt-2">
                <summary className="text-xs text-muted cursor-pointer">Editar caixinha</summary>
                <form action={updateGoal} className="flex flex-col gap-2 mt-2">
                  <input type="hidden" name="id" value={g.id} />
                  <input name="name" required defaultValue={g.name} className="input" aria-label={`Nome da meta ${g.name}`} />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="target_amount" inputMode="decimal" required defaultValue={Number(g.target_amount)} className="input" aria-label={`Valor alvo de ${g.name}`} />
                    <input value={`Saldo: ${brl(g.current_amount)}`} readOnly className="input text-muted" aria-label="Saldo atual, alterado somente por aportes" />
                    <input name="deadline" type="date" defaultValue={g.deadline ?? ""} className="input" aria-label={`Prazo de ${g.name}`} />
                    <select name="priority" defaultValue={g.priority} className="input" aria-label={`Prioridade de ${g.name}`}>
                      <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
                    </select>
                    <select name="kind" defaultValue={g.kind} className="input" aria-label={`Tipo da meta ${g.name}`}>
                      <option value="reserva">Reserva</option><option value="curto_prazo">Curto prazo</option><option value="medio_prazo">Médio prazo</option><option value="longo_prazo">Longo prazo</option>
                    </select>
                    <select name="status" defaultValue={g.status} className="input" aria-label={`Status de ${g.name}`}>
                      <option value="em_andamento">Em andamento</option><option value="pausada">Pausada</option><option value="concluida">Concluída</option>
                    </select>
                  </div>
                  <button className="btn">Salvar alterações</button>
                </form>
                <form action={deleteGoal} className="mt-2">
                  <input type="hidden" name="id" value={g.id} />
                  <button className="btn-danger w-full">Excluir caixinha e aportes</button>
                </form>
              </details>
            </div>
          );
        })}
      </div>

      {/* Concluídas */}
      {concluidas.length > 0 && (
        <div className="card">
          <p className="label mb-2">Metas concluídas 🎉</p>
          <div className="flex flex-col gap-1">
            {concluidas.map((g) => (
              <div key={g.id} className="flex justify-between text-sm">
                <span>{g.name}</span>
                <span className="text-muted">{brl(g.current_amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
