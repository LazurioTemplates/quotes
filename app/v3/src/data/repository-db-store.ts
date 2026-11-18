import { posix } from "node:path";
import {
  assertDataPath,
  createSyncHost,
  type DraftPanelRecordInput,
  documentFileName,
  parseYaml,
  type RepositoryDb,
  RepositoryDbError,
  readDataFile,
  recordRevision,
  recordRevisionFromBytes,
  type SyncHost,
  type SyncHostStatus,
  writeRecordDraft,
  writeYamlFileAtomic,
} from "@lazurio/repository-db";
import {
  COLLECTION_NAMES,
  type CollectionName,
  collections,
  recordId,
} from "../domain/collections.ts";
import type { Localized } from "../i18n/locale.ts";
import { createRecordStore, type Put } from "./record-store.ts";
import { type Entry, emptySnapshot, parseIn, type Snapshot } from "./records.ts";
import { quotesReviewAdapter } from "./review-adapter.ts";
import type { DraftCard, QuotesStore, StoreEvent } from "./store.ts";
import { readOnly, StoreError } from "./store.ts";

/** `Repository-Db-Source` of every publish from this App. */
const SOURCE = "quotes-v3";

export interface RepositoryDbStoreOptions {
  /** The data checkout, the Module's `db/`. It may not exist yet. */
  mountRoot: string;
  /** The data repository this App serves; another one is refused. */
  expect?: { remote: string; branch: string; within?: string };
  /** Background fetch cadence; `0` runs no timer (tests, the command line). */
  intervalMs?: number;
  /**
   * False for a copy that may not write (the one writer rule): it changes no
   * record and never fetches, pulls or publishes, neither on a timer nor on a
   * read; its status is read from the checkout as it stands. The host keeps
   * its replica.
   */
  writes?: boolean;
}

/**
 * Quotes' storage over repository-db v3.
 *
 * Every collection is the engine's Collection layout: one document
 * `data/<collection>/<id>.yaml` in the envelope `schemaVersion`, `id`,
 * `record`. Every read goes through the sync host's `read`, every write
 * through its queue (`run`) and `Collection.put` with the base revision, so
 * the App never runs Git on its data.
 */
