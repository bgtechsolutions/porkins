import { getContext } from "@/lib/profiles";
import { saveProfileUserSettings } from "../../actions";

const sections = [["attention", "Pendências e decisões"], ["upcoming", "Próximos 30 dias"], ["planning", "Planejamento"], ["goals", "Metas"], ["context", "Resumo do espaço"]] as const;
const objectives = ["Diminuir dívidas", "Juntar dinheiro", "Investir", "Controle financeiro", "Gastar menos", "Equilibrar o orçamento", "Aumentar renda"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ salvo?: string }> }) {
  const { supabase, active, userId } = await getContext();
  if (!active) return null;
  const params = await searchParams;
  const { data } = await supabase.from("profile_user_settings").select("dashboard_sections,objectives,theme,hide_values").eq("profile_id", active.id).eq("user_id", userId).maybeSingle();
  const dashboard = (data?.dashboard_sections ?? { attention: true, upcoming: true, planning: true, goals: true, context: true }) as Record<string, boolean>;
  const selectedObjectives = new Set((data?.objectives ?? []) as string[]);
  return <form action={saveProfileUserSettings} className="flex flex-col gap-4">
    <input type="hidden" name="profile_id" value={active.id} />
    <header><p className="eyebrow">Personalização</p><h1 className="page-title">Seu Porkins</h1><p className="text-sm text-muted mt-1">Escolha o que importa. As funções continuam acessíveis em Mais.</p></header>
    {params.salvo && <p className="status-success">Preferências salvas.</p>}
    <section className="card"><h2 className="section-title">Tela de resumo</h2><p className="text-xs text-muted mt-1">Defina os blocos exibidos na página inicial.</p><div className="settings-list mt-3">{sections.map(([value, label]) => <label key={value}><span>{label}</span><input type="checkbox" name="dashboard_section" value={value} defaultChecked={dashboard[value] !== false} /></label>)}</div></section>
    <section className="card"><h2 className="section-title">Meus objetivos</h2><div className="choice-grid mt-3">{objectives.map((value) => <label className="selectable" key={value}><input type="checkbox" name="objective" value={value} defaultChecked={selectedObjectives.has(value)} /><span>{value}</span></label>)}</div></section>
    <section className="card"><h2 className="section-title">Aparência e privacidade</h2><label className="label mt-3">Tema<select className="input mt-1" name="theme" defaultValue={data?.theme ?? "system"}><option value="system">Usar o aparelho</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label><label className="flex items-center justify-between gap-3 mt-4"><span><strong className="block text-sm">Ocultar valores ao abrir</strong><small className="text-muted">Útil para usar o app em público.</small></span><input type="checkbox" name="hide_values" value="1" defaultChecked={Boolean(data?.hide_values)} /></label></section>
    <button className="btn sticky-save">Salvar preferências</button>
  </form>;
}
