import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { TransactionForm } from "./TransactionForm";

export const dynamic = "force-dynamic";
type Member = { user_id: string; display_name: string; email: string; role: string };

export default async function NovaTransacao() {
  const { supabase, active, userId, profiles } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;

  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase.from("accounts").select("id,name").eq("profile_id", active.id).eq("active", true).order("name"),
    supabase.from("categories").select("id,name").eq("is_income", false).order("name"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const sharedSpaces = profiles.filter((profile) => profile.context_type !== "personal");
  const directories = await Promise.all(sharedSpaces.map(async (profile) => {
    const { data } = await supabase.rpc("fn_profile_member_directory", { p_profile_id: profile.id });
    return [profile.id, (data ?? []) as Member[]] as const;
  }));
  const membersBySpace = Object.fromEntries(directories.map(([profileId, members]) => [
    profileId,
    members.map((member) => ({ userId: member.user_id, displayName: member.display_name, email: member.email })),
  ]));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Lançar gasto — {active.name}</h2>

      <TransactionForm
        profileId={active.id}
        profileName={active.name}
        userId={userId}
        accounts={(accounts ?? []) as { id: string; name: string }[]}
        categories={(categories ?? []) as { id: string; name: string }[]}
        spaces={sharedSpaces.map((profile) => ({ id: profile.id, name: profile.name, contextType: profile.context_type }))}
        membersBySpace={membersBySpace}
        today={today}
      />
      <Link href="/importar" className="text-sm text-brand font-semibold text-center">Importar vários gastos por CSV</Link>
    </div>
  );
}
