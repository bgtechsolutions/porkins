import { describe, expect, it } from "vitest";
import { monthProgress, monthlyGoalNeed, safeToPlan, spendingPace } from "./financial-insights";

describe("financial insights", () => {
  it("does not present negative money as safe to plan", () => {
    expect(safeToPlan(3000, 2500, 800)).toBe(0);
    expect(safeToPlan(3000, 1200, 300)).toBe(1500);
  });

  it("compares spending with the progress of the month", () => {
    expect(spendingPace(400, 2000, 0.5)).toBe("on_track");
    expect(spendingPace(1400, 2000, 0.5)).toBe("attention");
    expect(spendingPace(2200, 2000, 0.9)).toBe("over");
  });

  it("calculates the monthly effort needed for a goal", () => {
    expect(monthlyGoalNeed(2000, 5000, "2026-09-30", new Date("2026-07-17T12:00:00"))).toBe(1000);
    expect(monthlyGoalNeed(5000, 5000, "2026-09-30", new Date("2026-07-17T12:00:00"))).toBeNull();
  });

  it("calculates month progress", () => {
    expect(monthProgress(new Date("2026-07-16T12:00:00"))).toBeCloseTo(16 / 31);
  });
});
