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

export function checkQuote(value: Quote, context: CheckContext): QuoteIssue[] {
  const issues: QuoteIssue[] = [];
  const error = (code: string, message: string, line?: string) =>
    issues.push({ severity: "error", code, message, ...(line ? { line } : {}) });
  const warning = (code: string, message: string, line?: string) =>
    issues.push({ severity: "warning", code, message, ...(line ? { line } : {}) });
  const { settings, today } = context;
  const money = (amount: number) => formatMoney(amount, value.currency);

  if (hasPlaceholders(settings.supplier)) {
    error(
      "supplier_placeholder",
      "Údaje Organizace v Nastavení jsou zatím zástupné (REPLACE-WITH-…); doplňte je, než nabídka odejde.",
    );
  }
  const newer = context.versions.some(
    (other) => other.number === value.number && other.version > value.version,
  );
  if (newer) error("newer_version", "Této nabídky už existuje novější verze.");
  if (value.lines.length === 0) error("no_lines", "Nabídka nemá žádnou položku.");
  if (value.valid_until < value.issue_date) {
    error("validity_before_issue", "Platnost končí dřív, než je nabídka vystavená.");
  } else if (value.valid_until < today) {
    error(
      "validity_passed",
      `Platnost nabídky skončila ${formatDate(value.valid_until)}; prodlužte ji, než nabídka odejde.`,
    );
  }

  const contact = context.customers.find((entry) => entry.id === value.customer.id);
  if (!contact) {
    error("customer_missing", `Zákazník ${value.customer.id} v kontaktech chybí.`);
  } else if (CUSTOMER_FIELDS.some((field) => contact[field] !== value.customer[field])) {
    warning(
      "customer_changed",
      "Údaje zákazníka se v kontaktech od uložení nabídky změnily; uložte nabídku znovu, ať je převezme.",
    );
  }
  if (!value.customer.email) {
    warning("customer_no_email", "Zákazník nemá e-mail; nabídku nebude kam poslat.");
  }

  const rates = new Set(settings.vat_rates.map((rate) => percentToBasisPoints(rate.percent)));
  for (const line of value.lines) {
    const name = `„${line.name}“`;
    if (line.to_check) error("line_to_check", `${name}: ${line.to_check}`, line.id);
    if (line.unit_price === 0) warning("zero_price", `${name} má nulovou cenu.`, line.id);
    if (!rates.has(percentToBasisPoints(line.vat_percent))) {
      warning(
        "vat_unknown",
        `${name} má sazbu DPH ${formatPercent(line.vat_percent)}, kterou Nastavení nezná.`,
        line.id,
      );
    }
    if (line.item_code === undefined) continue;
    const item = context.items.find((entry) => entry.code === line.item_code);
    if (!item) {
      error("item_missing", `${name}: položka ${line.item_code} v ceníku není.`, line.id);
      continue;
    }
    if (item.archived) warning("item_archived", `${name}: položka je v ceníku vyřazená.`, line.id);
    if (item.sale_price !== line.unit_price) {
      warning(
        "price_changed",
        `${name}: v ceníku je teď ${money(item.sale_price)}, v nabídce ${money(line.unit_price)}.`,
        line.id,
      );
    }
    const rate = vatRateById(settings, item.vat_rate);
    if (rate && percentToBasisPoints(rate.percent) !== percentToBasisPoints(line.vat_percent)) {
      warning(
        "vat_changed",
        `${name}: ceník má sazbu DPH ${formatPercent(rate.percent)}, nabídka ${formatPercent(line.vat_percent)}.`,
        line.id,
      );
    }
    if (item.valid_to !== undefined && item.valid_to < value.valid_until) {
      warning(
        "price_validity",
        item.valid_to < today
          ? `${name}: cena v ceníku platila jen do ${formatDate(item.valid_to)}.`
          : `${name}: cena v ceníku platí jen do ${formatDate(item.valid_to)}, nabídka do ${formatDate(value.valid_until)}.`,
        line.id,
      );
    }
  }

  const totals = calculateQuote(value, settings);
  for (const line of totals.lines) {
    if (line.cost !== null && line.base < line.cost) {
      const source = value.lines.find((entry) => entry.id === line.id);
      warning(
        "below_cost",
        `„${source?.name ?? line.id}“ se prodává pod nákupní cenou (${money(line.base)} oproti ${money(line.cost)}).`,
        line.id,
      );
    }
  }
  const minimum = settings.min_margin_percent;
  if (minimum !== undefined && totals.margin && totals.margin.percent < minimum) {
    warning(
      "low_margin",
      `Marže nabídky je ${formatPercent(totals.margin.percent)}, méně než ${formatPercent(minimum)} z Nastavení.`,
    );
  }
  return issues;
}

/** True when nothing stops the quote from going out. */
export function readyToSend(issues: readonly QuoteIssue[]): boolean {
  return issues.every((issue) => issue.severity !== "error");
}
