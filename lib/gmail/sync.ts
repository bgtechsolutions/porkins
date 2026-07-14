import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "./crypto";
import { classifyCategory } from "./classifier";
import { decodeBase64Url, parseNubankTransaction } from "./parser";
import { getAccessToken, gmailFetch, startGmailWatch, type GmailConnection } from "./google";

type Header = { name: string; value: string };
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: Part & { headers?: Header[] };
};

function header(message: GmailMessage, name: string) {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function textFromPart(part?: Part): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  const children = part.parts?.map(textFromPart).filter(Boolean).join("\n") ?? "";
  if (children) return children;
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  }
  return "";
}

function trustedNubank(message: GmailMessage) {
  const from = header(message, "from").toLowerCase();
  const auth = header(message, "authentication-results").toLowerCase();
  return /@(?:[\w-]+\.)?nubank\.com\.br\b/.test(from) && /(?:dkim|spf)=pass/.test(auth) && auth.includes("nubank.com.br");
}

function keywordCategory(description: string, categories: { id: string; name: string }[]) {
  const text = description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const rules: [RegExp, string][] = [
    [/mercado|supermercado|atacadao|assai|carrefour/, "mercado"],
    [/uber|99 |posto|combustivel|shell|ipiranga/, "transporte"],
    [/netflix|spotify|amazon prime|youtube|disney/, "assinaturas"],
    [/farmacia|drogaria|hospital|clinica/, "saude"],
    [/restaurante|ifood|lanchonete|burger|pizza/, "alimentacao"],
  ];
  const wanted = rules.find(([pattern]) => pattern.test(text))?.[1];
  return categories.find((category) => category.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(wanted ?? "\0"))?.id ?? null;
}

async function importMessage(connection: GmailConnection, accessToken: string, messageId: string) {
  const admin = createAdminClient();
  const message = await gmailFetch<GmailMessage>(accessToken, `/messages/${messageId}?format=full`);
  const subject = header(message, "subject").slice(0, 240);
  const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();

  const { error: claimError } = await admin.from("email_imports").insert({
    user_id: connection.user_id,
    profile_id: connection.profile_id,
    gmail_message_id: message.id,
    subject,
    received_at: receivedAt,
  });
  if (claimError?.code === "23505") return "duplicate";
  if (claimError) throw claimError;

  try {
    if (!trustedNubank(message)) {
      await admin.from("email_imports").update({ status: "ignored", error: "Remetente não autenticado como Nubank" }).eq("gmail_message_id", message.id);
      return "ignored";
    }
    const parsed = parseNubankTransaction(subject, textFromPart(message.payload));
    if (!parsed) {
      await admin.from("email_imports").update({ status: "ignored", error: "Não é uma notificação de transação reconhecida" }).eq("gmail_message_id", message.id);
      return "ignored";
    }

    const [{ data: accounts }, { data: categories }] = await Promise.all([
      admin.from("accounts").select("id,name,kind").eq("profile_id", connection.profile_id).eq("active", true),
      admin.from("categories").select("id,name").eq("is_income", false),
    ]);
    const account = accounts?.find((item) => item.kind === parsed.accountKind && item.name.toLowerCase().includes("nubank"));
    let categoryId = keywordCategory(parsed.description, categories ?? []);
    if (!categoryId) categoryId = await classifyCategory(parsed.description, subject, categories ?? []);

    const { data: transaction, error: transactionError } = await admin.from("transactions").insert({
      profile_id: connection.profile_id,
      account_id: account?.id ?? null,
      category_id: categoryId,
      description: parsed.description,
      amount: parsed.amount,
      occurred_at: receivedAt.slice(0, 10),
      source: "email",
      needs_review: !categoryId,
      raw_text: `gmail:${message.id} | ${subject}`,
    }).select("id").single();
    if (transactionError) throw transactionError;
    await admin.from("email_imports").update({ status: "imported", transaction_id: transaction.id }).eq("gmail_message_id", message.id);
    return "imported";
  } catch (error) {
    await admin.from("email_imports").update({ status: "error", error: error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido" }).eq("gmail_message_id", message.id);
    throw error;
  }
}

export async function syncGmailConnection(connection: GmailConnection) {
  const admin = createAdminClient();
  try {
    const accessToken = await getAccessToken(decryptToken(connection.encrypted_refresh_token));
    const list = await gmailFetch<{ messages?: { id: string }[] }>(accessToken, "/messages?maxResults=100&q=from%3A%28nubank.com.br%29+newer_than%3A14d");
    const results = [];
    for (const message of list.messages ?? []) results.push(await importMessage(connection, accessToken, message.id));
    await admin.from("gmail_connections").update({ last_synced_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("user_id", connection.user_id);
    return results;
  } catch (error) {
    await admin.from("gmail_connections").update({ last_error: error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido", updated_at: new Date().toISOString() }).eq("user_id", connection.user_id);
    throw error;
  }
}

export async function renewGmailWatch(connection: GmailConnection) {
  const admin = createAdminClient();
  const accessToken = await getAccessToken(decryptToken(connection.encrypted_refresh_token));
  const watch = await startGmailWatch(accessToken);
  await admin.from("gmail_connections").update({
    last_history_id: watch.historyId,
    watch_expiration: new Date(Number(watch.expiration)).toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("user_id", connection.user_id);
  return watch;
}
