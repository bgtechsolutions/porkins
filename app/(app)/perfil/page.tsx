import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { setProfileType, updateAllocations } from "../actions";

export const dynamic = "force-dynamic";

type Rule = { bucket: string; percentage: number };

const TYPES = [
  { key: "razoavel", label: "Razoável", desc: "60 / 30 / 10 — equilíbrio", emoji: "😌" },
  { key: "moderado", label: "Moderado", desc: "55 / 25 / 20 — investe mais", emoji: "💪" },
  { key: "investidor", label: "Investidor", desc: "50 / 20 / 30 — foco em investir", emoji: "🚀" },
];

export default async function Perfil() {
  const { supabase, active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;

  const { data } = await supabase
    .from("allocation_rules")
    .select("bucket,percentage")
    .eq("profile_id", active.id);

  const rules = (data ?? []) as Rule[];
  const pctOf = (b: string) => Math.round(Number(rules.find((r) => r.bucket === b)?.percentage ?? 0) * 100);
  const isCasa = active.type === "compartilhado";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Perfil — {active.name}</h2>

      <Link href="/renda" className="card flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">Salário e fontes de renda</p>
          <p className="text-xs text-muted">Adicionar/editar de onde vem cada valor</p>
        </div>
        <span className="text-brand font-bold">→</span>
      </Link>

      {isCasa ? (
        <div className="card text-sm text-muted">
          O perfil Casa usa a regra 70% Caixinha / 30% Compras. Os tipos abaixo valem para os perfis pessoais.
        </div>
      ) : (
        <>
          <div className="card">
            <p className="label mb-2">Tipo de perfil (define os tetos)</p>
            <div className="flex flex-col gap-2">
              {TYPES.map((t) => {
                const isActive = active.profile_type === t.key;
                return (
                  <form action={setProfileType} key={t.key}>
                    <input type="hidden" name="profile_id" value={active.id} />
                    <input type="hidden" name="type" value={t.key} />
                    <button
                      className="w-full flex items-center gap-3 p-3 rounded-xl border text-left"
                      style={
                        isActive
                          ? { borderColor: active.color ?? "var(--brand)", background: "color-mix(in srgb, var(--brand) 8%, transparent)" }
                          : { borderColor: "var(--border)" }
                      }
                    >
                      <span className="text-2xl">{t.emoji}</span>
                      <span className="flex-1">
                        <span className="block font-semibold text-sm">{t.label}</span>
                        <span className="block text-xs text-muted">{t.desc}</span>
                      </span>
                      {isActive && <span className="text-brand font-bold">✓</span>}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>

          <div className="card">
            <p className="label mb-2">Ou ajuste os tetos manualmente (%)</p>
            <form action={updateAllocations} className="flex flex-col gap-2">
              <input type="hidden" name="profile_id" value={active.id} />
              <FieldPct name="obrigatoria" label="Despesas obrigatórias" value={pctOf("obrigatoria")} />
              <FieldPct name="nao_obrig" label="Despesas não obrigatórias" value={pctOf("nao_obrig")} />
              <FieldPct name="investimento" label="Investimentos (inclui reserva)" value={pctOf("investimento")} />
              <button className="btn mt-1">Salvar percentuais</button>
            </form>
          </div>

          <div className="card text-xs text-muted leading-relaxed">
            💡 <strong>Como ler:</strong> os percentuais de despesa são <strong>tetos</strong> — o ideal é
            ficar <em>abaixo</em> deles. Já o de investimento é um <strong>mínimo</strong>: quanto mais você
            passar, melhor, porque não é gasto, é patrimônio. Baseado na lógica do &quot;pague-se primeiro&quot;
            e na regra 50/30/20 adaptada.
          </div>
        </>
      )}
    </div>
  );
}

function FieldPct({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          name={name}
          type="number"
          min="0"
          max="100"
          defaultValue={value}
          className="input !w-20 text-right"
          inputMode="numeric"
        />
        <span className="text-muted">%</span>
      </span>
    </label>
  );
}
