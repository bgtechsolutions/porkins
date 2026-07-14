export type ParsedNubankTransaction = {
  amount: number;
  description: string;
  accountKind: "credito" | "debito";
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function parseNubankTransaction(subject: string, body: string): ParsedNubankTransaction | null {
  const text = normalize(`${subject} ${body}`);
  const amountMatch = text.match(/R\$\s*([\d.]+,\d{2})/i);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const isCredit = /cartao|credito|compra aprovada/i.test(text);
  const merchantPatterns = [
    /(?:compra (?:de )?R\$\s*[\d.]+,\d{2}\s+(?:em|no|na)\s+)([^.!\n]+)/i,
    /(?:estabelecimento[:\s]+)([^.!\n]+)/i,
    /(?:em|no|na)\s+([^.!\n]{2,80})(?:\.|,| foi| no valor|$)/i,
  ];
  const merchant = merchantPatterns.map((pattern) => text.match(pattern)?.[1]?.trim()).find(Boolean);
  const description = merchant?.slice(0, 120) || (isCredit ? "Compra no cartão Nubank" : "Transação Nubank");

  return { amount, description, accountKind: isCredit ? "credito" : "debito" };
}

export function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

