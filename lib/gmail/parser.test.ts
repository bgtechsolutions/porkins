import { describe, expect, it } from "vitest";
import { parseNubankTransaction } from "./parser";

const receivedAt = "2026-07-14T17:00:00.000Z";

describe("parseNubankTransaction", () => {
  it("identifica uma transferência enviada e o destinatário", () => {
    expect(parseNubankTransaction(
      "Transferência realizada para outra conta do Nubank",
      "A transferência para Bárbara Marcheti Fiorin, também cliente do Nubank, foi realizada com sucesso. Valor Enviado: R$ 280,00 12 JUL às 01:16",
      receivedAt,
    )).toMatchObject({
      amount: 280,
      description: "Transferência para Barbara Marcheti Fiorin",
      transactionType: "transfer_out",
      counterparty: "Barbara Marcheti Fiorin",
      occurredAt: "2026-07-12",
      needsReview: false,
    });
  });

  it("identifica uma transferência recebida na conta PJ", () => {
    expect(parseNubankTransaction(
      "Recebemos sua transferência pelo Pix",
      "Nu Empresas Transferência recebida. Recebemos sua transferência pelo Pix e o valor já está disponível. Valor recebido R$ 984,07 08 JUL às 12:15",
      receivedAt,
    )).toMatchObject({
      amount: 984.07,
      description: "Transferência recebida",
      transactionType: "transfer_in",
      accountLabel: "Nu Empresas",
      occurredAt: "2026-07-08",
    });
  });

  it("identifica Pix recebido, removendo documento do pagador", () => {
    expect(parseNubankTransaction(
      "Você recebeu uma transferência via Pix",
      "Você recebeu um Pix de 63.582.162 GABRIEL ROSSI SOARES e o valor já está disponível. Valor Recebido: R$ 750,00 08 JUL às 12:11",
      receivedAt,
    )).toMatchObject({
      amount: 750,
      description: "Pix recebido de Gabriel Rossi Soares",
      transactionType: "transfer_in",
      counterparty: "Gabriel Rossi Soares",
    });
  });

  it("identifica pagamento da fatura sem tratá-lo como novo gasto", () => {
    expect(parseNubankTransaction(
      "Pagamento de fatura realizado com sucesso",
      "Fatura paga com sucesso. O pagamento de R$ 913,19 da sua fatura foi realizado com sucesso e o limite já está disponível. 06 JUL",
      receivedAt,
    )).toMatchObject({
      amount: 913.19,
      description: "Pagamento da fatura Nubank",
      transactionType: "card_payment",
      occurredAt: "2026-07-06",
    });
  });

  it("identifica outro Pix recebido com remetente", () => {
    expect(parseNubankTransaction(
      "Pix recebido com sucesso",
      "Você recebeu um Pix de PAULO SERGIO FIORIN e o valor já está disponível. Valor Recebido: R$ 2.000,00 06 JUL às 08:21",
      receivedAt,
    )).toMatchObject({
      amount: 2000,
      description: "Pix recebido de Paulo Sergio Fiorin",
      transactionType: "transfer_in",
      counterparty: "Paulo Sergio Fiorin",
    });
  });

  it("lê compra no crédito", () => {
    expect(parseNubankTransaction(
      "Compra aprovada",
      "Compra de R$ 1.234,56 em MERCADO CENTRAL.",
      receivedAt,
    )).toMatchObject({
      amount: 1234.56,
      description: "Mercado Central",
      transactionType: "expense",
      accountKind: "credito",
    });
  });

  it("ignora e-mail promocional mesmo que tenha preço", () => {
    expect(parseNubankTransaction(
      "Novidades do Nubank",
      "Conheça nossos produtos a partir de R$ 70,00",
      receivedAt,
    )).toBeNull();
  });
});
