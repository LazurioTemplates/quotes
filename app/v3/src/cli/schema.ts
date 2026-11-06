import { join } from "node:path";
import { z } from "zod";
import { COLLECTION_NAMES, collections } from "../domain/collections.ts";
import { DATA_REPO_TEMPLATE } from "./paths.ts";

/**
 * The JSON Schemas of the data repository, generated from the Zod schemas of
 * `src/domain/`: one per collection, describing the whole document (the
 * envelope of repository-db and the record). They are output, never edited by
 * hand: `--write` writes them into the data repository template, `--check`
 * fails when they are stale.
 */
export function renderSchemas(): { file: string; text: string }[] {
  return COLLECTION_NAMES.map((name) => {
    const spec = collections[name];
    const record = z.toJSONSchema(spec.record, { target: "draft-2020-12", io: "input" });
    const { $schema, ...recordSchema } = record as Record<string, unknown>;
    const document = {
      $schema,
      $id: spec.schemaVersion,
      title: `Quotes ${name}`,
      $comment:
        "Generated from the Zod schemas of Quotes (app/v3/src/domain) by `bun run schema:export`. Do not edit.",
      type: "object",
      properties: {
        schemaVersion: { const: spec.schemaVersion },
        id: { type: "string", minLength: 1 },
        record: recordSchema,
      },
      required: ["schemaVersion", "id", "record"],
      additionalProperties: false,
    };
    return { file: `${name}.schema.json`, text: `${JSON.stringify(document, null, 2)}\n` };
  });
}

if (import.meta.main) {
  const mode = process.argv[2];
  if (mode !== "--write" && mode !== "--check") {
    console.error("usage: schema.ts --write | --check");
    process.exit(2);
  }
  const stale: string[] = [];
  for (const { file, text } of renderSchemas()) {
    const path = join(DATA_REPO_TEMPLATE, "schemas", file);
    const current = await Bun.file(path)
      .text()
      .catch(() => null);
    if (current === text) continue;
    if (mode === "--write") await Bun.write(path, text);
    else stale.push(path);
  }
  if (stale.length > 0) {
    console.error(
      `Stale generated JSON Schema, run \`bun run schema:export\`:\n${stale.join("\n")}`,
    );
    process.exit(1);
  }
  console.log(mode === "--write" ? "JSON Schemas written." : "JSON Schemas are current.");
}
