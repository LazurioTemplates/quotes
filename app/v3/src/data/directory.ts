import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COLLECTION_NAMES,
  type CollectionName,
  collections,
  type DataSet,
  type RecordOf,
  recordId,
} from "../domain/collections.ts";
import { checkRules, type RuleIssue } from "../domain/rules.ts";
import { parseIn } from "./records.ts";

/**
 * Reads the records of a plain directory laid out like `db/data/` (one
 * subdirectory per collection, one `<id>.yaml` each, the envelope of
 * repository-db), outside any data checkout: the seeds of this repository
 * (`seed/empty`, `seed/sample`) and `db/data` for `bun run validate:db`. The
 * running App never uses it; its data goes through the storage port.
 */
export interface DirectoryData {
  data: DataSet;
  /** Documents that are not valid, then the rules across records. */
  issues: RuleIssue[];
  documents: number;
}

/** The placeholder that keeps an empty directory in Git; no record. */
const PLACEHOLDER = ".gitkeep";

export function readDataDirectory(root: string): DirectoryData {
  const issues: RuleIssue[] = [];
  const values: { [C in CollectionName]: RecordOf[C][] } = {
    settings: [],
    categories: [],
    items: [],
    customers: [],
    quotes: [],
  };
  let documents = 0;
  if (!existsSync(root)) {
    return {
      data: { settings: null, categories: [], items: [], customers: [], quotes: [] },
      issues: [{ record: root, message: "the directory does not exist" }],
      documents,
    };
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === PLACEHOLDER && entry.isFile()) continue;
    const directory = join(root, entry.name);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      issues.push({ record: directory, message: "not a collection directory" });
      continue;
    }
    const collection = entry.name as CollectionName;
    if (!COLLECTION_NAMES.includes(collection)) {
      issues.push({
        record: directory,
        message: "the collection has no schema in src/domain/collections.ts",
      });
      continue;
    }
    for (const file of readdirSync(directory).sort()) {
      if (file === PLACEHOLDER) continue;
      const path = join(directory, file);
      documents += 1;
      if (!file.endsWith(".yaml") || !lstatSync(path).isFile()) {
        issues.push({ record: path, message: "not a document <id>.yaml" });
        continue;
      }
      const id = decodeURIComponent(file.slice(0, -5));
      const problem = readDocument(path, id, collection, values);
      if (problem) issues.push({ record: path, message: problem });
    }
  }
  const data: DataSet = { ...values, settings: values.settings[0] ?? null };
  issues.push(...checkRules(data));
  return { data, issues, documents };
}

function readDocument<C extends CollectionName>(
  path: string,
  id: string,
  collection: C,
  values: { [K in CollectionName]: RecordOf[K][] },
): string | null {
  let document: unknown;
  try {
    document = Bun.YAML.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return `not YAML (${error instanceof Error ? error.message : String(error)})`;
  }
  if (document === null || typeof document !== "object" || Array.isArray(document)) {
    return "the document is not a mapping";
  }
  const envelope = document as Record<string, unknown>;
  const spec = collections[collection];
  if (envelope.schemaVersion !== spec.schemaVersion) {
    return `schemaVersion is ${JSON.stringify(envelope.schemaVersion)}, expected ${JSON.stringify(spec.schemaVersion)}`;
  }
  if (envelope.id !== id) {
    return `id is ${JSON.stringify(envelope.id)}, the file name says ${JSON.stringify(id)}`;
  }
  try {
    const value = parseIn(collection, envelope.record, path);
    const expected = recordId(collection, value);
    if (expected !== id) return `the record belongs under the id ${expected}`;
    (values[collection] as RecordOf[C][]).push(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
