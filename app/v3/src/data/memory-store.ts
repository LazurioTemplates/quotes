import { createHash } from "node:crypto";
import type { CollectionName, DataSet } from "../domain/collections.ts";
import { createRecordStore, type Put } from "./record-store.ts";
import { type Entry, emptySnapshot, recordId, recordKey, type Snapshot } from "./records.ts";
import { reviewResource } from "./review-adapter.ts";
import type { DiscardScope, DraftCard, QuotesStore, Revision, StoreEvent } from "./store.ts";
import { StoreError } from "./store.ts";

/**
 * Quotes' storage in memory: the same port and the same Draft & Publish
 * behaviour as the repository-db store, without Git. The demo (`bun run
 * dev:demo`) and the tests of the server and the UI use it; it also proves
 * that `tests/store-contract.ts` describes the port and not one engine.
 */
type Key = string;

function revisionOf(value: unknown): Revision {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function split(key: Key): { collection: CollectionName; id: string } {
  const at = key.indexOf("/");
  return { collection: key.slice(0, at) as CollectionName, id: key.slice(at + 1) };
}

export function createMemoryStore(seed: Partial<DataSet>): QuotesStore {
  const published = new Map<Key, unknown>();
  const add = <C extends CollectionName>(collection: C, values: readonly unknown[]) => {
    for (const value of values) {
      published.set(recordKey(collection, recordId(collection, value as never)), value);
    }
  };
  if (seed.settings) add("settings", [seed.settings]);
  add("categories", seed.categories ?? []);
  add("items", seed.items ?? []);
  add("customers", seed.customers ?? []);
  add("quotes", seed.quotes ?? []);
  const draft = new Map<Key, unknown>(published);
  const listeners = new Set<(event: StoreEvent) => void>();
  const emit = (event: StoreEvent) => {
    for (const listener of listeners) listener(event);
  };

  const changedKeys = () =>
    [...new Set<Key>([...published.keys(), ...draft.keys()])]
      .filter((key) => published.get(key) !== draft.get(key))
      .sort();
  const draftRevision = () =>
    `memory:${createHash("sha256")
      .update(JSON.stringify(changedKeys().map((key) => [key, draft.get(key) ?? null])))
      .digest("hex")}`;

  function snapshot(): Snapshot {
    const result = emptySnapshot();
    for (const [key, value] of draft) {
      const { collection, id } = split(key);
      (result[collection] as Map<string, Entry>).set(id, { value, revision: revisionOf(value) });
    }
    return result;
  }

  const put: Put = (collection, id, value) => {
    draft.set(recordKey(collection, id), value);
    return revisionOf(value);
  };

  function assertRevision(expected: string) {
    if (expected !== draftRevision()) {
      throw new StoreError("draft_changed", {
        cs: "Koncept se od zobrazení změnil.",
        en: "The draft changed since it was shown.",
      });
    }
  }

  return createRecordStore({
    available: async () => ({ ok: true }),
    read: async (operation) => operation(snapshot()),
    async write(_kind, operation) {
      const result = operation(snapshot(), put);
      emit({ type: "draft-changed" });
      return result;
    },
    async draft(locale): Promise<DraftCard> {
      const keys = changedKeys();
      return {
        status: {
          state: keys.length > 0 ? "draft" : "published",
          branch: "memory",
          ahead: 0,
          behind: 0,
          dirtyPaths: keys,
          head: null,
          conflict: false,
          fetched: false,
        },
        revision: draftRevision(),
        records: keys.map((key) => {
          const { collection, id } = split(key);
          const kind = !published.has(key) ? "created" : !draft.has(key) ? "deleted" : "modified";
          return {
            technicalPath: key,
            revert: { supported: true },
            resource: reviewResource(
              collection,
              id,
              kind,
              published.get(key) as Record<string, unknown> | undefined,
              draft.get(key) as Record<string, unknown> | undefined,
              { changeId: key, technicalRefs: [{ path: key, kind: "canonical_data_path" }] },
              locale,
            ),
          };
        }),
      };
    },
    async publish({ expectedRevision }) {
      assertRevision(expectedRevision);
      published.clear();
      for (const [key, value] of draft) published.set(key, value);
      emit({ type: "draft-changed" });
    },
    async finishSend() {
      throw new StoreError("nothing_to_send", {
        cs: "Nic nečeká na odeslání.",
        en: "Nothing waits to be sent.",
      });
    },
    async discard(scope: DiscardScope, expectedRevision) {
      assertRevision(expectedRevision);
      const keys = scope.kind === "draft" ? changedKeys() : [scope.path];
      for (const key of keys) {
        const value = published.get(key);
        if (value !== undefined) draft.set(key, value);
        else draft.delete(key);
      }
      emit({ type: "records-changed" });
      emit({ type: "draft-changed" });
    },
    async pull() {},
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      listeners.clear();
    },
  });
}
