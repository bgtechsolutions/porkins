import Link from "next/link";

const ITEMS = [
  ["/empresa", "Visão geral"],
  ["/empresa/clientes", "Clientes"],
  ["/empresa/socios", "Sócios"],
  ["/empresa/caixa", "Caixa"],
] as const;

export function EmpresaTabs({ active }: { active: "overview" | "clients" | "partners" | "cash" }) {
  const keys = ["overview", "clients", "partners", "cash"] as const;
  return <nav className="grid grid-cols-4 gap-1" aria-label="Área da empresa">
    {ITEMS.map(([href, label], index) => <Link key={href} href={href} className={`tab-item ${active === keys[index] ? "tab-item-active" : ""}`} aria-current={active === keys[index] ? "page" : undefined}>{label}</Link>)}
  </nav>;
}