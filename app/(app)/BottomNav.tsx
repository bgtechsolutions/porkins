"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ContextType = "personal" | "couple" | "household" | "business" | "other";
type IconName = "chart" | "plus" | "receipt" | "calendar" | "more";
type NavItem = { href: string; label: string; icon: IconName };

export function BottomNav({ contextType }: { contextType: ContextType }) {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: contextType === "business" ? "/empresa" : "/dashboard", label: "Resumo", icon: "chart" },
    { href: "/extrato", label: "Extrato", icon: "receipt" },
    { href: "/nova", label: "Lançar", icon: "plus" },
    { href: "/calendario", label: "Calendário", icon: "calendar" },
    { href: "/mais", label: "Mais", icon: "more" },
  ];
  return <nav className="bottom-nav fixed bottom-0 inset-x-0 border-t pb-[env(safe-area-inset-bottom)] z-20" aria-label="Navegação principal"><div className="mx-auto max-w-lg grid grid-cols-5">{items.map((item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return <Link key={item.href} href={item.href} className={`nav-item ${active ? "nav-item-active" : ""}`} aria-current={active ? "page" : undefined}><NavIcon name={item.icon} /><span>{item.label}</span></Link>;
  })}</div></nav>;
}

function NavIcon({ name }: { name: IconName }) {
  const common = { className: "nav-icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "chart") return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "receipt") return <svg {...common}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6" /></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>;
  return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></svg>;
}
