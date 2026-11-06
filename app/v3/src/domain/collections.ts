import type { z } from "zod";
import { type Category, category, type Item, item } from "./catalog.ts";
import { type Customer, customer } from "./customer.ts";
import { idOfQuote, type Quote, quote } from "./quote.ts";
import { SETTINGS_ID, type Settings, settings } from "./settings.ts";

/** One collection of this Module's data: the `schemaVersion` of its documents
 * and the Zod schema of one record. */
export type CollectionSpec = Readonly<{ schemaVersion: string; record: z.ZodType }>;

/**
 * The collections of this Module's data, by the name of their directory
 * (`db/data/<name>/`, one document `<id>.yaml` each, in the envelope of
 * repository-db: `schemaVersion`, `id`, `record`). Zod is the one source of a
 * record's shape (profile `app-data`): the types come from these schemas
 * (`z.infer`), the App hands the same schemas to repository-db as its parsers,
 * `bun run schema:export` generates the JSON Schemas of the data repository
 * from them, and `bun run validate:data` checks every record of `seed/`.
 *
 * A new collection is one entry here, written before its first record.
 */
export const collections = {
  settings: { schemaVersion: "quotes.settings.v1", record: settings },
  categories: { schemaVersion: "quotes.category.v1", record: category },
  items: { schemaVersion: "quotes.item.v1", record: item },
  customers: { schemaVersion: "quotes.customer.v1", record: customer },
  quotes: { schemaVersion: "quotes.quote.v1", record: quote },
} as const satisfies Record<string, CollectionSpec>;

export type CollectionName = keyof typeof collections;
export const COLLECTION_NAMES = Object.keys(collections) as CollectionName[];

export interface RecordOf {
  settings: Settings;
  categories: Category;
  items: Item;
  customers: Customer;
  quotes: Quote;
}

/** The id a record must be stored under: its code, number and version, or `settings`. */
export function recordId<C extends CollectionName>(collection: C, value: RecordOf[C]): string {
  switch (collection) {
    case "settings":
      return SETTINGS_ID;
    case "categories":
      return (value as Category).id;
    case "items":
      return (value as Item).code;
    case "customers":
      return (value as Customer).id;
    default:
      return idOfQuote(value as Quote);
  }
}

/** Every record of the Module's data, as the rules across records read it. */
export interface DataSet {
  settings: Settings | null;
  categories: readonly Category[];
  items: readonly Item[];
  customers: readonly Customer[];
  quotes: readonly Quote[];
}
