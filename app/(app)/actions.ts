"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_COOKIE, getContext } from "@/lib/profiles";
import { parseBRL } from "@/lib/format";
import { parseTransactionsCsv } from "@/lib/csv";
import { GOOGLE_SCOPES } from "@/lib/gmail/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { renewGmailWatch, syncGmailConnection } from "@/lib/gmail/sync";
import type { GmailConnection } from "@/lib/gmail/google";

type AppSupabase = Awaited<ReturnType<typeof createClient>>;
const TRANSACTION_TYPES = ["expense", "income", "transfer_out", "transfer_in", "card_payment"] as const;

function transactionType(value: FormDataEntryValue | null) {
  const type = String(value ?? "expense");
  return TRANSACTION_TYPES.includes(type as (typeof TRANSACTION_TYPES)[number]) ? type : "expense";
}

function fail(message: string): never {
  throw new Error(message);
}

function check(error: { message: string } | null, context: string) {
  if (error) fail(`${context}: ${error.message}`);
}

async function requireProfile(profileId: string): Promise<AppSupabase> {
  if (!profileId) fail("Perfil não informado.");
  const { supabase, profiles } = await getContext();
  if (!profiles.some((profile) => profile.id === profileId)) fail("Acesso negado a este perfil.");
  return supabase;
}

async function requireOwnedRow(
  table: "transactions" | "income_sources" | "goals" | "house_products" | "house_costs",
  id: string,
) {
  const { supabase, profiles } = await getContext();
  const { data, error } = await supabase.from(table).select("profile_id").eq("id", id).single();
  check(error, "Não foi possível validar o registro");
  if (!data || !profiles.some((profile) => profile.id === data.profile_id)) fail("Acesso negado ao registro.");
  return supabase;
}

