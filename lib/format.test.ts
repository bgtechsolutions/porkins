import { describe, expect, it } from "vitest";
import { parseBRL } from "./format";

describe("parseBRL", () => {
  it.each([
    ["49,95", 49.95],
    ["1.234,56", 1234.56],
    ["R$ 10,00", 10],
    ["125.50", 125.5],
    ["", 0],
    ["inválido", 0],
  ])("converte %s", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });
});
