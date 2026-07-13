"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_COOKIE } from "@/lib/profiles";

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
  const amount = Number(formData.get("amount") ?? 0);
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

export async function addContribution(formData: FormData) {
  const supabase = await createClient();
  const goal_id = String(formData.get("goal_id") ?? "");
  const profile_id = String(formData.get("profile_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
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

export async function markProductBought(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("product_id") ?? "");
  const real_value = Number(formData.get("real_value") ?? 0);
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
