import { type Locale, pick } from "../i18n/locale.ts";
import type { DataSet } from "./collections.ts";
import { numberFormatProblem, quoteId } from "./quote.ts";

/**
 * Rules across records, which the schema of one record cannot express: a
 * record names a category, a VAT rate, a customer or an item that exists, and
 * the versions of a quote follow each other. The App checks them before it
 * saves a record and in `bun run validate:db`; the data repository's own
 * validator checks the shape of each record only.
 */
export interface RuleIssue {
  /** The record the issue is about: `<collection>/<id>`. */
  record: string;
  message: string;
}

export function checkRules(data: DataSet, locale: Locale = "cs"): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const t = (cs: string, en: string) => pick(locale, cs, en);
  const add = (record: string, message: string) => issues.push({ record, message });
  const settings = data.settings;
  if (!settings) {
    add(
      "settings/settings",
      t("data nemají záznam s nastavením", "the data has no settings record"),
    );
  } else {
    const ids = settings.vat_rates.map((rate) => rate.id);
    if (new Set(ids).size !== ids.length) {
      add(
        "settings/settings",
        t("sazba DPH má stejné id dvakrát", "two VAT rates have the same id"),
      );
    }
    if (!ids.includes(settings.default_vat_rate)) {
      add(
        "settings/settings",
        t(
          `výchozí sazba DPH ${settings.default_vat_rate} není mezi sazbami`,
          `the default VAT rate ${settings.default_vat_rate} is not one of the rates`,
        ),
      );
    }
    const problem = numberFormatProblem(settings.quote_number_format, locale);
    if (problem) add("settings/settings", problem);
  }

  const categories = new Set(data.categories.map((entry) => entry.id));
  const rates = new Set(settings?.vat_rates.map((rate) => rate.id) ?? []);
  for (const item of data.items) {
    const record = `items/${item.code}`;
    if (!categories.has(item.category)) {
      add(
        record,
        t(`kategorie ${item.category} neexistuje`, `the category ${item.category} does not exist`),
      );
    }
    if (settings && !rates.has(item.vat_rate)) {
      add(
        record,
        t(`sazba DPH ${item.vat_rate} neexistuje`, `the VAT rate ${item.vat_rate} does not exist`),
      );
    }
    if (item.valid_to !== undefined && item.valid_to < item.valid_from) {
      add(record, t("cena platí do data před svým začátkem", "the price ends before it starts"));
    }
    const history = item.price_history ?? [];
    for (let index = 1; index < history.length; index += 1) {
      if ((history[index]?.valid_from ?? "") < (history[index - 1]?.valid_from ?? "")) {
        add(
          record,
          t("historie cen není seřazená podle data", "the price history is not in date order"),
        );
        break;
      }
    }
    const last = history.at(-1);
    if (last && last.valid_from > item.valid_from) {
      add(
        record,
        t(
          "poslední změna ceny platí později než cena položky",
          "the last price change starts later than the item's price",
        ),
      );
    }
  }

  const customers = new Set(data.customers.map((entry) => entry.id));
  const items = new Set(data.items.map((entry) => entry.code));
  const quotes = new Set(data.quotes.map((entry) => quoteId(entry.number, entry.version)));
  for (const quote of data.quotes) {
    const record = `quotes/${quoteId(quote.number, quote.version)}`;
    if (!customers.has(quote.customer.id)) {
      add(
        record,
        t(
          `zákazník ${quote.customer.id} neexistuje`,
          `the customer ${quote.customer.id} does not exist`,
        ),
      );
    }
    if (quote.valid_until < quote.issue_date) {
      add(record, t("platnost končí před vystavením", "the quote expires before its issue date"));
    }
    if (quote.updated_at < quote.created_at) {
      add(record, t("updated_at je před created_at", "updated_at is before created_at"));
    }
    const lineIds = quote.lines.map((line) => line.id);
    if (new Set(lineIds).size !== lineIds.length) {
      add(
        record,
        t("řádek nabídky má stejné id dvakrát", "two lines of the quote have the same id"),
      );
    }
    for (const line of quote.lines) {
      if (line.item_code !== undefined && !items.has(line.item_code)) {
        add(
          record,
          t(
            `řádek ${line.id} odkazuje na neexistující položku ${line.item_code}`,
            `the line ${line.id} names the unknown item ${line.item_code}`,
          ),
        );
      }
    }
    if (quote.version > 1) {
      if (quote.previous_version !== quote.version - 1) {
        add(
          record,
          t(
            `verze ${quote.version} musí navazovat na verzi ${quote.version - 1}`,
            `version ${quote.version} must follow version ${quote.version - 1}`,
          ),
        );
      }
      if (!quotes.has(quoteId(quote.number, quote.version - 1))) {
        add(
          record,
          t(
            `předchozí verze ${quote.version - 1} neexistuje`,
            `the previous version ${quote.version - 1} does not exist`,
          ),
        );
      }
    } else if (quote.previous_version !== undefined) {
      add(
        record,
        t("první verze nemá předchozí verzi", "the first version has no previous version"),
      );
    }
    if (quote.status !== "draft" && !quote.sent_at) {
      add(
        record,
        t("odeslaná nabídka nemá datum odeslání", "a quote that went out has no date it was sent"),
      );
    }
  }
  return issues;
}
