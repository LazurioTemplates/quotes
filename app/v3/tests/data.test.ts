import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml, toStableYaml } from "@lazurio/repository-db";
import { readDataDirectory } from "../src/data/directory.ts";
import { hasPlaceholders } from "../src/domain/settings.ts";
import { LOCALES } from "../src/i18n/locale.ts";
import { seedDirectory } from "./support/seed.ts";

const STARTS = ["empty", "sample"] as const;

describe("the starts this template ships", () => {
  for (const locale of LOCALES) {
    for (const start of STARTS) {
      test(`${locale}/${start} is valid and in the engine's canonical YAML`, () => {
        const root = seedDirectory(locale, start);
        const read = readDataDirectory(root);
        expect(read.issues).toEqual([]);
        for (const collection of readdirSync(root)) {
          for (const file of readdirSync(join(root, collection)).filter((name) =>
            name.endsWith(".yaml"),
          )) {
            const text = readFileSync(join(root, collection, file), "utf8");
            expect(toStableYaml(parseYaml(text))).toBe(text);
          }
        }
      });
    }

    test(`${locale}: the empty start has placeholders and no records of an Organization`, () => {
      const { data } = readDataDirectory(seedDirectory(locale, "empty"));
      expect(data.items.length + data.customers.length + data.quotes.length).toBe(0);
      expect(data.categories.length).toBe(2);
      expect(data.settings && hasPlaceholders(data.settings.supplier)).toBe(true);
      expect(data.settings?.vat_rates.map((rate) => rate.percent)).toEqual([21, 12, 0]);
      expect(data.settings?.language).toBe(locale);
    });
  }

  test("the two languages carry the same example", () => {
    const cs = readDataDirectory(seedDirectory("cs", "sample")).data;
    const en = readDataDirectory(seedDirectory("en", "sample")).data;
    expect(en.items.map((item) => [item.code, item.sale_price])).toEqual(
      cs.items.map((item) => [item.code, item.sale_price]),
    );
    expect(en.quotes.map((quote) => [quote.version, quote.status, quote.lines.length])).toEqual(
      cs.quotes.map((quote) => [quote.version, quote.status, quote.lines.length]),
    );
    const english = JSON.stringify(en);
    expect(english.match(/[ěščřžýáíéůúťďň]/gi) ?? []).toEqual([]);
  });

  test("the example is fictional: reserved domains and placeholder ids only", () => {
    for (const locale of LOCALES) {
      const { data } = readDataDirectory(seedDirectory(locale, "sample"));
      for (const customer of data.customers) expect(customer.email).toMatch(/\.example$/);
      expect(data.settings?.supplier.email).toBe("obchod@example.com");
      expect(data.settings?.supplier.company_id).toBe("00000000");
    }
  });
});