export async function switchProfile(formData: FormData) {
  const id = String(formData.get("profileId") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");
  await requireProfile(id);
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
  const profile_id = String(formData.get("profile_id") ?? "");
  const supabase = await requireProfile(profile_id);
  const { userId } = await getContext();
  const amount = parseBRL(formData.get("amount"));
  if (amount <= 0) fail("Informe um valor maior que zero.");
  const description = String(formData.get("description") ?? "").trim() || null;
  const category_id = String(formData.get("category_id") ?? "") || null;
  const account_id = String(formData.get("account_id") ?? "") || null;
  const txnType = transactionType(formData.get("transaction_type"));
  const occurred_at =
    String(formData.get("occurred_at") ?? "") ||
    new Date().toISOString().slice(0, 10);

  const { data: transaction, error } = await supabase.from("transactions").insert({
    profile_id,
    amount,
    description,
    category_id,
    account_id,
    transaction_type: txnType,
    occurred_at,
    source: "manual",
    paid_by_user_id: userId,
    needs_review: txnType === "expense" && !category_id,
  }).select("id").single();
  check(error, "Não foi possível salvar o gasto");
  if (!transaction) fail("O lançamento não foi retornado após ser salvo.");
  await saveTransactionSplit(supabase, transaction.id, profile_id, userId, amount, formData);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateTransaction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await requireOwnedRow("transactions", id);
  const { userId } = await getContext();
  const { data: ownedTransaction, error: ownedError } = await supabase
    .from("transactions").select("profile_id,paid_by_user_id").eq("id", id).single();
  check(ownedError, "Não foi possível validar o lançamento");
  if (!ownedTransaction) fail("Lançamento não encontrado.");
  const category_id = String(formData.get("category_id") ?? "") || null;
  const txnType = transactionType(formData.get("transaction_type"));
  const { error } = await supabase
    .from("transactions")
    .update({
      amount: parseBRL(formData.get("amount")),
      description: String(formData.get("description") ?? "").trim() || null,
      category_id,
      transaction_type: txnType,
      occurred_at: String(formData.get("occurred_at") ?? "") || undefined,
      needs_review: txnType === "expense" && !category_id,
    })
    .eq("id", id);
  check(error, "Não foi possível atualizar o lançamento");
  const { error: clearSplitError } = await supabase.from("transaction_splits").delete().eq("transaction_id", id);
  check(clearSplitError, "Não foi possível atualizar a divisão");
  await saveTransactionSplit(
    supabase, id, ownedTransaction.profile_id, ownedTransaction.paid_by_user_id ?? userId,
    parseBRL(formData.get("amount")), formData,
  );
  revalidatePath("/extrato");
  revalidatePath("/dashboard");
}

async function saveTransactionSplit(
  supabase: AppSupabase,
  transactionId: string,
  profileId: string,
  payerUserId: string,
  totalAmount: number,
  formData: FormData,
) {
  const debtorUserId = String(formData.get("debtor_user_id") ?? "");
  const splitAmount = parseBRL(formData.get("split_amount"));
  if (!debtorUserId && splitAmount <= 0) return;
  if (!debtorUserId || splitAmount <= 0) fail("Escolha a pessoa e informe quanto ela deve pagar.");
  if (debtorUserId === payerUserId) fail("Escolha outro membro para dividir o gasto.");
  if (splitAmount > totalAmount) fail("A parte da outra pessoa não pode ser maior que o total.");
  const { data: member } = await supabase.from("profile_members")
    .select("user_id").eq("profile_id", profileId).eq("user_id", debtorUserId).maybeSingle();
  if (!member) fail("A pessoa escolhida não faz parte deste espaço.");
  const { error } = await supabase.from("transaction_splits").insert({
    transaction_id: transactionId,
    profile_id: profileId,
    debtor_user_id: debtorUserId,
    amount: splitAmount,
    status: "pending",
  });
  check(error, "Não foi possível dividir o lançamento");
}

export async function markTransactionSplitPaid(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "paid") === "pending" ? "pending" : "paid";
  const { supabase } = await getContext();
  const { error } = await supabase.from("transaction_splits").update({
    status,
    settled_at: status === "paid" ? new Date().toISOString() : null,
  }).eq("id", id);
  check(error, "Não foi possível atualizar o acerto");
  revalidatePath("/extrato");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await requireOwnedRow("transactions", id);
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  check(error, "Não foi possível excluir o lançamento");
  revalidatePath("/extrato");
  revalidatePath("/dashboard");
}

export async function addContribution(formData: FormData) {
  const goal_id = String(formData.get("goal_id") ?? "");
  const amount = parseBRL(formData.get("amount"));
  if (!goal_id || amount <= 0) fail("Informe um aporte maior que zero.");
  const supabase = await requireOwnedRow("goals", goal_id);
  const { error } = await supabase.rpc("fn_add_contribution", { p_goal_id: goal_id, p_amount: amount });
  check(error, "Não foi possível registrar o aporte");

  revalidatePath("/caixinhas");
  revalidatePath("/dashboard");
}

export async function updateIncome(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const amount = parseBRL(formData.get("amount"));
  if (!id) return;
  const supabase = await requireOwnedRow("income_sources", id);
  const { error } = await supabase.from("income_sources").update({ amount }).eq("id", id);
  check(error, "Não foi possível atualizar a renda");
  revalidatePath("/renda");
  revalidatePath("/dashboard");
}

export async function addIncome(formData: FormData) {
  const profile_id = String(formData.get("profile_id") ?? "");
  const supabase = await requireProfile(profile_id);
  const name = String(formData.get("name") ?? "").trim();
  const amount = parseBRL(formData.get("amount"));
  if (!profile_id || !name) return;
  const { error } = await supabase.from("income_sources").insert({ profile_id, name, amount, kind: "salario" });
  check(error, "Não foi possível adicionar a renda");
  revalidatePath("/renda");
  revalidatePath("/dashboard");
}

