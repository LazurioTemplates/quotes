import {
  allocate,
  lineAmount,
  percentOf,
  percentToBasisPoints,
  quantityToMilli,
  roundTo,
} from "./money.ts";
import type { Quote, QuoteLine } from "./quote.ts";
import type { Settings } from "./settings.ts";

/**
 * The totals of a quote, every amount in haléře. The order is the one a
 * Czech quote shows:
 *
 * 1. each line: quantity × unit price, minus its own discount;
 * 2. the subtotal of the lines; the discount on the whole quote is split
 *    across the lines in proportion to their amounts, so it lands in the right
 *    VAT rate and the parts add up to the discount exactly;
 * 3. for each VAT rate: the base (the lines of that rate after both
 *    discounts) and the VAT from that base, rounded half up to a haléř;
 * 4. the total with VAT and, when the settings ask for it, the rounding to
 *    whole crowns.
 */
export interface LineTotals {
  id: string;
  /** Quantity × unit price. */
  gross: number;
  /** The line's own discount. */
  discount: number;
  /** After the line's discount, before the discount on the whole quote. */
  net: number;
  /** The line's share of the discount on the whole quote. */
  quoteDiscount: number;
  /** The line's part of the VAT base. */
  base: number;
  vatPercent: number;
  /** Quantity × purchase price, when the line has one. */
  cost: number | null;
}

export interface VatGroup {
  percent: number;
  base: number;
  vat: number;
  total: number;
}

export interface QuoteTotals {
  lines: LineTotals[];
  /** The sum of the lines after their own discounts. */
  subtotal: number;
  /** The discount on the whole quote. */
  quoteDiscount: number;
  /** The total without VAT. */
  base: number;
  vat: number;
  /** The total with VAT. */
  total: number;
  /** The rounding to whole crowns (may be negative), 0 without it. */
  rounding: number;
  /** What the customer pays: the total with VAT and the rounding. */
  payable: number;
  /** One row per VAT rate, highest rate first. */
  groups: VatGroup[];
  /** The margin over the lines that have a purchase price, null when none has. */
  margin: { amount: number; percent: number; base: number } | null;
}

/** A quote's lines and discount; a version that went out brings its own rounding. */
export type CalculationInput = Pick<Quote, "lines" | "discount_percent"> &
  Partial<Pick<Quote, "sent_settings">>;

function lineTotals(line: QuoteLine): Omit<LineTotals, "quoteDiscount" | "base"> {
  const milli = quantityToMilli(line.quantity);
  const gross = lineAmount(milli, line.unit_price);
  const discount = percentOf(gross, percentToBasisPoints(line.discount_percent ?? 0));
  return {
    id: line.id,
    gross,
    discount,
    net: gross - discount,
    vatPercent: line.vat_percent,
    cost: line.purchase_price === undefined ? null : lineAmount(milli, line.purchase_price),
  };
}

export function calculateQuote(
  value: CalculationInput,
  options: Pick<Settings, "total_rounding"> = { total_rounding: "none" },
): QuoteTotals {
  const partial = value.lines.map(lineTotals);
  const subtotal = partial.reduce((sum, line) => sum + line.net, 0);
  const quoteDiscount = percentOf(subtotal, percentToBasisPoints(value.discount_percent ?? 0));
  const shares = allocate(
    quoteDiscount,
    partial.map((line) => line.net),
  );
  const lines: LineTotals[] = partial.map((line, index) => {
    const share = shares[index] ?? 0;
    return { ...line, quoteDiscount: share, base: line.net - share };
  });

  const byRate = new Map<number, number>();
  for (const line of lines) {
    const key = percentToBasisPoints(line.vatPercent);
    byRate.set(key, (byRate.get(key) ?? 0) + line.base);
  }
  const groups: VatGroup[] = [...byRate.entries()]
    .sort(([left], [right]) => right - left)
    .map(([basisPoints, base]) => {
      const vat = percentOf(base, basisPoints);
      return { percent: basisPoints / 100, base, vat, total: base + vat };
    });

  const base = groups.reduce((sum, group) => sum + group.base, 0);
  const vat = groups.reduce((sum, group) => sum + group.vat, 0);
  const total = base + vat;
  const rounding = value.sent_settings?.total_rounding ?? options.total_rounding;
  const payable = rounding === "whole" ? roundTo(total, 100) : total;

  const costed = lines.filter((line) => line.cost !== null);
  const marginBase = costed.reduce((sum, line) => sum + line.base, 0);
  const marginAmount = costed.reduce((sum, line) => sum + line.base - (line.cost ?? 0), 0);
  const margin =
    costed.length === 0
      ? null
      : {
          amount: marginAmount,
          base: marginBase,
          percent: marginBase === 0 ? 0 : Math.round((marginAmount / marginBase) * 1000) / 10,
        };

  return {
    lines,
    subtotal,
    quoteDiscount,
    base,
    vat,
    total,
    rounding: payable - total,
    payable,
    groups,
    margin,
  };
}
