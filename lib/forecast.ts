export type ForecastItem = {
  date: string;
  income?: number;
  expense?: number;
};

export type ForecastMonth = {
  key: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
  accumulated: number;
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export function buildForecast(items: ForecastItem[], start = new Date(), months = 12): ForecastMonth[] {
  let accumulated = 0;
  return Array.from({ length: months }, (_, offset) => {
    const date = new Date(start.getFullYear(), start.getMonth() + offset, 1);
    const key = monthKey(date);
    const rows = items.filter((item) => item.date.slice(0, 7) === key);
    const income = rows.reduce((sum, item) => sum + Number(item.income ?? 0), 0);
    const expense = rows.reduce((sum, item) => sum + Number(item.expense ?? 0), 0);
    const balance = income - expense;
    accumulated += balance;
    return {
      key,
      label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      income,
      expense,
      balance,
      accumulated,
    };
  });
}
