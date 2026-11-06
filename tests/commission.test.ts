import { describe, expect, it } from "vitest";
import { MAX_CENTS, commissionCents, decimalToInteger } from "@/lib/domain";

describe("commission snapshot: integer cents, basis points, half-up rounding", () => {
  it.each([
    [100_000, 500, 5_000],
    [10_005, 1000, 1001],
    [1, 5000, 1],
    [1, 4999, 0],
    [0, 10000, 0],
    [MAX_CENTS, 10000, MAX_CENTS],
    [MAX_CENTS, 0, 0],
  ])("%i cents × %i bps = %i cents", (amount, rate, expected) => {
    expect(commissionCents(amount, rate)).toBe(expected);
  });
  it.each([
    [-1, 500],
    [MAX_CENTS + 1, 500],
    [1.2, 100],
    [100, -1],
    [100, 10001],
    [100, 1.5],
    [NaN, 10],
    [100, Infinity],
  ])("rejects invalid input %s, %s", (amount, rate) => {
    expect(() => commissionCents(amount, rate)).toThrow();
  });
});

describe("decimal form input", () => {
  it.each([
    ["0", 0],
    ["1.01", 101],
    ["1,01", 101],
    [" 5.5 ", 550],
    ["10000000", MAX_CENTS],
  ])("parses %s exactly", (input, expected) => {
    expect(decimalToInteger(input, MAX_CENTS)).toBe(expected);
  });
  it.each([
    "",
    "-1",
    "1e2",
    "1.001",
    "NaN",
    "Infinity",
    "1.000,01",
    "10000000.01",
    "9007199254740991",
  ])("rejects %s", (input) => {
    expect(() => decimalToInteger(input, MAX_CENTS)).toThrow();
  });
  it("uses the same parser for percent with a 100% limit", () => {
    expect(decimalToInteger("12,75", 10000)).toBe(1275);
    expect(() => decimalToInteger("100.01", 10000)).toThrow();
  });
});
