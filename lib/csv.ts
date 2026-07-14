import { parseBRL } from "./format";

export type CsvTransaction = {
  amount: number;
  description: string | null;
  occurredAt: string;
  categoryName: string | null;
  accountName: string | null;
};

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
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseDate(value: string): string | null {
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

export function parseTransactionsCsv(content: string): CsvTransaction[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("O CSV precisa ter cabeçalho e pelo menos uma linha.");
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = splitLine(lines[0], delimiter).map(normalize);
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const amountIndex = indexOf("valor", "amount");
  const dateIndex = indexOf("data", "date", "occurred_at");
  const descriptionIndex = indexOf("descricao", "description", "estabelecimento");
  const categoryIndex = indexOf("categoria", "category");
  const accountIndex = indexOf("conta", "account", "cartao");
  if (amountIndex < 0 || dateIndex < 0) throw new Error("O CSV precisa das colunas Data e Valor.");

  return lines.slice(1).map((line, offset) => {
    const cells = splitLine(line, delimiter);
    const amount = parseBRL(cells[amountIndex]);
    const occurredAt = parseDate(cells[dateIndex] ?? "");
    if (amount <= 0 || !occurredAt) throw new Error(`Linha ${offset + 2}: Data ou Valor inválido.`);
    return {
      amount,
      occurredAt,
      description: descriptionIndex >= 0 ? cells[descriptionIndex]?.trim() || null : null,
      categoryName: categoryIndex >= 0 ? cells[categoryIndex]?.trim() || null : null,
      accountName: accountIndex >= 0 ? cells[accountIndex]?.trim() || null : null,
    };
  });
}