export async function deleteIncome(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await requireOwnedRow("income_sources", id);
  const { error } = await supabase.from("income_sources").delete().eq("id", id);
  check(error, "Não foi possível remover a renda");
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
  const { error } = await supabase
    .from("allocation_rules")
    .update({ percentage: pct })
    .eq("profile_id", profile_id)
    .eq("bucket", bucket);
  check(error, "Não foi possível atualizar a regra");
}

export async function setProfileType(formData: FormData) {
  const profile_id = String(formData.get("profile_id") ?? "");
  const supabase = await requireProfile(profile_id);
  const requestedType = String(formData.get("type") ?? "razoavel");
  const type = requestedType in PROFILE_PRESETS ? requestedType : "razoavel";
  const preset = PROFILE_PRESETS[type];
  if (!profile_id) return;
  const { error } = await supabase.from("profiles").update({ profile_type: type }).eq("id", profile_id);
  check(error, "Não foi possível atualizar o perfil");
  await setBucket(supabase, profile_id, "obrigatoria", preset.obrigatoria);
  await setBucket(supabase, profile_id, "nao_obrig", preset.nao_obrig);
  await setBucket(supabase, profile_id, "investimento", preset.investimento);
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
}

export async function updateAllocations(formData: FormData) {
  const profile_id = String(formData.get("profile_id") ?? "");
  if (!profile_id) return;
  const supabase = await requireProfile(profile_id);
  const o = Number(formData.get("obrigatoria") ?? 0) / 100;
  const n = Number(formData.get("nao_obrig") ?? 0) / 100;
  const i = Number(formData.get("investimento") ?? 0) / 100;
  if ([o, n, i].some((value) => !Number.isFinite(value) || value < 0 || value > 1)) fail("Percentuais inválidos.");
  const { error } = await supabase.from("profiles").update({ profile_type: "personalizado" }).eq("id", profile_id);
  check(error, "Não foi possível atualizar o perfil");
  await setBucket(supabase, profile_id, "obrigatoria", o);
  await setBucket(supabase, profile_id, "nao_obrig", n);
  await setBucket(supabase, profile_id, "investimento", i);
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
}

export async function markProductBought(formData: FormData) {
  const id = String(formData.get("product_id") ?? "");
  const real_value = parseBRL(formData.get("real_value"));
  if (!id) return;
  const supabase = await requireOwnedRow("house_products", id);
  const { error } = await supabase
    .from("house_products")
    .update({ status: "comprado", real_value })
    .eq("id", id);
  check(error, "Não foi possível marcar o produto");
  revalidatePath("/casa/compras");
  revalidatePath("/dashboard");
}

export async function toggleBillPaid(formData: FormData) {
  const cost_id = String(formData.get("cost_id") ?? "");
  const profile_id = String(formData.get("profile_id") ?? "");
  const ym = String(formData.get("ym") ?? "");
  const isPaid = String(formData.get("is_paid") ?? "") === "1";
  if (!cost_id || !ym) return;
  const supabase = await requireOwnedRow("house_costs", cost_id);
  await requireProfile(profile_id);
  const { data: cost, error: costError } = await supabase.from("house_costs").select("profile_id").eq("id", cost_id).single();
  check(costError, "Não foi possível validar a conta");
  if (cost?.profile_id !== profile_id) fail("A conta não pertence ao perfil informado.");

  if (isPaid) {
    const { error } = await supabase
      .from("house_bill_payments")
      .delete()
      .eq("cost_id", cost_id)
      .eq("ym", ym);
    check(error, "Não foi possível reabrir a conta");
  } else {
    const { error } = await supabase
      .from("house_bill_payments")
      .insert({ cost_id, profile_id, ym });
    check(error, "Não foi possível marcar a conta como paga");
  }
  revalidatePath("/casa/contas");
}

