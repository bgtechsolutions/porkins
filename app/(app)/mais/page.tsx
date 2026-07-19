import Link from "next/link";
import { getContext } from "@/lib/profiles";

const common = [
  ["Previsão", "Próximos 12 meses", "/previsao", "↗"],
  ["Calendário", "Contas e lançamentos por dia", "/calendario", "□"],
  ["Transferir", "Mover entre seus espaços", "/transferir", "⇄"],
  ["Categorias", "Organize do seu jeito", "/categorias", "◇"],
  ["Patrimônio", "Bens, investimentos e dívidas", "/patrimonio", "⌂"],
  ["Família e membros", "Convites, acessos e divisão", "/familia", "○"],
  ["Caixinhas", "Metas e reservas", "/caixinhas", "◎"],
  ["Acertos", "O que pagar e receber", "/acertos", "✓"],
  ["Configurações", "Resumo, objetivos e aparência", "/mais/configuracoes", "⚙"],
] as const;

export default async function MorePage() {
  const { active } = await getContext();
  const contextual = active?.context_type === "business"
    ? [["Gestão da empresa", "Clientes, caixa e sócios", "/empresa", "▣"] as const]
    : active?.context_type === "household"
      ? [["Casa", "Compras, produtos e contas", "/casa/compras", "⌂"] as const]
      : [];
  return <div className="flex flex-col gap-4">
    <header><p className="eyebrow">Organizar</p><h1 className="page-title">Mais</h1><p className="text-sm text-muted mt-1">Tudo continua disponível, sem lotar sua tela principal.</p></header>
    <section className="feature-grid" aria-label="Outras áreas do Porkins">
      {[...contextual, ...common].map(([title, detail, href, icon]) => <Link className="feature-tile" href={href} key={href}>
        <span className="feature-icon" aria-hidden="true">{icon}</span><strong>{title}</strong><small>{detail}</small>
      </Link>)}
    </section>
    <div className="grid grid-cols-2 gap-2"><Link className="btn-secondary" href="/perfil">Perfil e integrações</Link><a className="btn-secondary" href={`/api/export?profile=${active?.id}`}>Exportar meus dados</a></div>
  </div>;
}
