import { z } from "zod";
import { optionalText, text } from "./common.ts";

/** A customer: a contact kept in the Module's own data (`data/customers/<id>.yaml`). */
export const CUSTOMER_ID = /^C-[0-9]{4,6}$/;
export const customerId = z.string().regex(CUSTOMER_ID, { message: "expected C-0001" });

export const customer = z.strictObject({
  id: customerId,
  name: text,
  company_id: optionalText,
  vat_id: optionalText,
  street: optionalText,
  city: optionalText,
  postal_code: optionalText,
  country: optionalText,
  contact_person: optionalText,
  email: optionalText,
  phone: optionalText,
  note: optionalText,
});

export type Customer = z.infer<typeof customer>;

/** The next free customer id after the highest one used: `C-0007`. */
export function nextCustomerId(existing: readonly string[]): string {
  let highest = 0;
  for (const id of existing) {
    const match = /^C-([0-9]+)$/.exec(id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `C-${String(highest + 1).padStart(4, "0")}`;
}

/** The address of a contact as lines, without empty ones. */
export function addressLines(value: {
  street?: string | undefined;
  postal_code?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
}): string[] {
  const town = [value.postal_code, value.city].filter(Boolean).join(" ");
  return [value.street, town, value.country].filter((line): line is string => Boolean(line));
}
