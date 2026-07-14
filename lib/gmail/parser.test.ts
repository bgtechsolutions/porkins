import { describe, expect, it } from "vitest";
import { parseNubankTransaction } from "./parser";

describe("parseNubankTransaction", () => {
  it("lê compra no crédito", () => {
    expect(parseNubankTransaction("Compra aprovada", "Compra de R$ 1.234,56 em MERCADO CENTRAL."))
      .toEqual({ amount: 1234.56, description: "MERCADO CENTRAL", accountKind: "credito" });
  });

  it("rejeita e-mail sem valor", () => {
    expect(parseNubankTransaction("Novidades do Nubank", "Conheça nossos produtos")).toBeNull();
  });
});
