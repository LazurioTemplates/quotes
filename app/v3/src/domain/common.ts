import { z } from "zod";

/** A calendar date as the records store it: `YYYY-MM-DD`, no time zone. */
export const isoDate = z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, {
  message: "expected a date YYYY-MM-DD",
});

/** A non-empty line of text. */
export const text = z.string().trim().min(1);

/** An optional free text; an empty string is stored as no value. */
export const optionalText = z.string().trim().min(1).optional();

/** A lowercase identifier of a category or a VAT rate: `office-furniture`, `standard`. */
export const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "expected lowercase letters, digits and -" });

/** An ISO 4217 currency code. */
export const currencyCode = z.string().regex(/^[A-Z]{3}$/, { message: "expected e.g. CZK" });

/** The day after or before a date, as `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

/** Today in the Environment's local time zone, as `YYYY-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** `2026-11-06` → `6. 11. 2026`, the Czech way of writing a date. */
export function formatDate(date: string | undefined): string {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

/** A slug of a name for a new id: `Kancelářský nábytek` → `kancelarsky-nabytek`. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}
