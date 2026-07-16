import { describe, expect, it } from "vitest";
import { distributableBase, validateAllocation } from "./business";

describe("business allocation", () => {
  it("aceita empresa 40%, Gabriel 50% e Bárbara 10%", () => {
    expect(validateAllocation(0.4, [0.5, 0.1])).toBe(true);
  });
  it("recusa percentuais que não somam 100%", () => {
    expect(validateAllocation(0.4, [0.3, 0.1])).toBe(false);
  });
  it("separa base bruta e líquida", () => {
    const input = { amount: 1000, feeAmount: 50, taxAmount: 100, directCostAmount: 25 };
    expect(distributableBase({ ...input, calculationBase: "gross" })).toBe(1000);
    expect(distributableBase({ ...input, calculationBase: "net" })).toBe(825);
  });
});
