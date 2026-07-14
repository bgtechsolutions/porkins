"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOOGLE_SCOPES } from "@/lib/gmail/oauth";

async function callbackUrl(next: string) {
  const headerStore = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? headerStore.get("origin") ?? "http://localhost:3000";
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function loginWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: await callbackUrl("/dashboard"),
      scopes: GOOGLE_SCOPES,
      queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    },
  });
  if (error || !data.url) redirect(`/login?erro=${encodeURIComponent("Não foi possível iniciar o login com Google")}`);
  redirect(data.url);
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?erro=${encodeURIComponent("E-mail ou senha inválidos")}`);
  redirect("/perfil?vincular=1");
}
