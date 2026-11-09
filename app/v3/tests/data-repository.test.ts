import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { check, validateRepository } from "../../../templates/data-repo/scripts/validate.ts";
import { renderSchemas } from "../src/cli/schema.ts";
import { collections } from "../src/domain/collections.ts";
import { createFixtureRepo } from "./support/fixture-repo.ts";
import { DATA_REPO_TEMPLATE, newItem, newQuote, sampleData } from "./support/seed.ts";

// The last test builds four data repositories with real Git; on a Windows
// runner that takes longer than bun's default of 5 s per test.
setDefaultTimeout(60_000);

const schema = (file: string) =>
  JSON.parse(readFileSync(join(DATA_REPO_TEMPLATE, "schemas", file), "utf8"));

describe("data repository template", () => {
  test("its JSON Schemas are the ones generated from the Zod schemas", () => {
    for (const { file, text } of renderSchemas()) {
      expect(readFileSync(join(DATA_REPO_TEMPLATE, "schemas", file), "utf8")).toBe(text);
    }
  });

  test("its validator agrees with the Zod schemas on the shape of a record", () => {
    const envelope = (schemaVersion: string, id: string, record: unknown) => ({
      schemaVersion,
      id,
      record,
    });
    const items = schema("items.schema.json");
    const quotes = schema("quotes.schema.json");
    const item = newItem();
    for (const value of [
      item,
      { ...item, name: "" },
      { ...item, sale_price: 10.5 },
      { ...item, sale_price: -1 },
      { ...item, extra: 1 },
      { ...item, valid_from: "2026-13-01" },
      {
        ...item,
        price_history: [
          { valid_from: "2026-01-01", sale_price_before: 1, sale_price: 2, source: "guess" },
        ],
      },
    ]) {
      const ok = collections.items.record.safeParse(value).success;
      expect({
        value,
        ok: check(items, envelope("quotes.item.v1", "X", value)).length === 0,
      }).toEqual({ value, ok });
    }
    const quote = newQuote();
    const [line] = quote.lines;
    if (!line) throw new Error("no line");
    for (const value of [
      quote,
      ...sampleData().quotes,
      { ...quote, status: "lost" },
      { ...quote, lines: [{ ...line, quantity: 0 }] },
      { ...quote, lines: [{ ...line, quantity: 0.0005 }] },
      { ...quote, lines: [{ ...line, quantity: 2.125 }] },
      { ...quote, lines: [{ ...line, vat_percent: 12.345 }] },
      { ...quote, lines: [{ ...line, discount_percent: 101 }] },
      { ...quote, version: 0 },
    ]) {
      const ok = collections.quotes.record.safeParse(value).success;
      expect({
        value,
        ok: check(quotes, envelope("quotes.quote.v1", "X", value)).length === 0,
      }).toEqual({ value, ok });
    }
    expect(check(items, { schemaVersion: "quotes.item.v2", id: "X", record: item })).not.toEqual(
      [],
    );
  });

  test("the validator passes every start in both languages and refuses a broken record", () => {
    const fixtures = (["cs", "en"] as const).flatMap((locale) =>
      (["empty", "sample"] as const).map((start) => createFixtureRepo({ locale, start })),
    );
    try {
      for (const fixture of fixtures) expect(validateRepository(fixture.mountRoot)).toEqual([]);
      const [first] = fixtures;
      if (!first) throw new Error("no fixture");
      writeFileSync(
        join(first.mountRoot, "data", "items", "BROKEN.yaml"),
        "id: OTHER\nrecord:\n  code: BROKEN\nschemaVersion: quotes.item.v1\n",
      );
      const errors = validateRepository(first.mountRoot);
      expect(errors.some((error) => error.includes("/record/name: is required"))).toBe(true);
      expect(errors.some((error) => error.includes("the id must be the file name"))).toBe(true);
    } finally {
      for (const fixture of fixtures) fixture.cleanup();
    }
  });
});
