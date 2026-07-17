import Link from "next/link";

export default function CasaTabs({ active }: { active: "compras" | "contas" }) {
  const tab = (href: string, key: string, label: string) => (
    <Link
      href={href}
      className={"tab-item flex-1 " + (active === key ? "tab-item-active" : "")}
      aria-current={active === key ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <div>
      <div className="mb-3">
        <p className="eyebrow">Espaço compartilhado</p>
        <h1 className="page-title">Casa</h1>
      </div>
      <nav className="flex gap-1 p-1 rounded-xl border border-border" aria-label="Seções da casa">
        {tab("/casa/compras", "compras", "Produtos")}
        {tab("/casa/contas", "contas", "Contas do mês")}
      </nav>
    </div>
  );
}
