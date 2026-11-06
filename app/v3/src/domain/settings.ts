import { z } from "zod";
import { currencyCode, optionalText, slug, text } from "./common.ts";
import { percent } from "./money.ts";

/**
 * The settings of quotes, one record per data repository
 * (`data/settings/settings.yaml`). VAT rates, the number format and the
 * Organization's details printed on every quote are data the Organization
 * edits in the App, never constants in the code.
 */
export const SETTINGS_ID = "settings";

export const vatRate = z.strictObject({
  id: slug,
  label: text,
  percent,
});

/** The Organization as its quotes name it; the template ships placeholders. */
export const supplier = z.strictObject({
  name: text,
  company_id: optionalText,
  vat_id: optionalText,
  street: optionalText,
  city: optionalText,
  postal_code: optionalText,
  country: optionalText,
  registration: optionalText,
  email: optionalText,
  phone: optionalText,
  web: optionalText,
  bank_account: optionalText,
});

export const TOTAL_ROUNDINGS = ["none", "whole"] as const;

/**
 * The tokens of a quote number: `{YYYY}`, `{YY}`, `{MM}` and one counter
 * `{N…}` whose width is the number of N (`{NNNN}` → 0007). Everything else is
 * literal: letters, digits, `-`, `_` and `.`.
 */
export const NUMBER_FORMAT = /^(?:[A-Za-z0-9._-]|\{YYYY\}|\{YY\}|\{MM\}|\{N{1,8}\})+$/;

export const settings = z.strictObject({
  currency: currencyCode,
  vat_rates: z.array(vatRate).min(1),
  default_vat_rate: slug,
  quote_number_format: z
    .string()
    .regex(NUMBER_FORMAT, { message: "expected literals and {YYYY} {YY} {MM} {NNNN}" }),
  validity_days: z.int().min(1).max(365),
  total_rounding: z.enum(TOTAL_ROUNDINGS),
  min_margin_percent: percent.optional(),
  supplier,
  default_introduction: optionalText,
  default_terms: optionalText,
  email: z.strictObject({ subject: text, body: text }),
});

export type Settings = z.infer<typeof settings>;
export type VatRate = z.infer<typeof vatRate>;
export type Supplier = z.infer<typeof supplier>;

/** The VAT rate a rate id names, or undefined. */
export function vatRateById(value: Settings, id: string): VatRate | undefined {
  return value.vat_rates.find((rate) => rate.id === id);
}

/** True while a supplier detail still holds the template's placeholder. */
export function hasPlaceholders(value: Supplier): boolean {
  return Object.values(value).some((detail) => /REPLACE-WITH/.test(String(detail)));
}
