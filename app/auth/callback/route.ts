import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/gmail/crypto";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const errorUrl = new URL("/login", request.url);
  if (!code) {
    errorUrl.searchParams.set("erro", "O Google não retornou um código de acesso.");
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user || !data.session) {
    errorUrl.searchParams.set("erro", "Não foi possível concluir o acesso com Google.");
    return NextResponse.redirect(errorUrl);
  }

  const { data: profiles } = await supabase.from("profiles").select("id,type").eq("type", "pessoal").limit(1);
  const profile = profiles?.[0];
  if (!profile) {
    await supabase.auth.signOut();
    errorUrl.searchParams.set("erro", "Este Gmail ainda não está vinculado. Entre uma última vez com senha e conecte-o em Perfil.");
    return NextResponse.redirect(errorUrl);
  }

  const googleIdentity = data.user.identities?.find((identity) => identity.provider === "google");
  const gmailEmail = String(googleIdentity?.identity_data?.email ?? data.user.email ?? "").toLowerCase();
  const refreshToken = data.session.provider_refresh_token;
  if (gmailEmail && refreshToken) {
    const admin = createAdminClient();
    const { error: saveError } = await admin.from("gmail_connections").upsert({
      user_id: data.user.id,
      profile_id: profile.id,
      gmail_email: gmailEmail,
      encrypted_refresh_token: encryptToken(refreshToken),
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (saveError) {
      errorUrl.searchParams.set("erro", "Google conectado, mas não foi possível preparar a sincronização do Gmail.");
      return NextResponse.redirect(errorUrl);
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
