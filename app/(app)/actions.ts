"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_COOKIE } from "@/lib/profiles";
import { parseBRL } from "@/lib/format";

export async function switchProfile(formData: FormData) {
  const id = String(formData.get("profileId") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function addTransaction(formData: FormData) {
  const supabase = await createClient();
  const profile_id = String(formData.get("profile_id") ?? "");
  const amount = parseBRL(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim() || null;
  const category_id = String(formData.get("category_id") ?? "") || null;
  const account_id = String(formData.get("account_id") ?? "") || null;
  const occurred_at =
    String(formData.get("occurred_at") ?? "") ||
    new Date().toISOString().slice(0, 10);

  await supabase.from("transactions").insert({
    profile_id,
    amount,
    description,
    category_id,
    account_id,
    occurred_at,
    source: "manual",
    needs_review: !category_id,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateTransaction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const category_id = String(formData.get("category_id") ?? "") || null;
  await supabase
    .from("transactions")
    .update({
      amount: parseBRL(formData.get("amount")),
      description: String(formData.get("description") ?? "").trim() || null,
      category_id,
      occurred_at: String(formData.get("occurred_at") ?? "") || undefined,
      needs_review: !category_id,
    })
    .eq("id", id);
  revalidatePath("/extrato");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/extrato");
  revalidatePath("/dashboard");
}

export async function addContribution(formData: FormData) {
  const supabase = await createClient();
  const goal_id = String(formData.get("goal_id") ?? "");
  const profile_id = String(formData.get("profile_id") ?? "");
  const amount = parseBRL(formData.get("amount"));
  if (!goal_id || !amount) return;

  const { data: goal } = await supabase
    .from("goals")
    .select("current_amount")
    .eq("id", goal_id)
    .single();

  await supabase.from("contributions").insert({ goal_id, profile_id, amount });
  await supabase
    .from("goals")
    .update({ current_amount: Number(goal?.current_amount ?? 0) + amount })
    .eq("id", goal_id);

  revalidatePath("/caixinhas");
  revalidatePath("/dashboard");
}

export async function updateIncome(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const amount = parseBRL(formData.get("amount"));
  if (!id) return;
  await supabase.from("income_sources").update({ amount }).eq("id", id);
  revalidatePath("/renda");
  revalidatePath("/dashboard");
}

export async function addIncome(formData: FormData) {
  const supabase = await createClient();
  const profile_id = String(formData.get("profile_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = parseBRL(formData.get("amount"));
  if (!profile_id || !name) return;
  await supabase.from("income_sources").insert({ profile_id, name, amount, kind: "salario" });
  revalidatePath("/renda");
  revalidatePath("/dashboard");
}

export async function deleteIncome(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("income_sources").delete().eq("id", id);
  revalidatePath("/renda");
  revalidatePath("/dashboard");
}

const PROFILE_PRESETS: Record<string, { obrigatoria: number; nao_obrig: number; investimento: number }> = {
  // Tetos de despesa; investimento é o "pague-se primeiro" (pode passar).
  razoavel: { obrigatoria: 0.6, nao_obrig: 0.3, investimento: 0.1 },
  moderado: { obrigatoria: 0.55, nao_obrig: 0.25, investimento: 0.2 },
  investidor: { obrigatoria: 0.5, nao_obrig: 0.2, investimento: 0.3 },
};

async function setBucket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile_id: string,
  bucket: string,
  pct: number,
) {
  await supabase
    .from("allocation_rules")
    .update({ percentage: pct })
    .eq("profile_id", profile_id)
    .eq("bucket", bucket);
}

export async function setProfileType(formData: FormData) {
  const supabase = await createClient();
  const profile_id = String(formData.get("profile_id") ?? "");
  const type = String(formData.get("type") ?? "razoavel");
  const preset = PROFILE_PRESETS[type] ?? PROFILE_PRESETS.razoavel;
  if (!profile_id) return;
  await supabase.from("profiles").update({ profile_type: type }).eq("id", profile_id);
  await setBucket(supabase, profile_id, "obrigatoria", preset.obrigatoria);
  await setBucket(supabase, profile_id, "nao_obrig", preset.nao_obrig);
  await setBucket(supabase, profile_id, "investimento", preset.investimento);
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
}

export async function updateAllocations(formData: FormData) {
  const supabase = await createClient();
  const profile_id = String(formData.get("profile_id") ?? "");
  if (!profile_id) return;
  const o = Number(formData.get("obrigatoria") ?? 0) / 100;
  const n = Number(formData.get("nao_obrig") ?? 0) / 100;
  const i = Number(formData.get("investimento") ?? 0) / 100;
  await supabase.from("profiles").update({ profile_type: "personalizado" }).eq("id", profile_id);
  await setBucket(supabase, profile_id, "obrigatoria", o);
  await setBucket(supabase, profile_id, "nao_obrig", n);
  await setBucket(supabase, profile_id, "investimento", i);
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
}

export async function markProductBought(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("product_id") ?? "");
  const real_value = parseBRL(formData.get("real_value"));
  if (!id) return;
  await supabase
    .from("house_products")
    .update({ status: "comprado", real_value })
    .eq("id", id);
  revalidatePath("/casa/compras");
  revalidatePath("/dashboard");
}

export async function toggleBillPaid(formData: FormData) {
  const supabase = await createClient();
  const cost_id = String(formData.get("cost_id") ?? "");
  const profile_id = String(formData.get("profile_id") ?? "");
  const ym = String(formData.get("ym") ?? "");
  const isPaid = String(formData.get("is_paid") ?? "") === "1";
  if (!cost_id || !ym) return;

  if (isPaid) {
    await supabase
      .from("house_bill_payments")
      .delete()
      .eq("cost_id", cost_id)
      .eq("ym", ym);
  } else {
    await supabase
      .from("house_bill_payments")
      .insert({ cost_id, profile_id, ym });
  }
  revalidatePath("/casa/contas");
}
