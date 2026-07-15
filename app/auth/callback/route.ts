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
  const requestedProfileId = request.nextUrl.searchParams.get("profile");
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

  const { data: existingConnection } = await createAdminClient()
    .from("gmail_connections")
    .select("profile_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  const { data: profiles } = await supabase.from("profiles").select("id,type");
  const profile = profiles?.find((item) => item.id === requestedProfileId)
    ?? profiles?.find((item) => item.id === existingConnection?.profile_id)
    ?? profiles?.find((item) => item.type === "pessoal")
    ?? profiles?.[0];
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
    const { data: defaultRoute } = await admin
      .from("gmail_import_routes")
      .select("id")
      .eq("user_id", data.user.id)
      .eq("is_default", true)
      .eq("active", true)
      .maybeSingle();
    if (!defaultRoute) {
      await admin.from("gmail_import_routes").upsert({
        user_id: data.user.id,
        profile_id: profile.id,
        match_label: "*",
        is_default: true,
      }, { onConflict: "user_id,profile_id,match_label" });
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
