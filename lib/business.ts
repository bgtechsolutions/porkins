export type CalculationBase = "gross" | "net";

export function allocationTotal(companyPercentage: number, partnerPercentages: number[]) {
  return companyPercentage + partnerPercentages.reduce((sum, value) => sum + value, 0);
}

export function validateAllocation(companyPercentage: number, partnerPercentages: number[]) {
  const values = [companyPercentage, ...partnerPercentages];
  return values.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
    && Math.abs(allocationTotal(companyPercentage, partnerPercentages) - 1) < 0.00001;
}

export function distributableBase(input: {
  amount: number;
  feeAmount?: number;
  taxAmount?: number;
  directCostAmount?: number;
  calculationBase: CalculationBase;
}) {
  if (input.calculationBase === "gross") return Math.max(0, input.amount);
  return Math.max(0, input.amount - (input.feeAmount ?? 0) - (input.taxAmount ?? 0) - (input.directCostAmount ?? 0));
}

