import { describe, expect, it } from "vitest";
import { addMonthsToDate, allocateInstallmentShares, splitInstallments } from "./transactions";

describe("splitInstallments", () => {
  it("distribui centavos sem alterar o total", () => {
    const parts = splitInstallments(100, 3);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100);
  });

  it("divide a parte de outro membro pelas mesmas parcelas", () => {
    expect(splitInstallments(50, 3)).toEqual([16.67, 16.67, 16.66]);
  });

  it("rejeita quantidade fora do limite", () => {
    expect(() => splitInstallments(100, 0)).toThrow();
    expect(() => splitInstallments(100, 61)).toThrow();
  });
});

describe("addMonthsToDate", () => {
  it("preserva o dia quando ele existe no mês", () => {
    expect(addMonthsToDate("2026-01-15", 2)).toBe("2026-03-15");
  });

  it("ajusta o último dia de meses curtos", () => {
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDate("2026-01-31", 2)).toBe("2026-03-31");
  });
});

describe("allocateInstallmentShares", () => {
  it("preserva o total devido ao longo das parcelas", () => {
    const result = allocateInstallmentShares([33.34, 33.33, 33.33], [{ userId: "barbara", percentage: 50 }]);
    expect(result[0].amounts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(50);
  });

  it("nunca distribui mais que o valor de cada parcela", () => {
    const result = allocateInstallmentShares([0.01], [
      { userId: "a", percentage: 50 },
      { userId: "b", percentage: 50 },
    ]);
    expect(result.flatMap((share) => share.amounts).reduce((sum, value) => sum + value, 0)).toBe(0.01);
  });
});
