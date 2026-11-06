import type { z } from "zod";
import { compareCategories, compareItems } from "../domain/catalog.ts";
import {
  type CollectionName,
  collections,
  type DataSet,
  type RecordOf,
  recordId,
} from "../domain/collections.ts";
import { checkRules, type RuleIssue } from "../domain/rules.ts";
import { StoreError } from "./store.ts";

/** Parse one record with its schema, or refuse it with every issue named. */
export function parseRecord<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join(".") || "(record)",
    message: issue.message,
  }));
  throw new StoreError(
    "invalid_record",
    `${label} neodpovídá schématu: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
    issues,
  );
}

export function parseIn<C extends CollectionName>(
  collection: C,
  value: unknown,
  label: string = collection,
): RecordOf[C] {
  return parseRecord(collections[collection].record as unknown as z.ZodType<RecordOf[C]>, value, label);
}

/** The key of a record across collections: `items/NAB-ZIDLE`. */
export function recordKey(collection: CollectionName, id: string): string {
  return `${collection}/${id}`;
}

/** One stored record of any collection. */
export interface Entry<T = unknown> {
  value: T;
  revision: string;
}

/** Every record by collection and id, plus records that could not be read. */
export type Snapshot = { [C in CollectionName]: Map<string, Entry<RecordOf[C]>> } & {
  problems: RuleIssue[];
};

export function emptySnapshot(): Snapshot {
  return {
    settings: new Map(),
    categories: new Map(),
    items: new Map(),
    customers: new Map(),
    quotes: new Map(),
    problems: [],
  };
}

export function dataSetOf(snapshot: Snapshot): DataSet {
  const values = <C extends CollectionName>(collection: C) =>
    [...snapshot[collection].values()].map((entry) => entry.value as RecordOf[C]);
  return {
    settings: snapshot.settings.get("settings")?.value ?? null,
    categories: values("categories"),
    items: values("items"),
    customers: values("customers"),
    quotes: values("quotes"),
  };
}

/**
 * Refuse a save that would break a rule across records (an unknown
 * category, customer or item). Only issues about the saved records count, so
 * an older problem elsewhere never blocks an unrelated edit.
 */
export function assertRulesFor(keys: readonly string[], data: DataSet): void {
  const wanted = new Set(keys);
  const issues = checkRules(data).filter((issue) => wanted.has(issue.record));
  if (issues.length === 0) return;
  throw new StoreError(
    "invalid_record",
    issues.map((issue) => `${issue.record}: ${issue.message}`).join("; "),
    issues.map((issue) => ({ path: issue.record, message: issue.message })),
  );
}

/** The records of a collection in the order the port promises. */
export function ordered<C extends CollectionName>(
  snapshot: Snapshot,
  collection: C,
): Entry<RecordOf[C]>[] {
  const entries = [...snapshot[collection].values()] as Entry<RecordOf[C]>[];
  switch (collection) {
    case "categories":
      return entries.sort((left, right) =>
        compareCategories(left.value as RecordOf["categories"], right.value as RecordOf["categories"]),
      );
    case "items": {
      const compare = compareItems(dataSetOf(snapshot).categories);
      return entries.sort((left, right) =>
        compare(left.value as RecordOf["items"], right.value as RecordOf["items"]),
      );
    }
    case "customers":
      return entries.sort((left, right) =>
        (left.value as RecordOf["customers"]).name.localeCompare(
          (right.value as RecordOf["customers"]).name,
          "cs",
        ),
      );
    case "quotes":
      return entries.sort((left, right) => {
        const a = left.value as RecordOf["quotes"];
        const b = right.value as RecordOf["quotes"];
        return b.number.localeCompare(a.number) || a.version - b.version;
      });
    default:
      return entries;
  }
}

export { recordId };
