import { getContext } from "@/lib/profiles";
import { addCustomCategory, archiveCustomCategory } from "../actions";

type Category = { id: string; name: string; color: string | null; is_income: boolean; bucket: string; profile_id: string | null };
export default async function CategoriesPage() {
  const { supabase, active } = await getContext();
  if (!active) return null;
  const { data } = await supabase.from("categories").select("id,name,color,is_income,bucket,profile_id").or(`profile_id.is.null,profile_id.eq.${active.id}`).eq("archived", false).order("name");
  const rows = (data ?? []) as Category[];
  return <div className="flex flex-col gap-4"><header><p className="eyebrow">Organização</p><h1 className="page-title">Categorias</h1><p className="text-sm text-muted mt-1">Categorias próprias ficam somente neste espaço.</p></header>
    <details className="card disclosure-card"><summary><span><strong className="block text-sm">Criar categoria</strong><small className="text-muted">Receita ou despesa, com sua cor</small></span></summary><form action={addCustomCategory} className="disclosure-content grid gap-3"><input type="hidden" name="profile_id" value={active.id} /><input className="input" name="name" placeholder="Nome da categoria" required /><div className="grid grid-cols-2 gap-2"><select className="input" name="kind"><option value="expense">Despesa</option><option value="income">Receita</option></select><input className="input" type="color" name="color" defaultValue="#b51650" aria-label="Cor" /></div><select className="input" name="bucket"><option value="obrigatoria">Obrigatória</option><option value="nao_obrig">Flexível</option><option value="investimento">Investimento</option></select><button className="btn">Adicionar</button></form></details>
    {([false, true] as const).map((income) => <section className="card" key={String(income)}><h2 className="section-title">{income ? "Receitas" : "Despesas"}</h2><div className="category-grid mt-3">{rows.filter((row) => row.is_income === income).map((row) => <div className="category-pill" key={row.id}><i style={{ background: row.color ?? "var(--muted)" }} /><span>{row.name}</span>{row.profile_id && <form action={archiveCustomCategory}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="profile_id" value={active.id} /><button aria-label={`Arquivar ${row.name}`}>×</button></form>}</div>)}</div></section>)}
  </div>;
}
