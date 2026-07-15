import { parseBRL } from "./format";

export type CsvTransactionType = "expense" | "income" | "transfer_out" | "transfer_in" | "card_payment";

export type CsvTransaction = {
  amount: number;
  signedAmount: number;
  description: string | null;
  occurredAt: string;
  categoryName: string | null;
  accountName: string | null;
  institution: string | null;
  transactionType: CsvTransactionType;
  counterparty: string | null;
  externalId: string | null;
  importFingerprint: string;
  rawText: string;
};

type ParseOptions = { fileName?: string };

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

const fold = (value: string | null | undefined) => (value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function parseDate(value: string): string | null {
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : null;
}

function counterpartyFrom(description: string) {
  const match = description.match(/ - (.+?) - (?:[•*.\d]|BCO |BANCO |NU PAGAMENTOS|ITA[ÚU]|COOP |CAIXA )/i);
  return match?.[1]?.replace(/&amp;/g, "&").trim() ?? null;
}

export function suggestCategoryName(description: string | null): string | null {
  const text = fold(description);
  const rules: [RegExp, string][] = [
    [/mercado|supermercado|atacadao|assai|carrefour|hortifruti|padaria/, "Mercado"],
    [/posto|combustivel|shell|ipiranga|gasolina|etanol/, "Combustível"],
    [/uber|99\b|taxi|onibus|metro|estacionamento|pedagio/, "Transporte"],
    [/netflix|spotify|prime|youtube|disney|hbo|icloud|google one/, "Assinaturas"],
    [/farmacia|drogaria/, "Farmácia"],
    [/hospital|clinica|laboratorio|medico|consulta|sabin/, "Saúde"],
    [/restaurante|ifood|lanchonete|burger|pizza|sushi|cafe|cucina|mcdonald/, "Alimentação fora"],
    [/escola|faculdade|curso|livraria|udemy|leitura/, "Educação"],
    [/aluguel|condominio|energia|internet|telefone|agua|gas\b/, "Moradia"],
    [/cinema|futebol|show|ingresso|jogo|bilhar|festa/, "Lazer / Entretenimento"],
    [/roupa|calcado|renner|riachuelo|youcom|loungerie|pijama/, "Vestuário"],
    [/cabeleireiro|depilacao|unha|beleza|estetica/, "Beleza / Cuidados"],
    [/presente|gift/, "Presentes"],
    [/panela|frigideira|tabua|tok & stok|utensilio/, "Casa / Utensílios"],
    [/audi|oficina|pneu|manutencao/, "Carro / Manutenção"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function nubankType(description: string, signedAmount: number): CsvTransactionType {
  const text = fold(description);
  if (text.includes("pagamento de fatura")) return "card_payment";
  if (/transferencia recebida|pix recebido/.test(text)) return "transfer_in";
  if (/transferencia enviada|pix enviado/.test(text)) return "transfer_out";
  if (/aplicacao|guardar dinheiro|caixinha/.test(text)) return signedAmount < 0 ? "transfer_out" : "transfer_in";
  if (/estorno|devolucao|resgate/.test(text) && signedAmount > 0) return "income";
  return signedAmount < 0 ? "expense" : "income";
}

function parseNubank(content: string, fileName: string): CsvTransaction[] {
  return content.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1).filter(Boolean).map((line, offset) => {
    // Extratos antigos possuem aspas não balanceadas no CPF mascarado. Os três
    // primeiros campos são estáveis; todo o restante pertence à descrição.
    const match = line.match(/^([^,]*),([^,]*),([^,]*),(.*)$/);
    if (!match) throw new Error(`Linha ${offset + 2}: formato Nubank inválido.`);
    const occurredAt = parseDate(match[1]);
    const signedAmount = Number(match[2]);
    const externalId = match[3].trim();
    const description = match[4].trim().replace(/^"|"$/g, "").replace(/""/g, '"').replace(/&amp;/g, "&");
    if (!occurredAt || !Number.isFinite(signedAmount) || signedAmount === 0 || !externalId) {
      throw new Error(`Linha ${offset + 2}: Data, Valor ou Identificador inválido.`);
    }
    const transactionType = nubankType(description, signedAmount);
    return {
      amount: Math.abs(signedAmount), signedAmount, description, occurredAt,
      categoryName: transactionType === "expense" ? suggestCategoryName(description) : null,
      accountName: "Nubank Débito", institution: "Nubank", transactionType,
      counterparty: counterpartyFrom(description), externalId,
      importFingerprint: `nubank:${externalId}`, rawText: `${fileName} | ${line}`,
    };
  });
}

function parseBradesco(content: string, fileName: string): CsvTransaction[] {
  return content.replace(/^\uFEFF/, "").split(/\r?\n/)
    .filter((line) => /^\d{2}\/\d{2}\/\d{4};/.test(line))
    .map((line, offset) => {
      const cells = line.split(";");
      const occurredAt = parseDate(cells[0] ?? "");
      const description = cells[1]?.trim() ?? "Movimentação Bradesco";
      const externalId = cells[2]?.trim() || null;
      const credit = parseBRL(cells[3]);
      const debit = parseBRL(cells[4]);
      const signedAmount = credit > 0 ? credit : -debit;
      if (!occurredAt || signedAmount === 0) throw new Error(`Linha Bradesco ${offset + 1}: dados inválidos.`);
      const transactionType: CsvTransactionType = signedAmount > 0 ? "income" : "transfer_out";
      const identity = [occurredAt, description, externalId, credit.toFixed(2), debit.toFixed(2)].join(":");
      return {
        amount: Math.abs(signedAmount), signedAmount, description, occurredAt,
        categoryName: transactionType === "income" ? "Salário / Renda" : null,
        accountName: "Bradesco Salário", institution: "Bradesco", transactionType,
        counterparty: transactionType === "income" ? "Fonte pagadora" : null,
        externalId, importFingerprint: `bradesco:${identity}`, rawText: `${fileName} | ${line}`,
      };
    });
}

function parseGeneric(content: string, fileName: string): CsvTransaction[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("O CSV precisa ter cabeçalho e pelo menos uma linha.");
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = splitLine(lines[0], delimiter).map(fold);
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const amountIndex = indexOf("valor", "amount");
  const dateIndex = indexOf("data", "date", "occurred_at");
  const descriptionIndex = indexOf("descricao", "description", "estabelecimento");
  const categoryIndex = indexOf("categoria", "category");
  const accountIndex = indexOf("conta", "account", "cartao");
  if (amountIndex < 0 || dateIndex < 0) throw new Error("O CSV precisa das colunas Data e Valor.");

  return lines.slice(1).map((line, offset) => {
    const cells = splitLine(line, delimiter);
    const rawAmount = parseBRL(cells[amountIndex]);
    const occurredAt = parseDate(cells[dateIndex] ?? "");
    if (rawAmount === 0 || !occurredAt) throw new Error(`Linha ${offset + 2}: Data ou Valor inválido.`);
    const description = descriptionIndex >= 0 ? cells[descriptionIndex]?.trim() || null : null;
    return {
      amount: Math.abs(rawAmount), signedAmount: -Math.abs(rawAmount), occurredAt, description,
      categoryName: categoryIndex >= 0 ? cells[categoryIndex]?.trim() || null : suggestCategoryName(description),
      accountName: accountIndex >= 0 ? cells[accountIndex]?.trim() || null : null,
      institution: null, transactionType: "expense" as const, counterparty: null, externalId: null,
      importFingerprint: `generic:${fileName}:${offset + 2}:${occurredAt}:${Math.abs(rawAmount)}:${fold(description)}`,
      rawText: `${fileName} | ${line}`,
    };
  });
}

export function parseTransactionsCsv(content: string, options: ParseOptions = {}): CsvTransaction[] {
  const fileName = options.fileName ?? "arquivo.csv";
  const normalizedHeader = fold(content.split(/\r?\n/, 1)[0]);
  if (/^data,valor,identificador,descricao/.test(normalizedHeader)) return parseNubank(content, fileName);
  if (/extrato de:|credito \(r\$\);debito \(r\$\)/.test(fold(content.slice(0, 500)))) return parseBradesco(content, fileName);
  return parseGeneric(content, fileName);
}

export function decodeCsvBytes(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}
