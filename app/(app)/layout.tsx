import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { switchProfile } from "./actions";
import { BottomNav } from "./BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profiles, active } = await getContext();

  return (
    <div className="mx-auto w-full max-w-lg min-h-screen flex flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 flex items-center gap-3 overflow-hidden" aria-label="Espaço financeiro ativo">
        <div className="flex gap-2 overflow-x-auto flex-1 pb-1">
          {profiles.map((profile) => {
            const isActive = profile.id === active?.id;
            return (
              <form action={switchProfile} key={profile.id}>
                <input type="hidden" name="profileId" value={profile.id} />
                <input type="hidden" name="next" value="/dashboard" />
                <button type="submit" className={`profile-chip gap-2 ${isActive ? "profile-chip-active" : ""}`} aria-pressed={isActive}>
                  <span className="size-2.5 rounded-full border border-current/20" style={{ background: profile.color ?? "var(--brand)" }} aria-hidden="true" />
                  {profile.name}
                </button>
              </form>
            );
          })}
        </div>
        <Link href="/perfil?secao=espacos" className="profile-chip" aria-label="Gerenciar espaços financeiros">Gerenciar</Link>
      </header>

      <main id="main-content" className="flex-1 px-4" tabIndex={-1}>{children}</main>
      <BottomNav />
    </div>
  );
}
