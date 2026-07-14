import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { switchProfile } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profiles, active } = await getContext();

  return (
    <div className="mx-auto w-full max-w-lg min-h-screen flex flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Topo: seletor de perfil */}
      <header className="px-4 py-3 flex items-center gap-3 overflow-hidden">
        <div className="flex gap-2 overflow-x-auto flex-1 pb-1">
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
        <Link href="/perfil" className="text-sm text-muted font-semibold whitespace-nowrap">Perfil</Link>
      </header>

      <main className="flex-1 px-4">{children}</main>

      {/* Navegação inferior */}
      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] z-20">
        <div className="mx-auto max-w-lg grid grid-cols-5">
          <NavLink href="/dashboard" icon="📊" label="Resumo" />
          <NavLink href="/nova" icon="➕" label="Lançar" />
          <NavLink href="/extrato" icon="📋" label="Extrato" />
          <NavLink href="/caixinhas" icon="🐖" label="Caixinhas" />
          <NavLink href="/perfil" icon="⚙️" label="Perfil" />
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
