"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_ITEMS = [
  { href: "/dashboard", label: "Resumo", icon: "chart" },
  { href: "/nova", label: "Lançar", icon: "plus" },
  { href: "/extrato", label: "Extrato", icon: "receipt" },
  { href: "/acertos", label: "Acertos", icon: "users" },
  { href: "/perfil", label: "Perfil", icon: "user" },
] as const;

type ContextType = "personal" | "couple" | "household" | "business" | "other";
type IconName = "chart" | "plus" | "receipt" | "users" | "home" | "user" | "briefcase";
type NavItem = { href: string; label: string; icon: IconName };

export function BottomNav({ contextType }: { contextType: ContextType }) {
  const pathname = usePathname();
  const items: NavItem[] = contextType === "business"
    ? [
        { href: "/empresa", label: "Empresa", icon: "briefcase" },
        BASE_ITEMS[1], BASE_ITEMS[2],
        { href: "/empresa/clientes", label: "Clientes", icon: "users" },
        BASE_ITEMS[4],
      ]
    : contextType === "household"
      ? [BASE_ITEMS[0], BASE_ITEMS[1], BASE_ITEMS[2], { href: "/casa/compras", label: "Casa", icon: "home" }, BASE_ITEMS[4]]
      : [...BASE_ITEMS];

  return (
    <nav className="bottom-nav fixed bottom-0 inset-x-0 border-t pb-[env(safe-area-inset-bottom)] z-20" aria-label="Navegação principal">
      <div className="mx-auto max-w-lg grid grid-cols-5">
        {items.map((item) => {
          const active = item.href === "/empresa" ? pathname === "/empresa"
            : item.href.startsWith("/casa/") ? pathname.startsWith("/casa/")
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? "nav-item-active" : ""}`} aria-current={active ? "page" : undefined}>
              <NavIcon name={item.icon} /><span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({ name }: { name: IconName }) {
  const common = { className: "nav-icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "chart") return <svg {...common}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
  if (name === "receipt") return <svg {...common}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6" /><path d="M9 12h6" /></svg>;
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === "home") return <svg {...common}><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10" /><path d="M9 21v-6h6v6" /></svg>;
  if (name === "briefcase") return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 12h18" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}
