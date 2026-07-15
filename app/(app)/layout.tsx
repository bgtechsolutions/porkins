import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { switchProfile } from "./actions";
import { respondProfileInvitation } from "./actions";
import { BottomNav } from "./BottomNav";

type PendingInvitation = {
  invitation_id: string;
  profile_name: string;
  invited_email: string;
  invited_by_name: string;
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profiles, active } = await getContext();
  const { data: invitations } = await supabase.rpc("fn_pending_profile_invitations");

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

      <main id="main-content" className="flex-1 px-4" tabIndex={-1}>
        {((invitations ?? []) as PendingInvitation[]).map((invitation) => (
          <section key={invitation.invitation_id} className="card mb-4 border-brand" aria-labelledby={`invite-${invitation.invitation_id}`}>
            <p className="text-xs text-brand font-bold">NOVO CONVITE</p>
            <h2 id={`invite-${invitation.invitation_id}`} className="font-semibold mt-1">Participar de {invitation.profile_name}?</h2>
            <p className="text-xs text-muted mt-1">{invitation.invited_by_name} convidou {invitation.invited_email} para este espaço financeiro.</p>
            <form action={respondProfileInvitation} className="grid grid-cols-2 gap-2 mt-3">
              <input type="hidden" name="invitation_id" value={invitation.invitation_id} />
              <button name="decision" value="decline" className="btn-secondary">Recusar</button>
              <button name="decision" value="accept" className="btn">Aceitar convite</button>
            </form>
          </section>
        ))}
        {children}
      </main>
      <BottomNav showHouse={profiles.some((profile) => profile.context_type === "household")} />
    </div>
  );
}
