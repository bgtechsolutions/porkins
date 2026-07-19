import { describe, expect, it } from "vitest";
import { buildForecast } from "./forecast";

describe("buildForecast", () => {
  it("soma entradas, saidas e acumulado por mes", () => {
    const rows = buildForecast([
      { date: "2026-07-01", income: 3000 },
      { date: "2026-07-12", expense: 1200 },
      { date: "2026-08-01", expense: 500 },
    ], new Date(2026, 6, 1), 2);
    expect(rows[0]).toMatchObject({ income: 3000, expense: 1200, balance: 1800, accumulated: 1800 });
    expect(rows[1]).toMatchObject({ income: 0, expense: 500, balance: -500, accumulated: 1300 });
  });
});
