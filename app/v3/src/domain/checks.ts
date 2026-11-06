import { type Locale, pick } from "../i18n/locale.ts";
import { calculateQuote } from "./calculate.ts";
import type { Item } from "./catalog.ts";
import { formatDate } from "./common.ts";
import type { Customer } from "./customer.ts";
import { formatMoney, formatPercent, percentToBasisPoints } from "./money.ts";
import type { Quote } from "./quote.ts";
import { hasPlaceholders, type Settings, vatRateById } from "./settings.ts";

/**
 * The check of a quote before it goes to the customer. An error stops the
 * step "Označit jako odeslanou"; a warning is for a person to decide. The
 * App, the agent's command `bun run quotes quote:check` and the skill
 * `check-quote-before-sending` use this one function.
 */
export interface QuoteIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  /** The line the issue is about. */
  line?: string;
}

export interface CheckContext {
  settings: Settings;
  items: readonly Item[];
  customers: readonly Customer[];
  /** Every version of quotes with the same number, to see a newer one. */
  versions: readonly Pick<Quote, "number" | "version">[];
  today: string;
}

const CUSTOMER_FIELDS = [
  "name",
  "company_id",
  "vat_id",
  "street",
  "city",
  "postal_code",
  "country",
  "contact_person",
  "email",
] as const;

