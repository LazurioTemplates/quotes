import { z } from "zod";
import { isoDate, optionalText, slug, text } from "./common.ts";
import { money } from "./money.ts";

/**
 * The price list: categories and items. An item is addressed by its code,
 * which is also the id of its record (`data/items/<code>.yaml`).
 */
export const category = z.strictObject({
  id: slug,
  name: text,
  order: z.int().min(0).optional(),
});

/** Our code of an item: letters, digits, `.`, `_` and `-`. */
export const ITEM_CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const itemCode = z.string().regex(ITEM_CODE, {
  message: "expected letters, digits, . _ or - (at most 64)",
});

export const PRICE_SOURCES = ["manual", "import"] as const;

/** One change of an item's price: what it was, what it became and from when. */
export const priceChange = z.strictObject({
  valid_from: isoDate,
  purchase_price_before: money.optional(),
  purchase_price: money.optional(),
  sale_price_before: money,
  sale_price: money,
  source: z.enum(PRICE_SOURCES),
  note: optionalText,
});

export const item = z.strictObject({
  code: itemCode,
  name: text,
  category: slug,
  unit: text,
  purchase_price: money.optional(),
  sale_price: money,
  vat_rate: slug,
  valid_from: isoDate,
  valid_to: isoDate.optional(),
  description: optionalText,
  supplier: optionalText,
  supplier_code: optionalText,
  archived: z.boolean().optional(),
  price_history: z.array(priceChange).optional(),
});

export type Category = z.infer<typeof category>;
export type Item = z.infer<typeof item>;
export type PriceChange = z.infer<typeof priceChange>;

/** Categories in their order, then by name. */
export function compareCategories(left: Category, right: Category): number {
  return (left.order ?? 1000) - (right.order ?? 1000) || left.name.localeCompare(right.name, "cs");
}

/** Items by category order, then by name. */
export function compareItems(categories: readonly Category[]) {
  const rank = new Map(categories.map((entry, index) => [entry.id, index]));
  return (left: Item, right: Item) =>
    (rank.get(left.category) ?? 1e6) - (rank.get(right.category) ?? 1e6) ||
    left.name.localeCompare(right.name, "cs") ||
    left.code.localeCompare(right.code);
}

/**
 * A new price for an item. When the purchase or the sale price changes, the
 * change is added to the item's price history with the prices it replaced;
 * otherwise the item stays as it is. `valid_from` of the item becomes the date
 * the new price applies from.
 */
export function withPrice(
  current: Item,
  next: { purchase_price?: number | undefined; sale_price: number; valid_from: string },
  source: PriceChange["source"],
  note?: string,
): Item {
  const samePurchase = (current.purchase_price ?? null) === (next.purchase_price ?? null);
  if (samePurchase && current.sale_price === next.sale_price) return current;
  const change: PriceChange = {
    valid_from: next.valid_from,
    ...(current.purchase_price === undefined
      ? {}
      : { purchase_price_before: current.purchase_price }),
    ...(next.purchase_price === undefined ? {} : { purchase_price: next.purchase_price }),
    sale_price_before: current.sale_price,
    sale_price: next.sale_price,
    source,
    ...(note ? { note } : {}),
  };
  const { purchase_price: _dropped, ...rest } = current;
  return {
    ...rest,
    ...(next.purchase_price === undefined ? {} : { purchase_price: next.purchase_price }),
    sale_price: next.sale_price,
    valid_from: next.valid_from,
    price_history: [...(current.price_history ?? []), change],
  };
}

/** True when the item's price is no longer valid on `date`. */
export function priceExpired(value: Item, date: string): boolean {
  return value.valid_to !== undefined && value.valid_to < date;
}

/** The margin of a sale price over a purchase price in percent of the sale price. */
export function marginPercent(purchase: number | undefined, sale: number): number | null {
  if (purchase === undefined || sale === 0) return null;
  return Math.round(((sale - purchase) / sale) * 1000) / 10;
}
