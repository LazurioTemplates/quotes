import { z } from "zod";

/**
 * Money is counted in minor units of the currency (haléře for CZK) as safe
 * integers, never as floating-point crowns: `139000` is 1 390,00 Kč. Every
 * product goes through BigInt and every division rounds half up, so the same
 * quote gives the same haléře on every machine.
 */
export const MAX_AMOUNT = 100_000_000_000_000; // one trillion crowns, in haléře

export const money = z
  .int()
  .min(0)
  .max(MAX_AMOUNT)
  .describe("An amount in minor units of the currency (haléře): 139000 = 1 390,00 Kč.");

/** A quantity with at most three decimals (2.5 hours, 0.125 m³). */
export const quantity = z
  .number()
  .positive()
  .max(1_000_000_000)
  .multipleOf(0.001)
  .describe("A quantity with at most three decimals.");

/** A percentage with at most two decimals, 0–100 (a VAT rate, a discount). */
export const percent = z
  .number()
  .min(0)
  .max(100)
  .multipleOf(0.01)
  .describe("A percentage with at most two decimals.");

/** Integer division rounded half up (half away from zero for a negative numerator). */
export function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("the denominator must be positive");
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const rounded = (absolute * 2n + denominator) / (denominator * 2n);
  return negative ? -rounded : rounded;
}

function safe(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("the amount is too large");
  }
  return Number(value);
}

/** A quantity in thousandths, exact for every value the schema allows: 2.5 → 2500. */
export function quantityToMilli(value: number): number {
  return Math.round(value * 1000);
}

/** A percentage in basis points, exact for every value the schema allows: 21 → 2100. */
export function percentToBasisPoints(value: number): number {
  return Math.round(value * 100);
}

/** The amount of a line: quantity × unit price, rounded half up to a whole haléř. */
export function lineAmount(quantityMilli: number, unitPrice: number): number {
  return safe(roundDiv(BigInt(quantityMilli) * BigInt(unitPrice), 1000n));
}

/** A share of an amount in basis points, rounded half up: 21 % of 1005 haléřů → 211. */
export function percentOf(amount: number, basisPoints: number): number {
  return safe(roundDiv(BigInt(amount) * BigInt(basisPoints), 10_000n));
}

/** An amount raised by a percentage: a purchase price with a markup. */
export function withMarkup(amount: number, basisPoints: number): number {
  return amount + percentOf(amount, basisPoints);
}

/** Rounded half up to a whole multiple of `step` haléřů (100 = whole crowns). */
export function roundTo(amount: number, step: number): number {
  return safe(roundDiv(BigInt(amount), BigInt(step)) * BigInt(step));
}

/**
 * Splits `total` across parts in proportion to their weights so that the
 * parts add up to exactly `total` (largest remainder; ties go to the earlier
 * part). Used for a discount on the whole quote across its lines.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + BigInt(weight), 0n);
  if (sum === 0n) return weights.map(() => 0);
  const exact = weights.map((weight) => BigInt(total) * BigInt(weight));
  const parts = exact.map((value) => value / sum);
  let rest = BigInt(total) - parts.reduce((acc, part) => acc + part, 0n);
  const order = exact
    .map((value, index) => ({ index, remainder: value % sum }))
    .sort((left, right) =>
      left.remainder === right.remainder
        ? left.index - right.index
        : left.remainder > right.remainder
          ? -1
          : 1,
    );
  for (const { index } of order) {
    if (rest <= 0n) break;
    parts[index] = (parts[index] ?? 0n) + 1n;
    rest -= 1n;
  }
  return parts.map(safe);
}

/**
 * Parses a decimal number as people type it into an integer scaled by
 * `10^decimals`, without floating point: `1 234,5` → 123450 for two decimals.
 * A comma or a dot is the decimal separator; with both, the last one is, and
 * spaces, non-breaking spaces and the other mark group thousands. Returns null
 * for anything else or for more decimals than allowed.
 */
export function parseScaled(input: string, decimals: number): number | null {
  let value = input.replace(/[\s  ]/g, "").replace(/(Kč|CZK|EUR|€|%)$/i, "");
  if (value === "") return null;
  const negative = value.startsWith("-");
  if (negative || value.startsWith("+")) value = value.slice(1);
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  let separator: "," | "." | null = null;
  if (lastComma >= 0 && lastDot >= 0) separator = lastComma > lastDot ? "," : ".";
  else if (lastComma >= 0) separator = value.indexOf(",") === lastComma ? "," : null;
  else if (lastDot >= 0) separator = value.indexOf(".") === lastDot ? "." : null;
  let whole = value;
  let fraction = "";
  if (separator) {
    const at = value.lastIndexOf(separator);
    whole = value.slice(0, at);
    fraction = value.slice(at + 1);
  }
  whole = whole.replace(/[.,]/g, "");
  if (!/^[0-9]+$/.test(whole || "0") || !/^[0-9]*$/.test(fraction)) return null;
  if (fraction.length > decimals) {
    if (/[^0]/.test(fraction.slice(decimals))) return null;
    fraction = fraction.slice(0, decimals);
  }
  const scaled = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return negative ? -Number(scaled) : Number(scaled);
}

/** `1 234,50` → 123450 haléřů; null when it is not an amount. */
export function parseMoney(input: string): number | null {
  return parseScaled(input, 2);
}

/** `2,5` → 2.5; null when it is not a quantity with at most three decimals. */
export function parseQuantity(input: string): number | null {
  const milli = parseScaled(input, 3);
  return milli === null ? null : milli / 1000;
}

/** `21` or `12,5` → 21 or 12.5; null when it is not a percentage with at most two decimals. */
export function parsePercent(input: string): number | null {
  const basisPoints = parseScaled(input, 2);
  return basisPoints === null ? null : basisPoints / 100;
}

const NBSP = " ";
const SYMBOLS: Record<string, string> = { CZK: "Kč", EUR: "€" };

/** `123450` → `1 234,50`, with non-breaking spaces between thousands. */
export function formatAmount(amount: number): string {
  const negative = amount < 0;
  const absolute = BigInt(Math.abs(amount));
  const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "−" : ""}${whole},${fraction}`;
}

/** `123450` → `1 234,50 Kč`. */
export function formatMoney(amount: number, currency = "CZK"): string {
  return `${formatAmount(amount)}${NBSP}${SYMBOLS[currency] ?? currency}`;
}

/** `2.5` → `2,5`; `21` → `21`. */
export function formatNumber(value: number): string {
  return String(value).replace(".", ",");
}

/** `12.5` → `12,5 %`. */
export function formatPercent(value: number): string {
  return `${formatNumber(value)}${NBSP}%`;
}
