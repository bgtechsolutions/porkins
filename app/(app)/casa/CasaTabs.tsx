import Link from "next/link";

export default function CasaTabs({ active }: { active: "compras" | "contas" }) {
  const tab = (href: string, key: string, label: string) => (
    <Link
      href={href}
      className="flex-1 text-center py-2 rounded-lg text-sm font-semibold"
      style={
        active === key
          ? { background: "var(--color-brand)", color: "#fff" }
          : { color: "var(--muted)" }
      }
    >
      {label}
    </Link>
  );
  return (
    <div>
      <h2 className="text-lg font-bold mb-3">🏡 Casa</h2>
      <div className="flex gap-1 p-1 rounded-xl border border-border">
        {tab("/casa/compras", "compras", "Compras")}
        {tab("/casa/contas", "contas", "Contas do mês")}
      </div>
    </div>
  );
}
