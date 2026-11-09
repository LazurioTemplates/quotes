import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { catalogRevisions, type QuotesStore } from "../src/data/store.ts";
import { withPrice } from "../src/domain/catalog.ts";
import { newItem, newQuote } from "./support/seed.ts";

/**
 * The shared test suite of the storage port. Every implementation runs it:
 * the repository-db store of generation v3 and the memory store today, the
 * Dolt store of generation v4 later. An implementation that passes it can
 * replace another without a change to the server or the UI.
 *
 * `setup` returns a store over the fictional Czech example data.
 */
export function storeContract(
  name: string,
  setup: () => Promise<{ store: QuotesStore; cleanup(): void }>,
) {
  describe(`storage port: ${name}`, () => {
    let store: QuotesStore;
    let cleanup: () => void;

    beforeEach(async () => {
      ({ store, cleanup } = await setup());
    });
    afterEach(() => {
      store.close();
      cleanup();
    });

    const refusal = async (operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch (error) {
        return (error as { code?: string }).code;
      }
      throw new Error("expected a refusal");
    };

    test("reads the settings, categories, items, customers and quotes in order", async () => {
      expect(await store.available()).toEqual({ ok: true });
      expect((await store.settings()).value.quote_number_format).toBe("NAB-{YYYY}-{NNNN}");
      expect((await store.listCategories()).map((entry) => entry.value.id)).toEqual([
        "nabytek",
        "osvetleni",
        "akustika",
        "sluzby",
      ]);
      const items = await store.listItems();
      expect(items).toHaveLength(13);
      expect(items[0]?.value.category).toBe("nabytek");
      expect(items.every((entry) => entry.revision.length > 0)).toBe(true);
      expect((await store.getItem("NAB-ZIDLE-ERGO"))?.value.price_history).toHaveLength(1);
      expect(await store.getItem("NOPE")).toBeNull();
      expect((await store.listCustomers()).map((entry) => entry.value.id)).toEqual([
        "C-0001",
        "C-0003",
        "C-0002",
      ]);
      const quotes = await store.listQuotes();
      expect(quotes.map((entry) => `${entry.value.number}-v${entry.value.version}`)).toEqual([
        "NAB-2026-0005-v1",
        "NAB-2026-0004-v1",
        "NAB-2026-0003-v1",
        "NAB-2026-0002-v1",
        "NAB-2026-0002-v2",
        "NAB-2026-0001-v1",
      ]);
      expect((await store.getQuote("NAB-2026-0002-v2"))?.value.discount_percent).toBe(5);
      expect(await store.check()).toEqual([]);
    });

    test("a published state has no draft", async () => {
      const card = await store.draft();
      expect(card.status?.state).toBe("published");
      expect(card.records ?? []).toEqual([]);
    });

    test("a new quote becomes a draft with one record, labelled in the asked language", async () => {
      const created = await store.saveQuote(newQuote(), null);
      expect((await store.getQuote("NAB-2026-0006-v1"))?.revision).toBe(created.revision);
      const card = await store.draft();
      expect(card.status?.state).toBe("draft");
      expect(card.records?.map((record) => record.resource.label)).toEqual([
        "NAB-2026-0006 (verze 1) · Nová recepce",
      ]);
      const english = await store.draft("en");
      expect(english.records?.[0]?.resource.label).toBe("NAB-2026-0006 (version 1) · Nová recepce");
      expect(english.records?.[0]?.resource.changes[0]?.summary).toBe("New record");
      expect(card.revision).toBeString();
    });

    test("a save names the version it was edited from", async () => {
      const opened = await store.getItem("NAB-KONT-3");
      if (!opened) throw new Error("NAB-KONT-3 missing");
      const saved = await store.saveItem(
        { ...opened.value, name: "Kontejner na kolečkách" },
        opened.revision,
      );
      expect(saved.revision).not.toBe(opened.revision);
      // A second editor that opened the old version is refused, not overwritten.
      expect(
        await refusal(() => store.saveItem({ ...opened.value, unit: "kus" }, opened.revision)),
      ).toBe("record_changed");
      expect((await store.getItem("NAB-KONT-3"))?.value.name).toBe("Kontejner na kolečkách");
      // A new record under an existing id is refused.
      expect(await refusal(() => store.saveItem(newItem("NAB-KONT-3"), null))).toBe(
        "record_changed",
      );
    });

    test("refuses a record that breaks its schema or a rule across records", async () => {
      expect(await refusal(() => store.saveItem({ ...newItem(), name: "" }, null))).toBe(
        "invalid_record",
      );
      expect(await refusal(() => store.saveItem({ ...newItem(), sale_price: 10.5 }, null))).toBe(
        "invalid_record",
      );
      expect(await refusal(() => store.saveItem({ ...newItem(), category: "nowhere" }, null))).toBe(
        "invalid_record",
      );
      const quote = newQuote();
      expect(
        await refusal(() =>
          store.saveQuote({ ...quote, customer: { ...quote.customer, id: "C-0404" } }, null),
        ),
      ).toBe("invalid_record");
      expect(
        await refusal(() => store.saveQuote({ ...quote, version: 2, previous_version: 1 }, null)),
      ).toBe("invalid_record");
      expect((await store.draft()).records ?? []).toEqual([]);
    });

    test("saves an import's items together, or none when one revision is stale", async () => {
      const desk = await store.getItem("NAB-STUL-160");
      const chair = await store.getItem("NAB-ZIDLE-ERGO");
      if (!desk || !chair) throw new Error("sample items missing");
      const repriced = withPrice(
        desk.value,
        { purchase_price: 980000, sale_price: 1421000, valid_from: "2026-12-01" },
        "import",
        "Ceník 12/2026",
      );
      const stale = await (async () => {
        try {
          await store.saveItems([
            { value: repriced, baseRevision: desk.revision },
            { value: { ...chair.value, name: "Židle" }, baseRevision: "sha256:stale" },
          ]);
        } catch (error) {
          return (error as { code?: string }).code;
        }
        return null;
      })();
      expect(stale).toBe("record_changed");
      expect((await store.getItem("NAB-STUL-160"))?.value.sale_price).toBe(1349000);

      const saved = await store.saveItems([
        { value: repriced, baseRevision: desk.revision },
        { value: newItem(), baseRevision: null },
      ]);
      expect(saved.map((entry) => entry.value.code)).toEqual(["NAB-STUL-160", "NAB-STOLEK"]);
      expect((await store.getItem("NAB-STUL-160"))?.value.price_history?.at(-1)?.note).toBe(
        "Ceník 12/2026",
      );
      expect((await store.draft()).records).toHaveLength(2);
    });

    test("reads the catalog at once and saves items only over the catalog it names", async () => {
      const catalog = await store.readCatalog();
      expect(catalog.items).toHaveLength(13);
      expect(catalog.categories.map((entry) => entry.value.id)[0]).toBe("nabytek");
      const unchanged = catalogRevisions(catalog);
      const lamp = catalog.items.find((entry) => entry.value.code === "OSV-LAMPA-LED");
      if (!lamp) throw new Error("OSV-LAMPA-LED missing");
      // A category added after the read: the save is refused and writes nothing.
      await store.saveCategory({ id: "doplnky", name: "Doplňky", order: 9 }, null);
      expect(
        await refusal(() =>
          store.saveItems([{ value: newItem(), baseRevision: null }], { unchanged }),
        ),
      ).toBe("data_changed");
      expect(await store.getItem("NAB-STOLEK")).toBeNull();
      // Over a fresh read it goes through.
      const fresh = catalogRevisions(await store.readCatalog());
      const saved = await store.saveItems(
        [
          { value: newItem(), baseRevision: null },
          { value: { ...lamp.value, name: "Lampa" }, baseRevision: lamp.revision },
        ],
        { unchanged: fresh },
      );
      expect(saved.map((entry) => entry.value.code)).toEqual(["NAB-STOLEK", "OSV-LAMPA-LED"]);
      // The settings changed: refused again.
      const settings = await store.settings();
      const after = catalogRevisions(await store.readCatalog());
      await store.saveSettings({ ...settings.value, validity_days: 14 }, settings.revision);
      expect(
        await refusal(() =>
          store.saveItems([{ value: newItem("NAB-DALSI"), baseRevision: null }], {
            unchanged: after,
          }),
        ),
      ).toBe("data_changed");
    });

    test("publishes exactly the draft that was shown", async () => {
      await store.saveQuote(newQuote(), null);
      const shown = await store.draft();
      await store.saveItem(newItem(), null);
      expect(await refusal(() => store.publish({ expectedRevision: shown.revision ?? "" }))).toBe(
        "draft_changed",
      );
      const current = await store.draft();
      await store.publish({ expectedRevision: current.revision ?? "", summary: "Nová nabídka" });
      const after = await store.draft();
      expect(after.status?.state).toBe("published");
      expect(after.records ?? []).toEqual([]);
      expect(await store.getItem("NAB-STOLEK")).not.toBeNull();
    });

    test("returns one record or the whole draft to the published state", async () => {
      const opened = await store.getCustomer("C-0001");
      if (!opened) throw new Error("C-0001 missing");
      await store.saveCustomer({ ...opened.value, phone: "+420 000 000 999" }, opened.revision);
      await store.saveQuote(newQuote(), null);
      const card = await store.draft();
      const changed = card.records?.find(
        (record) => record.resource.stableResourceId === "customers:C-0001",
      );
      if (!changed) throw new Error("C-0001 is not in the draft");
      await store.discard({ kind: "record", path: changed.technicalPath }, card.revision ?? "");
      expect((await store.getCustomer("C-0001"))?.value.phone).toBe(opened.value.phone);
      expect((await store.draft()).records?.length).toBe(1);

      const rest = await store.draft();
      await store.discard({ kind: "draft" }, rest.revision ?? "");
      expect(await store.getQuote("NAB-2026-0006-v1")).toBeNull();
      expect((await store.draft()).records ?? []).toEqual([]);
    });

    test("tells subscribers that the draft moved", async () => {
      const events: string[] = [];
      const stop = store.subscribe((event) => events.push(event.type));
      await store.saveItem(newItem(), null);
      stop();
      expect(events).toContain("draft-changed");
    });
  });
}