export function checkQuote(
  value: Quote,
  context: CheckContext,
  locale: Locale = "cs",
): QuoteIssue[] {
  const issues: QuoteIssue[] = [];
  const error = (code: string, message: string, line?: string) =>
    issues.push({ severity: "error", code, message, ...(line ? { line } : {}) });
  const warning = (code: string, message: string, line?: string) =>
    issues.push({ severity: "warning", code, message, ...(line ? { line } : {}) });
  const { settings, today } = context;
  const money = (amount: number) => formatMoney(amount, value.currency, locale);
  const date = (day: string) => formatDate(day, locale);
  const percent = (amount: number) => formatPercent(amount, locale);
  const t = (cs: string, en: string) => pick(locale, cs, en);

  if (hasPlaceholders(settings.supplier)) {
    error(
      "supplier_placeholder",
      t(
        "Údaje Organizace v Nastavení jsou zatím zástupné (REPLACE-WITH-…); doplňte je, než nabídka odejde.",
        "The Organization's details in Settings are still placeholders (REPLACE-WITH-…); fill them in before the quote goes out.",
      ),
    );
  }
  const newer = context.versions.some(
    (other) => other.number === value.number && other.version > value.version,
  );
  if (newer)
    error(
      "newer_version",
      t("Této nabídky už existuje novější verze.", "A newer version of this quote exists."),
    );
  if (value.lines.length === 0)
    error("no_lines", t("Nabídka nemá žádnou položku.", "The quote has no line."));
  if (value.valid_until < value.issue_date) {
    error(
      "validity_before_issue",
      t(
        "Platnost končí dřív, než je nabídka vystavená.",
        "The quote expires before its issue date.",
      ),
    );
  } else if (value.valid_until < today) {
    error(
      "validity_passed",
      t(
        `Platnost nabídky skončila ${date(value.valid_until)}; prodlužte ji, než nabídka odejde.`,
        `The quote expired on ${date(value.valid_until)}; extend it before it goes out.`,
      ),
    );
  }

  const contact = context.customers.find((entry) => entry.id === value.customer.id);
  if (!contact) {
    error(
      "customer_missing",
      t(
        `Zákazník ${value.customer.id} v kontaktech chybí.`,
        `The customer ${value.customer.id} is not in the contacts.`,
      ),
    );
  } else if (CUSTOMER_FIELDS.some((field) => contact[field] !== value.customer[field])) {
    warning(
      "customer_changed",
      t(
        "Údaje zákazníka se v kontaktech od uložení nabídky změnily; uložte nabídku znovu, ať je převezme.",
        "The customer's details changed in the contacts since the quote was saved; save the quote again to take them.",
      ),
    );
  }
  if (!value.customer.email) {
    warning(
      "customer_no_email",
      t(
        "Zákazník nemá e-mail; nabídku nebude kam poslat.",
        "The customer has no e-mail; there is nowhere to send the quote.",
      ),
    );
  }

  const rates = new Set(settings.vat_rates.map((rate) => percentToBasisPoints(rate.percent)));
  for (const line of value.lines) {
    const name = t(`„${line.name}“`, `“${line.name}”`);
    if (line.to_check) error("line_to_check", `${name}: ${line.to_check}`, line.id);
    if (line.unit_price === 0) {
      warning("zero_price", t(`${name} má nulovou cenu.`, `${name} has a price of zero.`), line.id);
    }
    if (!rates.has(percentToBasisPoints(line.vat_percent))) {
      warning(
        "vat_unknown",
        t(
          `${name} má sazbu DPH ${percent(line.vat_percent)}, kterou Nastavení nezná.`,
          `${name} has a VAT rate of ${percent(line.vat_percent)} that Settings do not know.`,
        ),
        line.id,
      );
    }
    if (line.item_code === undefined) continue;
    const item = context.items.find((entry) => entry.code === line.item_code);
    if (!item) {
      error(
        "item_missing",
        t(
          `${name}: položka ${line.item_code} v ceníku není.`,
          `${name}: the item ${line.item_code} is not in the price list.`,
        ),
        line.id,
      );
      continue;
    }
    if (item.archived) {
      warning(
        "item_archived",
        t(
          `${name}: položka je v ceníku vyřazená.`,
          `${name}: the item is retired in the price list.`,
        ),
        line.id,
      );
    }
    if (item.sale_price !== line.unit_price) {
      warning(
        "price_changed",
        t(
          `${name}: v ceníku je teď ${money(item.sale_price)}, v nabídce ${money(line.unit_price)}.`,
          `${name}: the price list now says ${money(item.sale_price)}, the quote ${money(line.unit_price)}.`,
        ),
        line.id,
      );
    }
    const rate = vatRateById(settings, item.vat_rate);
    if (rate && percentToBasisPoints(rate.percent) !== percentToBasisPoints(line.vat_percent)) {
      warning(
        "vat_changed",
        t(
          `${name}: ceník má sazbu DPH ${percent(rate.percent)}, nabídka ${percent(line.vat_percent)}.`,
          `${name}: the price list has a VAT rate of ${percent(rate.percent)}, the quote ${percent(line.vat_percent)}.`,
        ),
        line.id,
      );
    }
    if (item.valid_to !== undefined && item.valid_to < value.valid_until) {
      warning(
        "price_validity",
        item.valid_to < today
          ? t(
              `${name}: cena v ceníku platila jen do ${date(item.valid_to)}.`,
              `${name}: the price list price was valid only until ${date(item.valid_to)}.`,
            )
          : t(
              `${name}: cena v ceníku platí jen do ${date(item.valid_to)}, nabídka do ${date(value.valid_until)}.`,
              `${name}: the price list price is valid until ${date(item.valid_to)}, the quote until ${date(value.valid_until)}.`,
            ),
        line.id,
      );
    }
  }

  const totals = calculateQuote(value, settings);
  for (const line of totals.lines) {
    if (line.cost !== null && line.base < line.cost) {
      const source = value.lines.find((entry) => entry.id === line.id)?.name ?? line.id;
      warning(
        "below_cost",
        t(
          `„${source}“ se prodává pod nákupní cenou (${money(line.base)} oproti ${money(line.cost)}).`,
          `“${source}” sells below its purchase price (${money(line.base)} against ${money(line.cost)}).`,
        ),
        line.id,
      );
    }
  }
  const minimum = settings.min_margin_percent;
  if (minimum !== undefined && totals.margin && totals.margin.percent < minimum) {
    warning(
      "low_margin",
      t(
        `Marže nabídky je ${percent(totals.margin.percent)}, méně než ${percent(minimum)} z Nastavení.`,
        `The quote's margin is ${percent(totals.margin.percent)}, less than the ${percent(minimum)} of Settings.`,
      ),
    );
  }
  return issues;
}

/** True when nothing stops the quote from going out. */
export function readyToSend(issues: readonly QuoteIssue[]): boolean {
  return issues.every((issue) => issue.severity !== "error");
}
