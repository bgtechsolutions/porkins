import { getContext } from "@/lib/profiles";
import { brl, pct, parseBRL } from "@/lib/format";
import { addContribution } from "../actions";

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

              <div className="bar mb-1">
                <span
                  style={{
                    width: `${Math.min(Number(g.progresso) * 100, 100)}%`,
                    background: active.color ?? "var(--color-brand)",
                  }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>{brl(g.current_amount)}</span>
                <span className="text-muted">meta {brl(g.target_amount)}</span>
              </div>

              {sug > 0 && (
                <div className="mt-2 text-sm rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--color-brand) 12%, transparent)" }}>
                  💡 Sugestão de aporte: <strong>{brl(sug)}</strong>
                </div>
              )}

              {/* Registrar aporte */}
              <form action={addContribution} className="flex gap-2 mt-3">
                <input type="hidden" name="goal_id" value={g.id} />
                <input type="hidden" name="profile_id" value={active.id} />
                <input
                  name="amount"
                  type="text"
                  className="input"
                  placeholder={sug > 0 ? String(sug) : "Registrar aporte"}
                  inputMode="decimal"
                />
                <button type="submit" className="btn whitespace-nowrap">
                  Aportar
                </button>
              </form>
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
