export type TransactionType =
  | "expense"
  | "income"
  | "transfer_out"
  | "transfer_in"
  | "card_payment";

export type ParsedNubankTransaction = {
  amount: number;
  description: string;
  transactionType: TransactionType;
  accountKind: "credito" | "debito";
  accountLabel: string;
  counterparty: string | null;
  categoryHint: string | null;
  occurredAt: string | null;
  needsReview: boolean;
};

const compact = (value: string) =>
  value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const fold = (value: string) =>
  compact(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const money = String.raw`r\$\s*([\d.]+,\d{2})`;

function amountFrom(text: string, patterns: RegExp[]) {
  const raw = patterns.map((pattern) => text.match(pattern)?.[1]).find(Boolean);
  if (!raw) return null;
  const amount = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function cleanParty(value?: string) {
  if (!value) return null;
  const cleaned = value
    .replace(/^\d{2,3}(?:\.\d{3}){1,3}\s+/, "")
    .replace(/\s+(?:tambem )?cliente do nubank.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 2) return null;
  return cleaned
    .split(" ")
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1).toLowerCase()))
    .join(" ")
    .slice(0, 120);
}

function dateFrom(text: string, receivedAt?: string) {
  const match = text.match(/\b(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i);
  if (!match) return null;
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const month = months.indexOf(match[2].toLowerCase()) + 1;
  const received = receivedAt ? new Date(receivedAt) : new Date();
  let year = received.getUTCFullYear();
  if (month > received.getUTCMonth() + 2) year -= 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
}

function result(
  text: string,
  receivedAt: string | undefined,
  values: Omit<ParsedNubankTransaction, "accountLabel" | "occurredAt">,
): ParsedNubankTransaction {
  return {
    ...values,
    accountLabel: /nu empresas/.test(text) ? "Nu Empresas" : "Nubank",
    occurredAt: dateFrom(text, receivedAt),
  };
}

export function parseNubankTransaction(
  subject: string,
  body: string,
  receivedAt?: string,
): ParsedNubankTransaction | null {
  const text = fold(`${subject} ${body}`);

  // Pagamento de fatura movimenta dinheiro, mas não é um novo gasto: as
  // compras do cartão já foram lançadas individualmente.
  if (/fatura paga com sucesso|pagamento .* da sua fatura .* realizado com sucesso/.test(text)) {
    const amount = amountFrom(text, [
      new RegExp(String.raw`pagamento de ${money} da sua fatura`, "i"),
      new RegExp(String.raw`fatura[^.]{0,120}${money}`, "i"),
      new RegExp(money, "i"),
    ]);
    if (!amount) return null;
    return result(text, receivedAt, {
      amount,
      description: "Pagamento da fatura Nubank",
      transactionType: "card_payment",
      accountKind: "debito",
      counterparty: "Nubank",
      categoryHint: "Pagamento de fatura",
      needsReview: false,
    });
  }

  const isIncoming = /pix recebido|transferencia recebida|recebemos sua transferencia|voce recebeu um pix/.test(text);
  if (isIncoming) {
    const amount = amountFrom(text, [
      new RegExp(String.raw`valor recebido:?\s*${money}`, "i"),
      new RegExp(String.raw`recebeu (?:um )?pix de ${money}`, "i"),
      new RegExp(money, "i"),
    ]);
    if (!amount) return null;
    const party = cleanParty(
      text.match(/voce recebeu um pix de (.+?) e o valor/)?.[1] ??
      text.match(/transferencia (?:pelo pix )?de (.+?)(?: e |,| foi)/)?.[1],
    );
    return result(text, receivedAt, {
      amount,
      description: party ? `Pix recebido de ${party}` : "Transferência recebida",
      transactionType: "transfer_in",
      accountKind: "debito",
      counterparty: party,
      categoryHint: "Transferência recebida",
      needsReview: false,
    });
  }

  const isOutgoing = /transferencia realizada|pix enviado|pix realizado|pix agendado|transferencia agendada|voce fez um pix|valor enviado/.test(text);
  if (isOutgoing) {
    const amount = amountFrom(text, [
      new RegExp(String.raw`valor enviado:?\s*${money}`, "i"),
      new RegExp(String.raw`(?:pix|transferencia)[^.]{0,140}${money}`, "i"),
      new RegExp(money, "i"),
    ]);
    if (!amount) return null;
    const party = cleanParty(
      text.match(/transferencia para (.+?)(?:,| foi realizada| realizada)/)?.[1] ??
      text.match(/pix para (.+?)(?:,| foi| no valor| e )/)?.[1],
    );
    const scheduled = /agendad[ao]/.test(text);
    return result(text, receivedAt, {
      amount,
      description: party
        ? `${scheduled ? "Pix agendado para" : "Transferência para"} ${party}`
        : scheduled ? "Pix agendado" : "Transferência enviada",
      transactionType: "transfer_out",
      accountKind: "debito",
      counterparty: party,
      categoryHint: "Transferência enviada",
      needsReview: false,
    });
  }

  const isPurchase = /compra aprovada|compra no cartao|compra no debito|compra de r\$|pagamento realizado com sucesso/.test(text);
  if (isPurchase) {
    const amount = amountFrom(text, [
      new RegExp(String.raw`compra (?:de )?${money}`, "i"),
      new RegExp(String.raw`(?:valor|pagamento):?\s*${money}`, "i"),
      new RegExp(money, "i"),
    ]);
    if (!amount) return null;
    const merchant = cleanParty(
      text.match(/compra (?:de )?r\$\s*[\d.]+,\d{2}\s+(?:em|no|na)\s+(.+?)(?:\.|,| foi| no dia|$)/)?.[1] ??
      text.match(/(?:estabelecimento|comercio):?\s+(.+?)(?:\.|,| no valor|$)/)?.[1],
    );
    const credit = /cartao|credito|compra aprovada/.test(text) && !/debito/.test(text);
    return result(text, receivedAt, {
      amount,
      description: merchant ?? (credit ? "Compra no cartão Nubank" : "Compra no débito Nubank"),
      transactionType: "expense",
      accountKind: credit ? "credito" : "debito",
      counterparty: merchant,
      categoryHint: null,
      needsReview: !merchant,
    });
  }

  // E-mails promocionais e lembretes também contêm preços. Sem uma frase de
  // transação confirmada, é mais seguro ignorá-los do que criar lixo no extrato.
  return null;
}

export function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
