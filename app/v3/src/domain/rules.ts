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

export function checkRules(data: DataSet): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const add = (record: string, message: string) => issues.push({ record, message });
  const settings = data.settings;
  if (!settings) {
    add("settings/settings", "data nemají záznam s nastavením");
  } else {
    const ids = settings.vat_rates.map((rate) => rate.id);
    if (new Set(ids).size !== ids.length) add("settings/settings", "sazba DPH má stejné id dvakrát");
    if (!ids.includes(settings.default_vat_rate)) {
      add("settings/settings", `výchozí sazba DPH ${settings.default_vat_rate} není mezi sazbami`);
    }
    const problem = numberFormatProblem(settings.quote_number_format);
    if (problem) add("settings/settings", problem);
  }

  const categories = new Set(data.categories.map((entry) => entry.id));
  const rates = new Set(settings?.vat_rates.map((rate) => rate.id) ?? []);
  for (const item of data.items) {
    const record = `items/${item.code}`;
    if (!categories.has(item.category)) add(record, `kategorie ${item.category} neexistuje`);
    if (settings && !rates.has(item.vat_rate)) add(record, `sazba DPH ${item.vat_rate} neexistuje`);
    if (item.valid_to !== undefined && item.valid_to < item.valid_from) {
      add(record, "cena platí do data před svým začátkem");
    }
    const history = item.price_history ?? [];
    for (let index = 1; index < history.length; index += 1) {
      if ((history[index]?.valid_from ?? "") < (history[index - 1]?.valid_from ?? "")) {
        add(record, "historie cen není seřazená podle data");
        break;
      }
    }
    const last = history.at(-1);
    if (last && last.valid_from > item.valid_from) {
      add(record, "poslední změna ceny platí později než cena položky");
    }
  }

  const customers = new Set(data.customers.map((entry) => entry.id));
  const items = new Set(data.items.map((entry) => entry.code));
  const quotes = new Set(data.quotes.map((entry) => quoteId(entry.number, entry.version)));
  for (const quote of data.quotes) {
    const record = `quotes/${quoteId(quote.number, quote.version)}`;
    if (!customers.has(quote.customer.id)) add(record, `zákazník ${quote.customer.id} neexistuje`);
    if (quote.valid_until < quote.issue_date) add(record, "platnost končí před vystavením");
    if (quote.updated_at < quote.created_at) add(record, "updated_at je před created_at");
    const lineIds = quote.lines.map((line) => line.id);
    if (new Set(lineIds).size !== lineIds.length) add(record, "řádek nabídky má stejné id dvakrát");
    for (const line of quote.lines) {
      if (line.item_code !== undefined && !items.has(line.item_code)) {
        add(record, `řádek ${line.id} odkazuje na neexistující položku ${line.item_code}`);
      }
    }
    if (quote.version > 1) {
      if (quote.previous_version !== quote.version - 1) {
        add(record, `verze ${quote.version} musí navazovat na verzi ${quote.version - 1}`);
      }
      if (!quotes.has(quoteId(quote.number, quote.version - 1))) {
        add(record, `předchozí verze ${quote.version - 1} neexistuje`);
      }
    } else if (quote.previous_version !== undefined) {
      add(record, "první verze nemá předchozí verzi");
    }
    if (quote.status !== "draft" && !quote.sent_at) add(record, "odeslaná nabídka nemá datum odeslání");
  }
  return issues;
}
