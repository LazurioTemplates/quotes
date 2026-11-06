import type { CollectionName, RecordOf } from "../domain/collections.ts";
import { checkRules, type RuleIssue } from "../domain/rules.ts";
import { SETTINGS_ID } from "../domain/settings.ts";
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
  draft(): Promise<DraftCard>;
  publish(input: { expectedRevision: string; actor?: string; summary?: string }): Promise<void>;
  finishSend(expectedHead: string): Promise<void>;
  discard(scope: DiscardScope, expectedRevision: string): Promise<void>;
  pull(): Promise<void>;
  subscribe(listener: (event: StoreEvent) => void): () => void;
  close(): void;
}

const LABELS: Record<CollectionName, string> = {
  settings: "Nastavení",
  categories: "Kategorie",
  items: "Položka",
  customers: "Zákazník",
  quotes: "Nabídka",
};

const stored = <T>(entry: Entry<T>): Stored<T> => ({ value: entry.value, revision: entry.revision });

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

  function saveMany<C extends CollectionName>(
    collection: C,
    entries: readonly Save<RecordOf[C]>[],
  ): Promise<Stored<RecordOf[C]>[]> {
    const parsed = entries.map((entry) => ({
      value: parseIn(collection, entry.value),
      base: entry.baseRevision,
    }));
    const ids = parsed.map((entry) => recordId(collection, entry.value));
    if (new Set(ids).size !== ids.length) {
      return Promise.reject(new StoreError("bad_request", "Stejný záznam je v ukládání dvakrát."));
    }
    return backend.write(`save-${collection}`, (snapshot, put) => {
      const records = snapshot[collection] as Map<string, Entry<RecordOf[C]>>;
      parsed.forEach((entry, index) => {
        const id = ids[index] as string;
        const existing = records.get(id);
        const label = `${LABELS[collection]} ${id}`;
        if (entry.base === null && existing) {
          throw new StoreError("record_changed", `${label} už existuje.`);
        }
        if (entry.base !== null && !existing) {
          throw new StoreError("record_changed", `${label} mezitím zmizel nebo se vrátil.`);
        }
        if (existing && entry.base !== existing.revision) {
          throw new StoreError("record_changed", `${label} mezitím uložil někdo jiný.`);
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
    if (!saved) throw new StoreError("unexpected", "Nic se neuložilo.");
    return saved;
  }

  return {
    available: () => backend.available(),
    async settings() {
      const found = await get("settings", SETTINGS_ID);
      if (!found) {
        throw new StoreError("settings_missing", "Data zatím nemají nastavení nabídek.");
      }
      return found;
    },
    saveSettings: (value, base) => save("settings", value, base),
    listCategories: () => list("categories"),
    saveCategory: (value, base) => save("categories", value, base),
    listItems: () => list("items"),
    getItem: (code) => get("items", code),
    saveItem: (value, base) => save("items", value, base),
    saveItems: (entries) => saveMany("items", entries),
    listCustomers: () => list("customers"),
    getCustomer: (id) => get("customers", id),
    saveCustomer: (value, base) => save("customers", value, base),
    listQuotes: () => list("quotes"),
    getQuote: (id) => get("quotes", id),
    saveQuote: (value, base) => save("quotes", value, base),
    check: () =>
      backend.read((snapshot): RuleIssue[] => [
        ...snapshot.problems,
        ...checkRules(dataSetOf(snapshot)),
      ]),
    draft: () => backend.draft(),
    publish: (input) => backend.publish(input),
    finishSend: (head) => backend.finishSend(head),
    discard: (scope, revision) => backend.discard(scope, revision),
    pull: () => backend.pull(),
    subscribe: (listener) => backend.subscribe(listener),
    close: () => backend.close(),
  };
}
