import Link from "next/link";

export default function CasaTabs({ active }: { active: "compras" | "contas" }) {
  const tab = (href: string, key: string, label: string) => (
    <Link
      href={href}
      className={`tab-item flex-1 ${active === key ? "tab-item-active" : ""}`}
      aria-current={active === key ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <div>
      <h2 className="text-lg font-bold mb-3">🏡 Casa</h2>
      <nav className="flex gap-1 p-1 rounded-xl border border-border" aria-label="Seções da casa">
        {tab("/casa/compras", "compras", "Compras")}
        {tab("/casa/contas", "contas", "Contas do mês")}
      </nav>
    </div>
  );
}
