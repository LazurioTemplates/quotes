import type { z } from "zod";
import { compareCategories, compareItems } from "../domain/catalog.ts";
import {
  type CollectionName,
  collections,
  type DataSet,
  type RecordOf,
  recordId,
} from "../domain/collections.ts";
import { checkRules } from "../domain/rules.ts";
import type { Locale, Localized } from "../i18n/locale.ts";
import { StoreError } from "./store.ts";

type Issue = z.core.$ZodIssue;

/** One problem Zod found, in both languages. */
export function issueText(issue: Issue): Localized {
  const raw = issue as Issue & {
    expected?: unknown;
    minimum?: unknown;
    maximum?: unknown;
    origin?: unknown;
    keys?: string[];
    input?: unknown;
  };
  switch (issue.code) {
    case "invalid_type":
      return raw.input === undefined
        ? { cs: "povinné", en: "required" }
        : { cs: `čeká se ${String(raw.expected)}`, en: `expected ${String(raw.expected)}` };
    case "too_small":
      if (raw.origin === "string" && Number(raw.minimum) === 1)
        return { cs: "povinné", en: "required" };
      if (raw.origin === "array") {
        return {
          cs: `aspoň ${String(raw.minimum)} položek`,
          en: `at least ${String(raw.minimum)} item(s)`,
        };
      }
      return { cs: `nejméně ${String(raw.minimum)}`, en: `at least ${String(raw.minimum)}` };
    case "too_big":
      return { cs: `nejvýš ${String(raw.maximum)}`, en: `at most ${String(raw.maximum)}` };
    case "invalid_format":
      return { cs: "nesprávný formát", en: issue.message };
    case "not_multiple_of":
      return { cs: "příliš mnoho desetinných míst", en: "too many decimal places" };
    case "unrecognized_keys":
      return {
        cs: `neznámé pole: ${(raw.keys ?? []).join(", ")}`,
        en: `unknown field: ${(raw.keys ?? []).join(", ")}`,
      };
    case "invalid_value":
      return { cs: "nepovolená hodnota", en: "not an allowed value" };
    default:
      return { cs: issue.message, en: issue.message };
  }
}

/** The problems of a failed parse, by field path, in both languages. */
export function issuesOf(issues: readonly Issue[], drop: readonly (string | number)[] = []) {
  return issues.map((issue) => ({
    path:
      issue.path.filter((part) => !drop.includes(part as string | number)).join(".") || "(record)",
    message: issueText(issue),
  }));
}

/** Parse one record with its schema, or refuse it with every issue named. */
export function parseRecord<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = issuesOf(result.error.issues);
  const list = (locale: Locale) =>
    issues.map((issue) => `${issue.path}: ${issue.message[locale]}`).join("; ");
  throw new StoreError(
    "invalid_record",
    {
      cs: `${label} neodpovídá schématu: ${list("cs")}`,
      en: `${label} does not match its schema: ${list("en")}`,
    },
    issues,
  );
}

export function parseIn<C extends CollectionName>(
  collection: C,
  value: unknown,
  label: string = collection,
): RecordOf[C] {
  return parseRecord(
    collections[collection].record as unknown as z.ZodType<RecordOf[C]>,
    value,
    label,
  );
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

/** A record that could not be read, with why in both languages. */
export interface Problem {
  record: string;
  message: Localized;
}

/** Every record by collection and id, plus records that could not be read. */
export type Snapshot = { [C in CollectionName]: Map<string, Entry<RecordOf[C]>> } & {
  problems: Problem[];
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
  const cs = checkRules(data, "cs");
  const en = checkRules(data, "en");
  const issues = cs.flatMap((issue, index) =>
    wanted.has(issue.record)
      ? [
          {
            path: issue.record,
            message: { cs: issue.message, en: en[index]?.message ?? issue.message },
          },
        ]
      : [],
  );
  if (issues.length === 0) return;
  throw new StoreError(
    "invalid_record",
    {
      cs: issues.map((issue) => `${issue.path}: ${issue.message.cs}`).join("; "),
      en: issues.map((issue) => `${issue.path}: ${issue.message.en}`).join("; "),
    },
    issues,
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
        compareCategories(
          left.value as RecordOf["categories"],
          right.value as RecordOf["categories"],
        ),
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