export async function importTransactionsCsv(formData: FormData) {
  const profileId = String(formData.get("profile_id") ?? "");
  const supabase = await requireProfile(profileId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) fail("Selecione um arquivo CSV.");
  if (file.size > 1024 * 1024) fail("O CSV deve ter no máximo 1 MB.");

  const rows = parseTransactionsCsv(await file.text());
  if (rows.length > 500) fail("Importe no máximo 500 lançamentos por vez.");

  const [{ data: categories, error: categoryError }, { data: accounts, error: accountError }] = await Promise.all([
    supabase.from("categories").select("id,name").eq("is_income", false),
    supabase.from("accounts").select("id,name").eq("profile_id", profileId),
  ]);
  check(categoryError, "Não foi possível carregar as categorias");
  check(accountError, "Não foi possível carregar as contas");
  const key = (value: string | null) => value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() ?? "";
  const categoryMap = new Map((categories ?? []).map((item) => [key(item.name), item.id]));
  const accountMap = new Map((accounts ?? []).map((item) => [key(item.name), item.id]));
  const payload = rows.map((row) => {
    const categoryId = categoryMap.get(key(row.categoryName)) ?? null;
    return {
      profile_id: profileId,
      amount: row.amount,
      description: row.description,
      occurred_at: row.occurredAt,
      category_id: categoryId,
      account_id: accountMap.get(key(row.accountName)) ?? null,
      source: "csv" as const,
      needs_review: !categoryId,
      raw_text: null,
    };
  });
  const { error } = await supabase.from("transactions").insert(payload);
  check(error, "Não foi possível importar o CSV");
  revalidatePath("/dashboard");
  revalidatePath("/extrato");
  redirect(`/extrato?importados=${payload.length}`);
}

export async function addGoal(formData: FormData) {
  const profileId = String(formData.get("profile_id") ?? "");
  const supabase = await requireProfile(profileId);
  const name = String(formData.get("name") ?? "").trim();
  const targetAmount = parseBRL(formData.get("target_amount"));
  if (!name || targetAmount <= 0) fail("Informe o nome e uma meta maior que zero.");
  const deadline = String(formData.get("deadline") ?? "") || null;
  const priority = String(formData.get("priority") ?? "media");
  const kind = String(formData.get("kind") ?? "curto_prazo");
  const weight = priority === "alta" ? 3 : priority === "baixa" ? 1 : 2;
  const { error } = await supabase.from("goals").insert({
    profile_id: profileId,
    name,
    target_amount: targetAmount,
    deadline,
    priority,
    kind,
    weight,
  });
  check(error, "Não foi possível criar a caixinha");
  revalidatePath("/caixinhas");
  revalidatePath("/dashboard");
}

export async function updateGoal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await requireOwnedRow("goals", id);
  const name = String(formData.get("name") ?? "").trim();
  const targetAmount = parseBRL(formData.get("target_amount"));
  if (!name || targetAmount <= 0) fail("Dados inválidos para a caixinha.");
  const priority = String(formData.get("priority") ?? "media");
  const { error } = await supabase.from("goals").update({
    name,
    target_amount: targetAmount,
    deadline: String(formData.get("deadline") ?? "") || null,
    priority,
    kind: String(formData.get("kind") ?? "curto_prazo"),
    weight: priority === "alta" ? 3 : priority === "baixa" ? 1 : 2,
    status: String(formData.get("status") ?? "em_andamento"),
  }).eq("id", id);
  check(error, "Não foi possível atualizar a caixinha");
  revalidatePath("/caixinhas");
  revalidatePath("/dashboard");
}

export async function deleteGoal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await requireOwnedRow("goals", id);
  const { error } = await supabase.from("goals").delete().eq("id", id);
  check(error, "Não foi possível excluir a caixinha");
  revalidatePath("/caixinhas");
  revalidatePath("/dashboard");
}

