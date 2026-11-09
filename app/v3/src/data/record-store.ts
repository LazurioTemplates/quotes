import { canonicalJson } from "../domain/canonical.ts";
import type { CollectionName, RecordOf } from "../domain/collections.ts";
import { checkRules, type RuleIssue } from "../domain/rules.ts";
import { SETTINGS_ID } from "../domain/settings.ts";
import type { Locale, Localized } from "../i18n/locale.ts";
import {
  assertRulesFor,
  dataSetOf,
  type Entry,
  ordered,
  parseIn,
  recordId,
  recordKey,
  type Snapshot,
} from "./records.ts";
import type {
  Catalog,
  CatalogRevisions,
  DiscardScope,
  DraftCard,
  QuotesStore,
  Revision,
  Save,
  Stored,
  StoreEvent,
} from "./store.ts";
import { StoreError } from "./store.ts";

/** Writes one record as a draft and returns its new revision. */
export type Put = <C extends CollectionName>(
  collection: C,
  id: string,
  value: RecordOf[C],
  baseRevision: Revision | null,
) => Revision;

/**
 * What a store implementation provides below the port: a fresh snapshot of
 * every record for a read, a write queue with a `put`, and Draft & Publish.
 * `createRecordStore` builds the domain operations of the port on it once, so
 * the memory store and the repository-db store keep the same rules.
 */
export interface RecordBackend {
  available(): Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  read<T>(operation: (snapshot: Snapshot) => T): Promise<T>;
  write<T>(kind: string, operation: (snapshot: Snapshot, put: Put) => T): Promise<T>;
  draft(locale: Locale): Promise<DraftCard>;
  publish(input: { expectedRevision: string; actor?: string; summary?: string }): Promise<void>;
  finishSend(expectedHead: string): Promise<void>;
  discard(scope: DiscardScope, expectedRevision: string): Promise<void>;
  pull(): Promise<void>;
  subscribe(listener: (event: StoreEvent) => void): () => void;
  close(): void;
}

const LABELS: Record<CollectionName, Localized> = {
  settings: { cs: "Nastavení", en: "Settings" },
  categories: { cs: "Kategorie", en: "Category" },
  items: { cs: "Položka", en: "Item" },
  customers: { cs: "Zákazník", en: "Customer" },
  quotes: { cs: "Nabídka", en: "Quote" },
};

const stored = <T>(entry: Entry<T>): Stored<T> => ({
  value: entry.value,
  revision: entry.revision,
});

