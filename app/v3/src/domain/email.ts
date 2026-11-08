import type { Locale } from "../i18n/locale.ts";
import { calculateQuote } from "./calculate.ts";
import { formatDate } from "./common.ts";
import { formatMoney } from "./money.ts";
import { documentSettings, type Quote } from "./quote.ts";
import type { Settings } from "./settings.ts";

/**
 * The e-mail that goes with a quote, filled from the template in the
 * settings. Sending it is a Publication: the App and the agent only prepare
 * the text and the PDF; a person sends it, or approves the exact draft an
 * agent prepared in the Organization's mailbox (docs/extending.md).
 */
export const EMAIL_PLACEHOLDERS = [
  "number",
  "version",
  "title",
  "customer",
  "contact",
  "valid_until",
  "total",
  "total_without_vat",
  "organization",
  "prepared_by",
] as const;

export interface QuoteEmail {
  to: string | null;
  subject: string;
  body: string;
  attachment: string;
}

/** The file name of the quote's PDF: `Nabidka-NAB-2026-0007-v2.pdf`, `Quote-Q-2026-0007-v2.pdf`. */
export function pdfFileName(
  value: Pick<Quote, "number" | "version">,
  locale: Locale = "cs",
): string {
  return `${locale === "en" ? "Quote" : "Nabidka"}-${value.number}-v${value.version}.pdf`;
}

/**
 * The template is the Organization's own text in its settings; `locale`
 * decides how the amounts and dates filled into it are written.
 */
export function quoteEmail(value: Quote, settings: Settings, locale: Locale = "cs"): QuoteEmail {
  const totals = calculateQuote(value, settings);
  const values: Record<(typeof EMAIL_PLACEHOLDERS)[number], string> = {
    number: value.number,
    version: String(value.version),
    title: value.title,
    customer: value.customer.name,
    contact: value.customer.contact_person ?? value.customer.name,
    valid_until: formatDate(value.valid_until, locale),
    total: formatMoney(totals.payable, value.currency, locale),
    total_without_vat: formatMoney(totals.base, value.currency, locale),
    organization: documentSettings(value, settings).supplier.name,
    prepared_by: value.prepared_by ?? documentSettings(value, settings).supplier.name,
  };
  const fill = (template: string) =>
    template.replace(/\{([a-z_]+)\}/g, (match, key: string) =>
      key in values ? values[key as keyof typeof values] : match,
    );
  return {
    to: value.customer.email ?? null,
    subject: fill(settings.email.subject),
    body: fill(settings.email.body),
    attachment: pdfFileName(value, locale),
  };
}
