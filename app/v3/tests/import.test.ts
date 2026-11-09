import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { createMemoryStore } from "../src/data/memory-store.ts";
import { createRepositoryDbStore } from "../src/data/repository-db-store.ts";
import type { QuotesStore } from "../src/data/store.ts";
import { createService } from "../src/service/quotes-service.ts";
import { createFixtureRepo } from "./support/fixture-repo.ts";
import { sampleData } from "./support/seed.ts";

// The repository-db cases run real Git; on a Windows runner they need more
// than bun's default of 5 s per test.
setDefaultTimeout(60_000);

const request = {
  csv: "Kód;Název;MJ;Nákupní cena\nUV-2160;Výškově nastavitelný stůl 160 × 80 cm;ks;9 800,00\nUV-7777;Odkládací stolek;ks;1 100\n",
  options: {
    supplier: "Ukázkový velkoobchod nábytku",
    valid_from: "2026-12-01",
    markup_percent: 45,
    round_to_crowns: true,
  },
};

type Change = (store: QuotesStore) => Promise<unknown>;

/** A colleague's change saved after the import checked its token, before it writes. */
const changes: Record<string, Change> = {
  "an item it writes": async (store) => {
    const desk = await store.getItem("NAB-STUL-160");
    if (!desk) throw new Error("NAB-STUL-160 missing");
    await store.saveItem({ ...desk.value, unit: "colleague-unit" }, desk.revision);
  },
  "another item": async (store) => {
    const lamp = await store.getItem("OSV-LAMPA-LED");
    if (!lamp) throw new Error("OSV-LAMPA-LED missing");
    await store.saveItem({ ...lamp.value, name: "Lampa kolegy" }, lamp.revision);
  },
  "the settings": async (store) => {
    const settings = await store.settings();
    await store.saveSettings({ ...settings.value, default_vat_rate: "reduced" }, settings.revision);
  },
  "a category": async (store) => {
    await store.saveCategory({ id: "doplnky", name: "Doplňky", order: 9 }, null);
  },
};

/** The store as the service sees it, with a colleague saving right before the import writes. */
function racing(store: QuotesStore, change: Change): QuotesStore {
  return {
    ...store,
    async saveItems(entries, options) {
      await change(store);
      return store.saveItems(entries, options);
    },
  };
}

async function refusal(operation: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await operation();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe("an import and a colleague's change between its check and its write", () => {
  for (const [what, change] of Object.entries(changes)) {
    test(`memory: a change of ${what} refuses the import and keeps the colleague's work`, async () => {
      const store = createMemoryStore(sampleData());
      const plain = createService(store, { today: () => "2026-11-09" });
      const { token } = await plain.importPreview(request);
      const service = createService(racing(store, change), { today: () => "2026-11-09" });
      expect(await refusal(() => service.importApply({ ...request, token }))).toBe("preview_stale");
      expect(await store.getItem("UV-7777")).toBeNull();
      if (what === "an item it writes") {
        expect((await store.getItem("NAB-STUL-160"))?.value.unit).toBe("colleague-unit");
      }
    });
  }

  test("repository-db: the write checks the bound data under the engine's gate", async () => {
    const fixture = createFixtureRepo();
    const store = createRepositoryDbStore({
      mountRoot: fixture.mountRoot,
      expect: { remote: fixture.origin, branch: "v3", within: fixture.moduleRoot },
      intervalMs: 0,
    });
    try {
      const plain = createService(store, { today: () => "2026-11-09" });
      for (const change of [changes["an item it writes"], changes["a category"]]) {
        if (!change) throw new Error("missing change");
        const { token } = await plain.importPreview(request);
        const service = createService(racing(store, change), { today: () => "2026-11-09" });
        expect(await refusal(() => service.importApply({ ...request, token }))).toBe(
          "preview_stale",
        );
      }
      expect(await store.getItem("UV-7777")).toBeNull();
      expect((await store.getItem("NAB-STUL-160"))?.value.unit).toBe("colleague-unit");
      // Without a change in between, the same import writes exactly its preview,
      // which now shows the colleague's unit going back to the file's "ks".
      const { preview, token } = await plain.importPreview(request);
      const desk = preview.rows.find((row) => row.kind === "changed");
      expect(desk?.kind === "changed" && desk.fields).toContain("unit");
      const written = await plain.importApply({ ...request, token });
      expect(written.map((entry) => [entry.value.code, entry.value.sale_price])).toEqual([
        ["NAB-STUL-160", 1421000],
        ["UV-7777", 159500],
      ]);
    } finally {
      store.close();
      fixture.cleanup();
    }
  });
});