export function createRecordStore(backend: RecordBackend): QuotesStore {
  function list<C extends CollectionName>(collection: C): Promise<Stored<RecordOf[C]>[]> {
    return backend.read((snapshot) => ordered(snapshot, collection).map(stored));
  }

  function get<C extends CollectionName>(
    collection: C,
    id: string,
  ): Promise<Stored<RecordOf[C]> | null> {
    return backend.read((snapshot) => {
      const entry = snapshot[collection].get(id) as Entry<RecordOf[C]> | undefined;
      return entry ? stored(entry) : null;
    });
  }

  /** The revisions of the catalog in a snapshot, as `catalogRevisions` names them. */
  function revisionsIn(snapshot: Snapshot): CatalogRevisions {
    const of = <C extends CollectionName>(collection: C) =>
      Object.fromEntries(
        [...snapshot[collection].entries()].map(([id, entry]) => [id, entry.revision]),
      );
    return {
      settings: snapshot.settings.get(SETTINGS_ID)?.revision ?? "",
      categories: of("categories"),
      items: of("items"),
    };
  }

  /**
   * Inside the write, before anything changes: the settings, categories and
   * items must still be the revisions the caller computed from.
   */
  function assertUnchanged(snapshot: Snapshot, expected: CatalogRevisions | undefined) {
    if (!expected) return;
    if (canonicalJson(revisionsIn(snapshot)) === canonicalJson(expected)) return;
    throw new StoreError("data_changed", {
      cs: "Ceník, kategorie nebo nastavení se mezitím změnily; nic se neuložilo.",
      en: "The price list, the categories or the settings changed meanwhile; nothing was saved.",
    });
  }

  function saveMany<C extends CollectionName>(
    collection: C,
    entries: readonly Save<RecordOf[C]>[],
    unchanged?: CatalogRevisions,
  ): Promise<Stored<RecordOf[C]>[]> {
    const parsed = entries.map((entry) => ({
      value: parseIn(collection, entry.value),
      base: entry.baseRevision,
    }));
    const ids = parsed.map((entry) => recordId(collection, entry.value));
    if (new Set(ids).size !== ids.length) {
      return Promise.reject(
        new StoreError("bad_request", {
          cs: "Stejný záznam je v ukládání dvakrát.",
          en: "The same record is saved twice.",
        }),
      );
    }
    return backend.write(`save-${collection}`, (snapshot, put) => {
      assertUnchanged(snapshot, unchanged);
      const records = snapshot[collection] as Map<string, Entry<RecordOf[C]>>;
      parsed.forEach((entry, index) => {
        const id = ids[index] as string;
        const existing = records.get(id);
        const { cs, en } = LABELS[collection];
        if (entry.base === null && existing) {
          throw new StoreError("record_changed", {
            cs: `${cs} ${id} už existuje.`,
            en: `${en} ${id} already exists.`,
          });
        }
        if (entry.base !== null && !existing) {
          throw new StoreError("record_changed", {
            cs: `${cs} ${id} mezitím zmizel nebo se vrátil.`,
            en: `${en} ${id} was deleted or returned meanwhile.`,
          });
        }
        if (existing && entry.base !== existing.revision) {
          throw new StoreError("record_changed", {
            cs: `${cs} ${id} mezitím uložil někdo jiný.`,
            en: `Someone else saved ${en.toLowerCase()} ${id} meanwhile.`,
          });
        }
      });
      parsed.forEach((entry, index) => {
        records.set(ids[index] as string, { value: entry.value, revision: "" });
      });
      assertRulesFor(
        ids.map((id) => recordKey(collection, id)),
        dataSetOf(snapshot),
      );
      return parsed.map((entry, index) => ({
        value: entry.value,
        revision: put(collection, ids[index] as string, entry.value, entry.base),
      }));
    });
  }

  async function save<C extends CollectionName>(
    collection: C,
    value: RecordOf[C],
    baseRevision: Revision | null,
  ): Promise<Stored<RecordOf[C]>> {
    const [saved] = await saveMany(collection, [{ value, baseRevision }]);
    if (!saved)
      throw new StoreError("unexpected", { cs: "Nic se neuložilo.", en: "Nothing was saved." });
    return saved;
  }

  return {
    available: () => backend.available(),
    async settings() {
      const found = await get("settings", SETTINGS_ID);
      if (!found) {
        throw new StoreError("settings_missing", {
          cs: "Data zatím nemají nastavení nabídek.",
          en: "The data has no quote settings yet.",
        });
      }
      return found;
    },
    saveSettings: (value, base) => save("settings", value, base),
    listCategories: () => list("categories"),
    saveCategory: (value, base) => save("categories", value, base),
    listItems: () => list("items"),
    getItem: (code) => get("items", code),
    saveItem: (value, base) => save("items", value, base),
    saveItems: (entries, options) => saveMany("items", entries, options?.unchanged),
    readCatalog: () =>
      backend.read((snapshot): Catalog => {
        const settings = snapshot.settings.get(SETTINGS_ID);
        if (!settings) {
          throw new StoreError("settings_missing", {
            cs: "Data zatím nemají nastavení nabídek.",
            en: "The data has no quote settings yet.",
          });
        }
        return {
          settings: stored(settings),
          categories: ordered(snapshot, "categories").map(stored),
          items: ordered(snapshot, "items").map(stored),
        };
      }),
    listCustomers: () => list("customers"),
    getCustomer: (id) => get("customers", id),
    saveCustomer: (value, base) => save("customers", value, base),
    listQuotes: () => list("quotes"),
    getQuote: (id) => get("quotes", id),
    saveQuote: (value, base) => save("quotes", value, base),
    check: (locale = "cs") =>
      backend.read((snapshot): RuleIssue[] => [
        ...snapshot.problems.map((problem) => ({
          record: problem.record,
          message: problem.message[locale],
        })),
        ...checkRules(dataSetOf(snapshot), locale),
      ]),
    draft: (locale = "cs") => backend.draft(locale),
    publish: (input) => backend.publish(input),
    finishSend: (head) => backend.finishSend(head),
    discard: (scope, revision) => backend.discard(scope, revision),
    pull: () => backend.pull(),
    subscribe: (listener) => backend.subscribe(listener),
    close: () => backend.close(),
  };
}
