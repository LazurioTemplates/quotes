import { describe, expect, test } from "bun:test";
import { calculateQuote } from "../src/domain/calculate.ts";
import type { QuoteLine } from "../src/domain/quote.ts";
import { sampleData } from "./support/seed.ts";

const line = (
  id: string,
  quantity: number,
  unit_price: number,
  vat_percent: number,
  extra: Partial<QuoteLine> = {},
): QuoteLine => ({
  id,
  name: id,
  unit: "ks",
  quantity,
  unit_price,
  vat_percent,
  ...extra,
});

describe("totals of a quote", () => {
  test("VAT per rate from the base of that rate, rounded half up to a haléř", () => {
    const totals = calculateQuote({
      lines: [
        line("a", 3, 333, 21),
        line("b", 1, 1005, 21),
        line("c", 2, 1999, 12),
        line("d", 1, 29000, 0),
      ],
    });
    expect(totals.subtotal).toBe(999 + 1005 + 3998 + 29000);
    expect(totals.groups).toEqual([
      { percent: 21, base: 2004, vat: 421, total: 2425 },
      { percent: 12, base: 3998, vat: 480, total: 4478 },
      { percent: 0, base: 29000, vat: 0, total: 29000 },
    ]);
    expect(totals.vat).toBe(901);
    expect(totals.total).toBe(totals.base + totals.vat);
    expect(totals.rounding).toBe(0);
    expect(totals.payable).toBe(totals.total);
  });

  test("a discount per line and on the whole quote land in their VAT rates", () => {
    const totals = calculateQuote({
      lines: [line("a", 2, 10000, 21, { discount_percent: 10 }), line("b", 1, 5000, 12)],
      discount_percent: 5,
    });
    expect(totals.lines.map((entry) => [entry.gross, entry.discount, entry.net])).toEqual([
      [20000, 2000, 18000],
      [5000, 0, 5000],
    ]);
    expect(totals.subtotal).toBe(23000);
    expect(totals.quoteDiscount).toBe(1150);
    expect(totals.lines.map((entry) => entry.quoteDiscount)).toEqual([900, 250]);
    expect(totals.groups).toEqual([
      { percent: 21, base: 17100, vat: 3591, total: 20691 },
      { percent: 12, base: 4750, vat: 570, total: 5320 },
    ]);
    expect(totals.base).toBe(21850);
  });

  test("rounds the total to whole crowns when the settings ask for it", () => {
    const totals = calculateQuote({ lines: [line("a", 1, 1005, 21)] }, { total_rounding: "whole" });
    expect(totals.total).toBe(1216);
    expect(totals.payable).toBe(1200);
    expect(totals.rounding).toBe(-16);
    const up = calculateQuote({ lines: [line("a", 1, 1050, 21)] }, { total_rounding: "whole" });
    expect(up.total).toBe(1271);
    expect(up.payable).toBe(1300);
  });

  test("the margin counts the lines with a purchase price only", () => {
    const totals = calculateQuote({
      lines: [line("a", 2, 10000, 21, { purchase_price: 6000 }), line("b", 1, 5000, 21)],
    });
    expect(totals.margin).toEqual({ amount: 8000, base: 20000, percent: 40 });
    expect(calculateQuote({ lines: [line("b", 1, 5000, 21)] }).margin).toBeNull();
    expect(calculateQuote({ lines: [] }).payable).toBe(0);
  });

  test("the example quote with a discount comes to the haléř", () => {
    const { quotes, settings } = sampleData();
    const quote = quotes.find((entry) => entry.number === "NAB-2026-0002" && entry.version === 2);
    if (!quote) throw new Error("NAB-2026-0002 v2 missing");
    const totals = calculateQuote(quote, settings);
    expect(totals.subtotal).toBe(4810500);
    expect(totals.quoteDiscount).toBe(240525);
    expect(totals.base).toBe(4569975);
    expect(totals.vat).toBe(959695);
    expect(totals.payable).toBe(5529670);
  });
});
