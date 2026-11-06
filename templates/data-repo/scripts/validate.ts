// Validator of the Quotes data repository, run by repository-db before every
// publish (`validate` in repository-db.yaml) and by CI.
//
// Every document `data/<collection>/<id>.yaml` is checked against
// `schemas/<collection>.schema.json`, which the Quotes App generates from its
// Zod schemas: the envelope (`schemaVersion`, `id`, `record`) and the record.
// It has no dependencies (Bun parses the YAML), never leaves this checkout and
// refuses symbolic links. Rules across records (a quote names a customer that
// exists, an item a category) are checked by the App (`bun run validate:db`).
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Schema = {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  multipleOf?: number;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
};

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

/** The subset of JSON Schema 2020-12 that the generated schemas use. */
export function check(schema: Schema, value: unknown, at = ""): string[] {
  const here = at || "(record)";
  if (schema.anyOf || schema.oneOf) {
    const options = schema.anyOf ?? schema.oneOf ?? [];
    const passing = options.filter((option) => check(option, value, at).length === 0).length;
    if (schema.oneOf ? passing !== 1 : passing === 0) {
      return [`${here}: matches none of the allowed shapes`];
    }
    return [];
  }
  const errors: string[] = [];
  for (const part of schema.allOf ?? []) errors.push(...check(part, value, at));
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    const ok = types.includes(actual) || (actual === "integer" && types.includes("number"));
    if (!ok) return [...errors, `${here}: expected ${types.join(" or ")}, got ${actual}`];
  }
  if ("const" in schema && value !== schema.const) {
    errors.push(`${here}: must be ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${here}: must be one of ${schema.enum.join(", ")}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${here}: must not be empty`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${here}: must be at most ${schema.maxLength} characters`);
    }
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) {
      errors.push(`${here}: does not match ${schema.pattern}`);
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${here}: must be at least ${schema.minimum}`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push(`${here}: must be more than ${schema.exclusiveMinimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${here}: must be at most ${schema.maximum}`);
    }
    if (schema.multipleOf !== undefined) {
      const ratio = value / schema.multipleOf;
      if (Math.abs(ratio - Math.round(ratio)) > 1e-9) {
        errors.push(`${here}: must be a multiple of ${schema.multipleOf}`);
      }
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${here}: needs at least ${schema.minItems} item(s)`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...check(schema.items as Schema, item, `${at}/${index}`));
      });
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) errors.push(`${at}/${key}: is required`);
    }
    for (const [key, item] of Object.entries(record)) {
      const property = schema.properties?.[key];
      if (property) errors.push(...check(property, item, `${at}/${key}`));
      else if (schema.additionalProperties === false) errors.push(`${at}/${key}: is not allowed`);
    }
  }
  return errors;
}

function entries(root: string, directory: string): string[] {
  const path = join(root, directory);
  let names: string[];
  try {
    names = readdirSync(path).sort();
  } catch {
    return [];
  }
  return names.map((name) => {
    const child = join(directory, name);
    if (lstatSync(join(root, child)).isSymbolicLink()) {
      throw new Error(`${child} is a symbolic link; links are refused.`);
    }
    return name;
  });
}

export function validateRepository(root: string): string[] {
  const errors: string[] = [];
  for (const collection of entries(root, "data")) {
    if (collection === ".gitkeep") continue;
    const directory = join("data", collection);
    if (!lstatSync(join(root, directory)).isDirectory()) {
      errors.push(`${directory}: not a collection directory`);
      continue;
    }
    let schema: Schema;
    try {
      schema = JSON.parse(readFileSync(join(root, "schemas", `${collection}.schema.json`), "utf8"));
    } catch {
      errors.push(`${directory}: no schema schemas/${collection}.schema.json`);
      continue;
    }
    for (const name of entries(root, directory)) {
      if (name === ".gitkeep") continue;
      const file = join(directory, name);
      if (!name.endsWith(".yaml") || !lstatSync(join(root, file)).isFile()) {
        errors.push(`${file}: not a document <id>.yaml`);
        continue;
      }
      let document: unknown;
      try {
        document = Bun.YAML.parse(readFileSync(join(root, file), "utf8"));
      } catch (error) {
        errors.push(`${file}: not valid YAML (${error instanceof Error ? error.message : error})`);
        continue;
      }
      errors.push(...check(schema, document).map((error) => `${file} ${error}`));
      const id = decodeURIComponent(name.slice(0, -".yaml".length));
      if ((document as { id?: unknown } | null)?.id !== id) {
        errors.push(`${file}: the id must be the file name, ${JSON.stringify(id)}`);
      }
    }
  }
  return errors;
}

if (import.meta.main) {
  const errors = validateRepository(process.cwd());
  if (errors.length > 0) {
    console.error(`Quotes data: ${errors.length} problem(s)`);
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
  }
  console.log("Quotes data: OK");
}
