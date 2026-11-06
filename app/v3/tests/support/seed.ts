import { DATA_REPO_TEMPLATE, seedDirectory } from "../../src/cli/paths.ts";
import { readDataDirectory } from "../../src/data/directory.ts";
import type { Item } from "../../src/domain/catalog.ts";
import type { DataSet } from "../../src/domain/collections.ts";
import type { Quote } from "../../src/domain/quote.ts";
import type { Settings } from "../../src/domain/settings.ts";
import type { Locale } from "../../src/i18n/locale.ts";

export { DATA_REPO_TEMPLATE, seedDirectory };

/** The fictional example records of a language, parsed; the tests' data. */
export function sampleData(locale: Locale = "cs"): DataSet & { settings: Settings } {
  const read = readDataDirectory(seedDirectory(locale, "sample"));
  if (read.issues.length > 0 || !read.data.settings) {
    throw new Error(`invalid sample data: ${JSON.stringify(read.issues)}`);
  }
  return { ...read.data, settings: read.data.settings };
}

/** A new item that passes every rule of the Czech sample. */
export function newItem(code = "NAB-STOLEK", name = "Odkládací stolek"): Item {
  return {
    code,
    name,
    category: "nabytek",
    unit: "ks",
    purchase_price: 110000,
    sale_price: 159000,
    vat_rate: "standard",
    valid_from: "2026-11-01",
  };
}

/** A new draft quote of the Czech sample's customer C-0002. */
export function newQuote(number = "NAB-2026-0006"): Quote {
  const sample = sampleData();
  const contact = sample.customers.find((entry) => entry.id === "C-0002");
  if (!contact) throw new Error("C-0002 missing");
  const { note: _note, ...customer } = contact;
  return {
    number,
    version: 1,
    status: "draft",
    title: "Nová recepce",
    customer,
    issue_date: "2026-11-06",
    valid_until: "2026-12-06",
    currency: "CZK",
    lines: [
      {
        id: "l1",
        item_code: "NAB-ZIDLE-ERGO",
        name: "Ergonomická kancelářská židle",
        unit: "ks",
        quantity: 2,
        unit_price: 679000,
        purchase_price: 430000,
        vat_percent: 21,
      },
    ],
    created_at: "2026-11-06",
    updated_at: "2026-11-06",
  };
}
