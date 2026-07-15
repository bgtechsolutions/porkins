import { describe, expect, it } from "vitest";
import { parseTransactionsCsv } from "./csv";

describe("parseTransactionsCsv", () => {
  it("importa CSV brasileiro com ponto e vírgula", () => {
    const rows = parseTransactionsCsv(
      "Data;Descrição;Valor;Categoria;Conta\n13/07/2026;Mercado;1.234,56;Mercado;Nubank",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredAt: "2026-07-13",
      description: "Mercado",
      amount: 1234.56,
      categoryName: "Mercado",
      accountName: "Nubank",
      transactionType: "expense",
    });
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

  it("lê direção e identificador no extrato Nubank", () => {
    const rows = parseTransactionsCsv(
      "Data,Valor,Identificador,Descrição\n01/07/2026,-200.00,abc,Compra no débito - POSTO CARANDA\n06/07/2026,-1575.72,def,Pagamento de fatura",
      { fileName: "nubank.csv" },
    );
    expect(rows[0]).toMatchObject({ amount: 200, transactionType: "expense", externalId: "abc", categoryName: "Combustível" });
    expect(rows[1]).toMatchObject({ amount: 1575.72, transactionType: "card_payment", externalId: "def" });
  });

  it("trata entradas do Bradesco Salário como renda", () => {
    const rows = parseTransactionsCsv(
      "Extrato de: Ag: 73 | Conta: 60493-3;;;;;\nData;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)\n08/06/2026;CREDITO DE SALARIO;800073;4.666,67; ;4.666,67\n08/06/2026;PIX ENVIADO;1659555; ;4.666,67;0,00",
      { fileName: "bradesco.csv" },
    );
    expect(rows[0]).toMatchObject({ amount: 4666.67, transactionType: "income", accountName: "Bradesco Salário" });
    expect(rows[1]).toMatchObject({ amount: 4666.67, transactionType: "transfer_out" });
  });
});
