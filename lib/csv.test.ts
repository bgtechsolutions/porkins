import { describe, expect, it } from "vitest";
import { parseTransactionsCsv } from "./csv";

describe("parseTransactionsCsv", () => {
  it("importa CSV brasileiro com ponto e vírgula", () => {
    const rows = parseTransactionsCsv(
      "Data;Descrição;Valor;Categoria;Conta\n13/07/2026;Mercado;1.234,56;Mercado;Nubank",
    );
    expect(rows).toEqual([{
      occurredAt: "2026-07-13",
      description: "Mercado",
      amount: 1234.56,
      categoryName: "Mercado",
      accountName: "Nubank",
    }]);
  });

  it("respeita campos entre aspas e cabeçalhos em inglês", () => {
    const rows = parseTransactionsCsv(
      'date,description,amount,category\n2026-07-14,"Restaurante, centro",49.90,Lazer',
    );
    expect(rows[0]).toMatchObject({ description: "Restaurante, centro", amount: 49.9 });
  });

  it("rejeita arquivo sem Data e Valor", () => {
    expect(() => parseTransactionsCsv("Descrição;Categoria\nTeste;Outros")).toThrow(/Data e Valor/);
  });

  it("identifica a linha inválida", () => {
    expect(() => parseTransactionsCsv("Data;Valor\nontem;10,00")).toThrow(/Linha 2/);
  });
});
