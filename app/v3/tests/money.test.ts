import { describe, expect, test } from "bun:test";
import {
  allocate,
  formatAmount,
  formatMoney,
  formatPercent,
  lineAmount,
  parseMoney,
  parsePercent,
  parseQuantity,
  percentOf,
  quantityToMilli,
  roundDiv,
  roundTo,
  withMarkup,
} from "../src/domain/money.ts";

describe("money in haléře", () => {
  test("rounds half up, also for the haléř a float would lose", () => {
    expect(roundDiv(5n, 10n)).toBe(1n);
    expect(roundDiv(4n, 10n)).toBe(0n);
    expect(roundDiv(-5n, 10n)).toBe(-1n);
    // 21 % of 10,05 Kč is 2,1105 Kč → 2,11 Kč; of 0,02 Kč is 0,0042 Kč → 0,00 Kč.
    expect(percentOf(1005, 2100)).toBe(211);
    expect(percentOf(2, 2100)).toBe(0);
    // 1,005 × 100 in floating point is 100.49999…; in haléře 0,5 × 201 rounds to 101.
    expect(1.005 * 100).toBeLessThan(100.5);
    expect(lineAmount(500, 201)).toBe(101);
  });

  test("a line is quantity × unit price without floating point", () => {
    // 0,1 + 0,2 ≠ 0,3 in floating point; 3 × 0,10 Kč is exactly 30 haléřů.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(lineAmount(quantityToMilli(3), 10)).toBe(30);
    expect(lineAmount(quantityToMilli(2.5), 65000)).toBe(162500);
    expect(lineAmount(quantityToMilli(0.333), 100)).toBe(33);
    expect(lineAmount(quantityToMilli(1.005), 100)).toBe(101);
    // Large amounts stay exact: 99 999 × 99 999 999,99 Kč; beyond safe integers it refuses.
    expect(lineAmount(quantityToMilli(99999), 9999999999)).toBe(999989999900001);
    expect(() => lineAmount(quantityToMilli(999999), 9999999999)).toThrow(RangeError);
  });

  test("a discount on the whole is split exactly across its parts", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1, [3, 3])).toEqual([1, 0]);
    expect(allocate(240525, [2850000, 1314000, 526500, 120000])).toEqual([
      142500, 65700, 26325, 6000,
    ]);
    expect(allocate(0, [10, 20])).toEqual([0, 0]);
    expect(allocate(10, [0, 0])).toEqual([0, 0]);
    const parts = allocate(999, [123, 456, 789, 1011]);
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(999);
  });

  test("markup and rounding to whole crowns", () => {
    expect(withMarkup(110000, 4500)).toBe(159500);
    expect(roundTo(123449, 100)).toBe(123400);
    expect(roundTo(123450, 100)).toBe(123500);
  });

  test("reads amounts as people type them, in Czech and in English", () => {
    expect(parseMoney("1 234,50")).toBe(123450);
    expect(parseMoney("1 234,5 Kč")).toBe(123450);
    expect(parseMoney("1.234,50")).toBe(123450);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("1290")).toBe(129000);
    expect(parseMoney("1,005")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("1,234.50", "en")).toBe(123450);
    expect(parseMoney("CZK 1,234", "en")).toBe(123400);
    expect(parseMoney("1.2.3", "en")).toBeNull();
    expect(parseQuantity("2,5")).toBe(2.5);
    expect(parseQuantity("0,125")).toBe(0.125);
    expect(parseQuantity("0,1255")).toBeNull();
    expect(parsePercent("12,5 %")).toBe(12.5);
    expect(parsePercent("21%", "en")).toBe(21);
  });

  test("writes amounts the Czech and the English way", () => {
    expect(formatAmount(123450)).toBe("1 234,50");
    expect(formatAmount(5)).toBe("0,05");
    expect(formatMoney(139000)).toBe("1 390,00 Kč");
    expect(formatMoney(139000, "EUR")).toBe("1 390,00 €");
    expect(formatMoney(139000, "CZK", "en")).toBe("CZK 1,390.00");
    expect(formatMoney(-50)).toBe("−0,50 Kč");
    expect(formatPercent(12.5)).toBe("12,5 %");
    expect(formatPercent(12.5, "en")).toBe("12.5%");
  });
});
