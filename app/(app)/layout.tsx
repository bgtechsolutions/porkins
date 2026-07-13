import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { switchProfile, logout } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profiles, active } = await getContext();

  return (
    <div className="mx-auto w-full max-w-lg min-h-screen flex flex-col pb-24">
      {/* Topo: seletor de perfil */}
      <header className="p-4 flex items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {profiles.map((p) => {
            const isActive = p.id === active?.id;
            return (
              <form action={switchProfile} key={p.id}>
                <input type="hidden" name="profileId" value={p.id} />
                <input type="hidden" name="next" value="/dashboard" />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-full text-sm font-semibold border transition"
                  style={
                    isActive
                      ? {
                          background: p.color ?? "var(--brand)",
                          color: "#fff",
                          borderColor: p.color ?? "var(--brand)",
                        }
                      : { borderColor: "var(--border)", color: "var(--muted)" }
                  }
                >
                  {p.name}
                </button>
              </form>
            );
          })}
        </div>
        <form action={logout}>
          <button className="text-sm text-muted" title="Sair">
            Sair
          </button>
        </form>
      </header>

      <main className="flex-1 px-4">{children}</main>

      {/* Navegação inferior */}
      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-surface">
        <div className="mx-auto max-w-lg grid grid-cols-5">
          <NavLink href="/dashboard" icon="📊" label="Resumo" />
          <NavLink href="/nova" icon="➕" label="Lançar" />
          <NavLink href="/extrato" icon="📋" label="Extrato" />
          <NavLink href="/caixinhas" icon="🐖" label="Caixinhas" />
          <NavLink href="/casa/compras" icon="🏡" label="Casa" />
        </div>
      </nav>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 py-3 text-xs text-muted"
    >
      <span className="text-xl">{icon}</span>
      {label}
    </Link>
  );
}
