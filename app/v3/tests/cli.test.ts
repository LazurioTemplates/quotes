import { describe, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Context, parseArgs, run } from "../src/cli/quotes.ts";
import { createMemoryStore } from "../src/data/memory-store.ts";
import type { Locale } from "../src/i18n/locale.ts";
import { createService } from "../src/service/quotes-service.ts";
import { sampleData } from "./support/seed.ts";

function context(locale: Locale = "cs", json = false) {
  const store = createMemoryStore(sampleData(locale));
  const output: string[] = [];
  const value: Context = {
    store,
    service: createService(store, { today: () => "2026-11-06" }),
    locale,
    json,
    out: (text) => output.push(text),
  };
  return { value, output, store };
}

function withFile(name: string, content: string, use: (path: string) => Promise<void>) {
  const root = mkdtempSync(join(realpathSync.native(tmpdir()), "quotes-cli-"));
  const path = join(root, name);
  writeFileSync(path, content);
  return use(path).finally(() => rmSync(root, { recursive: true, force: true }));
}

describe("the agent's command line", () => {
  test("parses commands, flags and values", () => {
    expect(parseArgs(["items", "--search", "židle", "--json"])).toEqual({
      command: "items",
      args: [],
      flags: new Map<string, string | true>([
        ["search", "židle"],
        ["json", true],
      ]),
    });
  });

  test("finds items by every word", async () => {
    const { value, output } = context();
    expect(await run(parseArgs(["items", "--search", "led panel"]), value)).toBe(0);
    expect(output.join("\n")).toContain("OSV-PANEL-6060");
    expect(output.join("\n")).not.toContain("OSV-LAMPA-LED");
  });

  test("prepares a draft quote from an inquiry and marks what the price list lacks", async () => {
    const { value, output, store } = context();
    await withFile(
      "inquiry.json",
      JSON.stringify({
        customer: { name: "Nová firma s.r.o.", email: "nakup@nova-firma.example" },
        title: "Dvě pracovní místa",
        lines: [
          { code: "NAB-STUL-160", quantity: 2 },
          { code: "NAB-ZIDLE-ERGO", quantity: 2, discount_percent: 5 },
          { name: "Věšák na kabáty", quantity: 1 },
          { name: "Montáž věšáku", quantity: 0.5, unit: "hod", unit_price: "650" },
        ],
        internal_note: "Poptávka e-mailem 6. 11.",
      }),
      async (path) => {
        expect(await run(parseArgs(["quote:new", "--input", path]), value)).toBe(0);
      },
    );
    expect(output.join("\n")).toContain("Koncept nabídky NAB-2026-0006 je uložený");
    expect(output.join("\n")).toContain("Mimo ceník a k doplnění: Věšák na kabáty.");
    const quote = (await store.getQuote("NAB-2026-0006-v1"))?.value;
    expect(quote?.customer).toMatchObject({ id: "C-0004", name: "Nová firma s.r.o." });
    expect(
      quote?.lines.map((line) => [line.item_code ?? null, line.unit_price, line.to_check ?? null]),
    ).toEqual([
      ["NAB-STUL-160", 1349000, null],
      ["NAB-ZIDLE-ERGO", 679000, null],
      [null, 0, "Není v ceníku: doplňte cenu, nebo řádek vyřaďte."],
      [null, 65000, null],
    ]);
    expect((await store.draft()).records).toHaveLength(2);
  });

  test("refuses codes the price list does not have", async () => {
    const { value } = context("en");
    await withFile(
      "inquiry.json",
      JSON.stringify({ customer: "C-0001", title: "x", lines: [{ code: "NOPE", quantity: 1 }] }),
      async (path) => {
        await expect(run(parseArgs(["quote:new", "--input", path]), value)).rejects.toThrow("NOPE");
      },
    );
  });

  test("checks a quote before it goes out, with an exit code", async () => {
    const { value, output } = context();
    expect(await run(parseArgs(["quote:check", "NAB-2026-0004"]), value)).toBe(1);
    expect(output.join("\n")).toContain("CHYBA");
    const english = context("en", true);
    expect(await run(parseArgs(["quote:check", "Q-2026-0004"]), english.value)).toBe(1);
    expect(JSON.parse(english.output.join("")).ready).toBe(false);
  });

  test("lists the quotes and moves one to its next state as a draft", async () => {
    const { value, output, store } = context();
    expect(await run(parseArgs(["quotes", "--status", "sent"]), value)).toBe(0);
    expect(output.join("\n")).toContain("NAB-2026-0002 v2");
    expect(output.join("\n")).not.toContain("NAB-2026-0004");
    expect(await run(parseArgs(["quote:act", "NAB-2026-0002", "accept"]), value)).toBe(0);
    expect((await store.getQuote("NAB-2026-0002-v2"))?.value.status).toBe("accepted");
    await expect(run(parseArgs(["quote:act", "NAB-2026-0004", "send"]), value)).rejects.toThrow(
      "cannot go out",
    );
  });

  test("prepares the e-mail and names the print page", async () => {
    const { value, output } = context("en");
    expect(await run(parseArgs(["quote:email", "Q-2026-0002"]), value)).toBe(0);
    expect(output.join("\n")).toContain("Attachment: Quote-Q-2026-0002-v2.pdf");
    expect(await run(parseArgs(["quote:print", "Q-2026-0002"]), value)).toBe(0);
    expect(output.at(-1)).toBe("/print/quotes/Q-2026-0002-v2?lang=en");
  });

  test("previews a supplier's price list and writes the chosen rows as a draft", async () => {
    const { value, output, store } = context();
    await withFile(
      "cenik.csv",
      "Kód;Název;MJ;Nákupní cena\nUV-2160;Výškově nastavitelný stůl 160 × 80 cm;ks;9 800,00\nUV-7777;Odkládací stolek;ks;1 100\n",
      async (path) => {
        const args = [
          "--csv",
          path,
          "--supplier",
          "Ukázkový velkoobchod nábytku",
          "--markup",
          "45",
          "--round-crowns",
          "--valid-from",
          "2026-12-01",
        ];
        expect(await run(parseArgs(["import:preview", ...args]), value)).toBe(0);
        expect(output.join("\n")).toContain("Nové 1, změněné 1");
        expect(await run(parseArgs(["import:apply", ...args, "--rows", "3"]), value)).toBe(0);
      },
    );
    expect((await store.getItem("UV-7777"))?.value.sale_price).toBe(159500);
    expect((await store.getItem("NAB-STUL-160"))?.value.purchase_price).toBe(940000);
  });

  test("prints its usage for an unknown command", async () => {
    const { value, output } = context();
    expect(await run(parseArgs(["nonsense"]), value)).toBe(2);
    expect(output[0]).toContain("Usage: bun run quotes");
  });
});