export async function addHouseProduct(formData: FormData) {
  const profileId = String(formData.get("profile_id") ?? "");
  const supabase = await requireProfile(profileId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail("Informe o nome do produto.");
  const { error } = await supabase.from("house_products").insert({
    profile_id: profileId,
    name,
    category: String(formData.get("category") ?? "").trim() || null,
    planned_month: String(formData.get("planned_month") ?? "") || null,
    priority: Number(formData.get("priority") ?? 0) || null,
    budget_base: parseBRL(formData.get("budget_base")) || null,
    ideal_qty: String(formData.get("ideal_qty") ?? "").trim() || null,
  });
  check(error, "Não foi possível adicionar o produto");
  revalidatePath("/casa/compras");
  revalidatePath("/dashboard");
}

export async function deleteHouseProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await requireOwnedRow("house_products", id);
  const { error } = await supabase.from("house_products").delete().eq("id", id);
  check(error, "Não foi possível excluir o produto");
  revalidatePath("/casa/compras");
  revalidatePath("/dashboard");
}

export async function addHouseCost(formData: FormData) {
  const profileId = String(formData.get("profile_id") ?? "");
  const supabase = await requireProfile(profileId);
  const name = String(formData.get("name") ?? "").trim();
  const expectedValue = parseBRL(formData.get("expected_value"));
  if (!name || expectedValue <= 0) fail("Informe o nome e um valor maior que zero.");
  const barbaraPct = Number(formData.get("barbara_pct") ?? 63.41) / 100;
  if (!Number.isFinite(barbaraPct) || barbaraPct < 0 || barbaraPct > 1) fail("Rateio inválido.");
  const { error } = await supabase.from("house_costs").insert({
    profile_id: profileId,
    name,
    cost_type: String(formData.get("cost_type") ?? "recorrente"),
    expected_value: expectedValue,
    barbara_pct: barbaraPct,
    gabriel_pct: 1 - barbaraPct,
    buy_when: String(formData.get("buy_when") ?? "").trim() || null,
  });
  check(error, "Não foi possível adicionar o custo");
  revalidatePath("/casa/contas");
  revalidatePath("/dashboard");
}

export async function deleteHouseCost(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await requireOwnedRow("house_costs", id);
  const { error } = await supabase.from("house_costs").delete().eq("id", id);
  check(error, "Não foi possível excluir o custo");
  revalidatePath("/casa/contas");
  revalidatePath("/dashboard");
}

export async function changePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 12) fail("A nova senha deve ter pelo menos 12 caracteres.");
  if (password !== confirmation) fail("As senhas não coincidem.");
  const { supabase } = await getContext();
  const { error } = await supabase.auth.updateUser({ password });
  check(error, "Não foi possível alterar a senha");
  redirect("/perfil?senha=ok");
}

export async function connectGmail() {
  const { supabase, active } = await getContext();
  const headerStore = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? headerStore.get("origin") ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/perfil?gmail=connected")}&profile=${encodeURIComponent(active?.id ?? "")}`,
      scopes: GOOGLE_SCOPES,
      queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    },
  });
  if (error || !data.url) fail(`Não foi possível conectar o Gmail: ${error?.message ?? "URL ausente"}`);
  redirect(data.url);
}

export async function syncGmailNow() {
  const { userId } = await getContext();
  const admin = createAdminClient();
  const { data, error } = await admin.from("gmail_connections").select("*").eq("user_id", userId).single();
  check(error, "Gmail ainda não conectado");
  await renewGmailWatch(data as GmailConnection);
  await syncGmailConnection(data as GmailConnection);
  revalidatePath("/perfil");
  revalidatePath("/extrato");
  revalidatePath("/dashboard");
  redirect("/perfil?gmail=synced");
}

