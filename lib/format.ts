export const brl = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(n ?? 0),
  );

export const pct = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));

/** Converte valor digitado no formato BR ("49,95", "1.234,56", "R$ 10") em número. */
export function parseBRL(v: unknown): number {
  let s = String(v ?? "").trim().replace(/\s/g, "").replace(/r\$/i, "");
  if (s === "") return 0;
  if (s.includes(",")) {
    // vírgula = decimal; pontos = milhar
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
