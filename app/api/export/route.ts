import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const profileId = new URL(request.url).searchParams.get("profile");
  if (!profileId) return NextResponse.json({ error: "Perfil não informado" }, { status: 400 });
  const [{ data: profile }, { data: transactions }, { data: goals }, { data: accounts }, { data: assets }] = await Promise.all([
    supabase.from("profiles").select("id,name,context_type,created_at").eq("id", profileId).single(),
    supabase.from("transactions").select("id,amount,description,occurred_at,transaction_type,status,source,installment_number,installment_count").eq("profile_id", profileId).order("occurred_at"),
    supabase.from("goals").select("id,name,target_amount,current_amount,deadline,status").eq("profile_id", profileId),
    supabase.from("accounts").select("id,name,kind,institution,ownership").eq("profile_id", profileId),
    supabase.from("financial_assets").select("id,name,asset_type,current_value,liability_balance,ownership_percentage,notes").eq("profile_id", profileId),
  ]);
  if (!profile) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), profile, transactions, goals, accounts, assets }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="porkins-${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json"` },
  });
}