export async function reprocessGmailNow() {
  const { userId } = await getContext();
  const admin = createAdminClient();
  const [{ data: connection, error }, { data: imports }] = await Promise.all([
    admin.from("gmail_connections").select("*").eq("user_id", userId).single(),
    admin.from("email_imports").select("transaction_id").eq("user_id", userId),
  ]);
  check(error, "Gmail ainda não conectado");
  const transactionIds = (imports ?? []).map((item) => item.transaction_id).filter(Boolean) as string[];
  if (transactionIds.length) {
    const { error: deleteTransactionsError } = await admin.from("transactions").delete().in("id", transactionIds);
    check(deleteTransactionsError, "Não foi possível remover os lançamentos antigos");
  }
  const { error: deleteImportsError } = await admin.from("email_imports").delete().eq("user_id", userId);
  check(deleteImportsError, "Não foi possível preparar a releitura dos e-mails");
  await renewGmailWatch(connection as GmailConnection);
  await syncGmailConnection(connection as GmailConnection);
  revalidatePath("/perfil");
  revalidatePath("/extrato");
  revalidatePath("/dashboard");
  redirect("/perfil?gmail=reprocessed");
}

export async function createFinancialSpace(formData: FormData) {
  const { supabase } = await getContext();
  const name = String(formData.get("name") ?? "").trim();
  const contextType = String(formData.get("context_type") ?? "household");
  if (!name) fail("Informe o nome do espaço.");
  const { data, error } = await supabase.rpc("fn_create_profile", {
    p_name: name,
    p_context_type: contextType,
    p_color: String(formData.get("color") ?? "#7c3aed"),
  });
  check(error, "Não foi possível criar o espaço");
  if (data) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_COOKIE, String(data), { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  revalidatePath("/perfil");
  redirect("/perfil?secao=espacos&espaco=created");
}

export async function inviteProfileMember(formData: FormData) {
  const profileId = String(formData.get("profile_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const supabase = await requireProfile(profileId);
  if (!email) fail("Informe o e-mail do novo membro.");
  const { data, error } = await supabase.rpc("fn_invite_profile_member", {
    p_profile_id: profileId,
    p_email: email,
  });
  check(error, "Não foi possível adicionar o membro");
  revalidatePath("/perfil");
  redirect(`/perfil?secao=espacos&membro=${data === "added" ? "added" : "invited"}`);
}

export async function addFinancialAccount(formData: FormData) {
  const profileId = String(formData.get("profile_id") ?? "");
  const supabase = await requireProfile(profileId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail("Informe o nome da conta.");
  const aliases = String(formData.get("email_aliases") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const { error } = await supabase.from("accounts").insert({
    profile_id: profileId,
    name,
    kind: String(formData.get("kind") ?? "conta"),
    institution: String(formData.get("institution") ?? "").trim() || null,
    ownership: String(formData.get("ownership") ?? "personal"),
    email_aliases: aliases,
  });
  check(error, "Não foi possível adicionar a conta");
  revalidatePath("/perfil");
  redirect("/perfil?secao=espacos&conta=created");
}

export async function saveGmailRoute(formData: FormData) {
  const profileId = String(formData.get("profile_id") ?? "");
  const { userId } = await getContext();
  const supabase = await requireProfile(profileId);
  const isDefault = String(formData.get("is_default") ?? "") === "1";
  const matchLabel = isDefault ? "*" : String(formData.get("match_label") ?? "").trim();
  if (!matchLabel) fail("Informe como a conta aparece no e-mail.");
  if (isDefault) {
    const { error } = await supabase.from("gmail_import_routes").update({ is_default: false }).eq("user_id", userId);
    check(error, "Não foi possível alterar a rota padrão");
  }
  const { error } = await supabase.from("gmail_import_routes").upsert({
    user_id: userId,
    profile_id: profileId,
    account_id: String(formData.get("account_id") ?? "") || null,
    match_label: matchLabel,
    is_default: isDefault,
    priority: Number(formData.get("priority") ?? 100),
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,profile_id,match_label" });
  check(error, "Não foi possível salvar a regra de importação");
  revalidatePath("/perfil");
  redirect("/perfil?secao=espacos&rota=saved");
}

export async function deleteGmailRoute(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { userId, supabase } = await getContext();
  const { error } = await supabase.from("gmail_import_routes").delete().eq("id", id).eq("user_id", userId);
  check(error, "Não foi possível excluir a regra");
  revalidatePath("/perfil");
}
