import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  name: string;
  type: "pessoal" | "compartilhado";
  color: string | null;
  monthly_income: number | null;
};

const ACTIVE_COOKIE = "pk_profile";

/** Contexto padrão de toda página autenticada: usuário, perfis e perfil ativo. */
export async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id,name,type,color,monthly_income");

  // pessoal primeiro, Casa depois
  const profiles = ((data ?? []) as Profile[]).sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === "pessoal" ? -1 : 1,
  );

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_COOKIE)?.value;
  const active =
    profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;

  return { supabase, user, profiles, active };
}

export { ACTIVE_COOKIE };