export function createRepositoryDbStore(options: RepositoryDbStoreOptions): QuotesStore {
  const { mountRoot } = options;
  const interval = options.intervalMs ?? 30_000;
  const host: SyncHost = createSyncHost({
    mountRoot,
    intervalMs: interval,
    ...(options.expect ? { expect: options.expect } : {}),
  });
  const writes = options.writes ?? true;
  if (writes && interval > 0) host.start();

  /**
   * A copy that may not write runs no sync host, so it watches its checkout
   * instead: when the host updates the replica (a new commit, a changed
   * draft), an open page hears it. Only local Git state is read, with no
   * fetch, pull or write.
   */
  const watchers = new Set<(event: StoreEvent) => void>();
  let seen: string | null | undefined;
  let lastHead: string | null | undefined;
  async function watch(): Promise<void> {
    const next = await host
      .read((db) => {
        const local = db.status();
        return { head: local.head, state: `${local.head}\n${local.dirtyPaths.join("\n")}` };
      })
      .catch(() => null);
    if (!next) return;
    const changed = seen !== undefined && seen !== next.state;
    const moved = lastHead !== undefined && lastHead !== next.head;
    seen = next.state;
    lastHead = next.head;
    if (!changed) return;
    for (const listener of watchers) {
      if (moved) listener({ type: "records-changed" });
      listener({ type: "draft-changed" });
    }
  }
  let watching: ReturnType<typeof setInterval> | undefined;
  if (!writes && interval > 0) {
    void watch();
    watching = setInterval(() => void watch(), interval);
    (watching as { unref?: () => void }).unref?.();
  }

  /**
   * The status the draft card comes from. A copy that writes lets the host
   * check (fetch, catch up) before the first status; a copy that may not
   * write reads it from the checkout, with no network.
   */
  async function status(): Promise<
    Pick<SyncHostStatus, "available" | "error" | "sync" | "conflict" | "pullBlocked" | "draftOwner">
  > {
    const known = host.status();
    if (known.sync) return known;
    if (writes) return host.refresh().catch(() => host.status());
    return host
      .read((db) => ({
        available: true,
        error: null,
        sync: db.status(),
        conflict: db.conflict() ?? null,
        pullBlocked: null,
        draftOwner: db.draftOwner() ?? null,
      }))
      .catch((error: unknown) => ({
        available: false,
        error: {
          code: error instanceof RepositoryDbError ? error.code : "mount_unavailable",
          message: error instanceof Error ? error.message : String(error),
        },
        sync: null,
        conflict: null,
        pullBlocked: null,
        draftOwner: null,
      }));
  }

  const pathOf = (db: RepositoryDb, collection: CollectionName, id: string) =>
    posix.join(db.config.layout.data, collection, documentFileName(id));

  const collectionOf = (db: RepositoryDb, collection: CollectionName) =>
    db.collection<unknown>(collection, {
      schemaVersion: collections[collection].schemaVersion,
      parser: collections[collection].record as { parse(value: unknown): unknown },
    });

  function snapshot(db: RepositoryDb): Snapshot {
    const result = emptySnapshot();
    for (const collection of COLLECTION_NAMES) {
      const spec = collections[collection];
      for (const id of collectionOf(db, collection).listIds()) {
        const path = pathOf(db, collection, id);
        const text = readDataFile(mountRoot, path);
        if (text === null) continue;
        const problem = (message: Localized) => result.problems.push({ record: path, message });
        let document: Record<string, unknown> | null;
        try {
          document = parseYaml(text) as Record<string, unknown> | null;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          problem({ cs: `není to YAML (${reason})`, en: `not YAML (${reason})` });
          continue;
        }
        if (!document || typeof document !== "object" || Array.isArray(document)) {
          problem({ cs: "dokument není mapa", en: "the document is not a mapping" });
          continue;
        }
        if (document.schemaVersion !== spec.schemaVersion) {
          const found = String(document.schemaVersion);
          problem({
            cs: `schemaVersion je ${found}, čeká se ${spec.schemaVersion}`,
            en: `schemaVersion is ${found}, expected ${spec.schemaVersion}`,
          });
          continue;
        }
        if (document.id !== id) {
          const found = String(document.id);
          problem({
            cs: `id ${found} neodpovídá souboru`,
            en: `the id ${found} does not match the file`,
          });
          continue;
        }
        try {
          const value = parseIn(collection, document.record, path);
          const expected = recordId(collection, value as never);
          if (expected !== id) {
            problem({
              cs: `záznam patří pod id ${expected}`,
              en: `the record belongs under the id ${expected}`,
            });
            continue;
          }
          (result[collection] as Map<string, Entry>).set(id, {
            value,
            revision: recordRevisionFromBytes(Buffer.from(text, "utf8")),
          });
        } catch (error) {
          problem(
            error instanceof StoreError ? error.text : { cs: String(error), en: String(error) },
          );
        }
      }
    }
    return result;
  }

  const store = createRecordStore({
    async available() {
      try {
        await host.read(() => true);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          code: error instanceof RepositoryDbError ? error.code : "mount_unavailable",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    read: (operation) => engine(() => host.read((db) => operation(snapshot(db)))),
    // One write is one pass through the engine's draft write gate, the lock
    // every engine writer takes, in this process and in others (the App, the
    // command line, an agent's repository-db CLI): the snapshot is read under
    // it, every check runs on that snapshot, and every record is written
    // before it is released. Nothing an engine writer saves can land between
    // a check and a write, also for a save of several records with the
    // revisions of others it depends on (an import).
    write: (kind, operation) =>
      engine(() =>
        host.run(kind, (db) => {
          const written: string[] = [];
          const gate = assertDataPath(mountRoot, db.config.layout.data);
          const result = writeRecordDraft(mountRoot, gate, {}, () => {
            const put: Put = (collection, id, value, baseRevision) => {
              const path = pathOf(db, collection, id);
              const file = assertDataPath(mountRoot, path);
              // The gate is held: the file is the version the checks read.
              if (recordRevision(file) !== baseRevision) {
                throw new StoreError("record_changed", {
                  cs: `${path} se mezitím změnil; nic se neuložilo.`,
                  en: `${path} changed meanwhile; nothing was saved.`,
                });
              }
              writeYamlFileAtomic(file, {
                schemaVersion: collections[collection].schemaVersion,
                id,
                record: value,
              });
              written.push(path);
              return recordRevision(file) as string;
            };
            return operation(snapshot(db), put);
          });
          if (written.length > 0) db.recordOrigin(written, { kind: "app", source: SOURCE });
          return result;
        }),
      ),
    async draft(locale): Promise<DraftCard> {
      // The host computes its status in the background; before the first
      // check (or without a timer) it is computed now.
      const current = await status();
      if (!current.available) {
        return {
          status: null,
          unavailableReason:
            current.error?.message ??
            (locale === "en" ? "The data is not available yet." : "Data zatím nejsou k dispozici."),
        };
      }
      return engine(() =>
        host.read(async (db) => {
          const review = await db.review({ adapters: [quotesReviewAdapter(locale)] });
          const paths = review.resources.flatMap(
            (resource) => resource.changes[0]?.technicalRefs[0]?.path ?? [],
          );
          const reverts = db.canRevertRecords(paths);
          const records: DraftPanelRecordInput[] = review.resources.map((resource) => {
            const technicalPath = resource.changes[0]?.technicalRefs[0]?.path ?? "";
            return {
              resource,
              technicalPath,
              revert: reverts.get(technicalPath) ?? { supported: false },
            };
          });
          const card: DraftCard = {
            status: current.sync,
            conflict: current.conflict,
            pullBlocked: current.pullBlocked,
            publishReadiness: review.publishReadiness,
            records,
          };
          if (review.draftRevision !== undefined) card.revision = review.draftRevision;
          if (current.draftOwner) card.draftOwner = { actor: current.draftOwner.actor };
          return card;
        }),
      );
    },
    async publish({ expectedRevision, actor, summary }) {
      await engine(() =>
        host.run("publish", (db) =>
          db.publish({
            expectedRevision,
            source: SOURCE,
            ...(actor ? { actor } : {}),
            ...(summary ? { summary } : {}),
          }),
        ),
      );
    },
    async finishSend(expectedHead) {
      await engine(() => host.run("finish-send", (db) => db.finishSend({ expectedHead })));
    },
    async discard(scope, expectedRevision) {
      await engine(() => host.run("discard", (db) => db.discard({ scope, expectedRevision })));
    },
    async pull() {
      await engine(() => host.run("pull", (db) => db.pull()));
    },
    subscribe(listener) {
      watchers.add(listener);
      const stop = host.subscribe((event) => {
        if (event.type === "remote-pulled") listener({ type: "records-changed" });
        listener({ type: "draft-changed" });
      });
      return () => {
        watchers.delete(listener);
        stop();
      };
    },
    close() {
      host.stop();
      if (watching) clearInterval(watching);
    },
  });
  return writes ? store : readOnly(store);
}

/** Engine errors keep their code, so the UI words them as the engine documents. */
async function engine<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StoreError) throw error;
    if (error instanceof RepositoryDbError) throw new StoreError(error.code, error.message);
    throw error;
  }
}
