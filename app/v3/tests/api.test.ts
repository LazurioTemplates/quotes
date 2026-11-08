import { describe, expect, test } from "bun:test";
import { createMemoryStore } from "../src/data/memory-store.ts";
import { createApi } from "../src/server/api.ts";
import { createPrintHandler } from "../src/server/print.tsx";
import { sampleData } from "./support/seed.ts";

const ORIGIN = "http://127.0.0.1:24928";

function setup(locale: "cs" | "en" = "cs") {
  const store = createMemoryStore(sampleData(locale));
  const api = createApi(store, { allowedOrigins: new Set([ORIGIN]), today: () => "2026-11-06" });
  const call = (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = { origin: ORIGIN },
  ) =>
    api(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: {
          ...headers,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  return { store, call };
}

describe("HTTP API", () => {
  test("reads the settings, the price list, customers and quotes", async () => {
    const { call } = setup();
    expect((await (await call("GET", "/api/items")).json()).length).toBe(13);
    expect(
      (await (await call("GET", "/api/quotes/NAB-2026-0002-v2")).json()).value.discount_percent,
    ).toBe(5);
    expect((await call("GET", "/api/items/NOPE")).status).toBe(404);
    expect((await (await call("GET", "/api/settings")).json()).value.currency).toBe("CZK");
    expect(await (await call("GET", "/api/check")).json()).toEqual([]);
  });

  test("accepts a change only as JSON from the App's own origin", async () => {
    const { call } = setup();
    const input = { customer_id: "C-0001", title: "Test" };
    expect((await call("POST", "/api/quotes", input, {})).status).toBe(403);
    expect(
      (await call("POST", "/api/quotes", input, { origin: "https://evil.example" })).status,
    ).toBe(403);
    expect((await call("POST", "/api/draft/pull", undefined)).status).toBe(415);
  });

  test("creates a quote with the next number, edits it and refreshes the customer's details", async () => {
    const { call } = setup();
    const created = await call("POST", "/api/quotes", {
      customer_id: "C-0001",
      title: "Nová kancelář",
    });
    expect(created.status).toBe(201);
    const { value, revision } = await created.json();
    expect(value).toMatchObject({
      number: "NAB-2026-0006",
      version: 1,
      status: "draft",
      issue_date: "2026-11-06",
      valid_until: "2026-12-06",
    });
    expect(value.terms).toContain("Dodání do tří týdnů");

    const line = {
      id: "l1",
      item_code: "OSV-LAMPA-LED",
      name: "Lampa",
      unit: "ks",
      quantity: 2,
      unit_price: 139000,
      vat_percent: 21,
    };
    const saved = await call("PUT", "/api/quotes/NAB-2026-0006-v1", {
      record: {
        ...value,
        status: "accepted",
        customer: { ...value.customer, name: "Someone else" },
        lines: [line],
      },
      baseRevision: revision,
    });
    expect(saved.status).toBe(200);
    const body = await saved.json();
    expect(body.value.status).toBe("draft");
    expect(body.value.customer.name).toBe("Atelier Ukázka s.r.o.");
    const stale = await call("PUT", "/api/quotes/NAB-2026-0006-v1", {
      record: value,
      baseRevision: revision,
    });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe("record_changed");
  });

  test("a quote goes out only without errors, then locks, then continues as a new version", async () => {
    const { call } = setup();
    const draft = await (await call("GET", "/api/quotes/NAB-2026-0004-v1")).json();
    const refused = await call("POST", "/api/quotes/NAB-2026-0004-v1/action", {
      action: "send",
      baseRevision: draft.revision,
    });
    expect(refused.status).toBe(422);
    const refusal = await refused.json();
    expect(refusal.code).toBe("quote_not_ready");
    expect(refusal.issues[0].path).toBe("l5");

    const sent = await call("POST", "/api/quotes/NAB-2026-0002-v2/action", {
      action: "expire",
      baseRevision: (await (await call("GET", "/api/quotes/NAB-2026-0002-v2")).json()).revision,
    });
    expect(sent.status).toBe(200);
    const expired = await sent.json();
    expect(expired.value.status).toBe("expired");
    const edit = await call("PUT", "/api/quotes/NAB-2026-0002-v2", {
      record: expired.value,
      baseRevision: expired.revision,
    });
    expect((await edit.json()).code).toBe("not_editable");
    expect((await call("POST", "/api/quotes/NAB-2026-0002-v1/version", {})).status).toBe(409);
    const next = await call("POST", "/api/quotes/NAB-2026-0002-v2/version", {});
    expect(next.status).toBe(201);
    expect((await next.json()).value).toMatchObject({
      number: "NAB-2026-0002",
      version: 3,
      status: "draft",
      previous_version: 2,
    });
  });

  test("an item's new price goes into its history", async () => {
    const { call } = setup();
    const lamp = await (await call("GET", "/api/items/OSV-LAMPA-LED")).json();
    const saved = await call("PUT", "/api/items/OSV-LAMPA-LED", {
      record: { ...lamp.value, sale_price: 149000, valid_from: "2026-12-01" },
      baseRevision: lamp.revision,
      note: "Nový kurz",
    });
    const body = await saved.json();
    expect(body.value.valid_from).toBe("2026-12-01");
    expect(body.value.price_history).toEqual([
      {
        valid_from: "2026-12-01",
        purchase_price_before: 89000,
        purchase_price: 89000,
        sale_price_before: 139000,
        sale_price: 149000,
        source: "manual",
        note: "Nový kurz",
      },
    ]);
  });

  test("imports a supplier's price list exactly as the preview showed it", async () => {
    const { call } = setup();
    const request = {
      csv: "Kód;Název;MJ;Nákupní cena\nUV-2160;Výškově nastavitelný stůl 160 × 80 cm;ks;9 800,00\nUV-7777;Odkládací stolek;ks;1 100\nUV-4103;Kontejner se třemi zásuvkami;ks;2 200,00\n",
      options: {
        supplier: "Ukázkový velkoobchod nábytku",
        valid_from: "2026-12-01",
        markup_percent: 45,
        round_to_crowns: true,
      },
    };
    const shown = await (await call("POST", "/api/import/preview", request)).json();
    expect(shown.token).toMatch(/^preview:[0-9a-f]{64}$/);
    expect(shown.preview.counts).toEqual({ new: 1, changed: 2, unchanged: 0, invalid: 0 });
    const refusal = async (body: unknown) => {
      const response = await call("POST", "/api/import/apply", body);
      return [response.status, (await response.json()).code];
    };

    // Other rules than the preview's, with its token: refused, nothing written.
    for (const options of [
      { ...request.options, markup_percent: 90 },
      { ...request.options, round_to_crowns: false },
      { ...request.options, valid_from: "2027-01-01" },
      { ...request.options, category: "sluzby" },
      { ...request.options, supplier: "Jiný dodavatel" },
    ]) {
      expect(await refusal({ ...request, options, token: shown.token, lines: [3] })).toEqual([
        409,
        "preview_stale",
      ]);
    }
    expect(
      await refusal({ ...request, csv: `${request.csv}UV-9;Lampa;ks;100\n`, token: shown.token }),
    ).toEqual([409, "preview_stale"]);
    // A row the preview did not offer to write.
    expect(await refusal({ ...request, token: shown.token, lines: [9] })).toEqual([
      400,
      "bad_request",
    ]);
    expect((await call("GET", "/api/items/UV-7777")).status).toBe(404);

    // A change of the data the preview was computed from: settings, categories, items.
    const settings = await (await call("GET", "/api/settings")).json();
    await call("PUT", "/api/settings", {
      record: { ...settings.value, default_vat_rate: "reduced" },
      baseRevision: settings.revision,
    });
    expect(await refusal({ ...request, token: shown.token })).toEqual([409, "preview_stale"]);
    const afterSettings = await (await call("POST", "/api/import/preview", request)).json();
    await call("POST", "/api/categories", { name: "Doplňky" });
    expect(await refusal({ ...request, token: afterSettings.token })).toEqual([
      409,
      "preview_stale",
    ]);
    const afterCategory = await (await call("POST", "/api/import/preview", request)).json();
    const desk = await (await call("GET", "/api/items/NAB-STUL-160")).json();
    await call("PUT", "/api/items/NAB-STUL-160", {
      record: { ...desk.value, unit: "kus" },
      baseRevision: desk.revision,
    });
    expect(await refusal({ ...request, token: afterCategory.token })).toEqual([
      409,
      "preview_stale",
    ]);
    expect((await call("GET", "/api/items/UV-7777")).status).toBe(404);

    // The current preview saves exactly the rows it showed, with its values.
    const fresh = await (await call("POST", "/api/import/preview", request)).json();
    const applied = await call("POST", "/api/import/apply", {
      ...request,
      token: fresh.token,
      lines: [2, 3],
    });
    expect(applied.status).toBe(200);
    expect(
      (await applied.json()).map((entry: { value: { code: string; sale_price: number } }) => [
        entry.value.code,
        entry.value.sale_price,
      ]),
    ).toEqual([
      ["NAB-STUL-160", 1421000],
      ["UV-7777", 159500],
    ]);
    expect((await (await call("GET", "/api/items/NAB-KONT-3")).json()).value.sale_price).toBe(
      329000,
    );
    // The same token again is stale: the price list changed by the import itself.
    expect(await refusal({ ...request, token: fresh.token, lines: [4] })).toEqual([
      409,
      "preview_stale",
    ]);
  });

  test("a version that went out keeps the settings it went out with", async () => {
    const { call } = setup();
    const settings = await (await call("GET", "/api/settings")).json();
    const created = await (
      await call("POST", "/api/quotes", { customer_id: "C-0002", title: "Recepce" })
    ).json();
    const line = {
      id: "l1",
      item_code: "SLU-MONTAZ",
      name: "Montáž nábytku",
      unit: "hod",
      quantity: 1.5,
      unit_price: 65033,
      vat_percent: 21,
    };
    const saved = await (
      await call("PUT", "/api/quotes/NAB-2026-0006-v1", {
        record: { ...created.value, lines: [line] },
        baseRevision: created.revision,
      })
    ).json();
    const sent = await (
      await call("POST", "/api/quotes/NAB-2026-0006-v1/action", {
        action: "send",
        baseRevision: saved.revision,
      })
    ).json();
    expect(sent.value.sent_settings).toEqual({
      supplier: settings.value.supplier,
      total_rounding: "none",
    });

    // The Organization renames itself and rounds totals to whole crowns afterwards.
    await call("PUT", "/api/settings", {
      record: {
        ...settings.value,
        total_rounding: "whole",
        supplier: { ...settings.value.supplier, name: "Přejmenovaná s.r.o." },
      },
      baseRevision: settings.revision,
    });
    const stored = (await (await call("GET", "/api/quotes/NAB-2026-0006-v1")).json()).value;
    expect(stored.sent_settings.supplier.name).toBe("Example s.r.o.");
    // 1.5 × 650,33 Kč = 975,495 → 975,50 Kč; with VAT 1 180,36 Kč, not rounded to 1 180 Kč.
    const email = await (await call("GET", "/api/quotes/NAB-2026-0006-v1/email")).json();
    expect(email.body).toContain("1\u00a0180,36\u00a0Kč");
    expect(email.body).toContain("Example s.r.o.");
    // A draft follows the current settings.
    const draft = await (await call("GET", "/api/quotes/NAB-2026-0004-v1/email")).json();
    expect(draft.body).toContain("Přejmenovaná s.r.o.");
  });

  test("answers in the language the browser asks for", async () => {
    const { call } = setup("en");
    const headers = { origin: ORIGIN, "accept-language": "en" };
    const missing = await call("GET", "/api/quotes/Q-9-v1", undefined, headers);
    expect((await missing.json()).message).toBe("The quote Q-9-v1 does not exist.");
    const invalid = await call("POST", "/api/customers", { record: { name: "" } }, headers);
    const body = await invalid.json();
    expect(body.code).toBe("invalid_record");
    expect(body.issues).toEqual([{ path: "name", message: "required" }]);
    const czech = await call("POST", "/api/customers", { record: { name: "" } });
    expect((await czech.json()).issues[0].message).toBe("povinné");
    const draft = await (await call("GET", "/api/draft", undefined, headers)).json();
    expect(draft.status.state).toBe("published");
  });

  test("publishes the shown draft and refuses a changed one", async () => {
    const { call } = setup();
    await call("POST", "/api/customers", { record: { name: "Nový zákazník s.r.o." } });
    const draft = await (await call("GET", "/api/draft")).json();
    expect(draft.records.length).toBe(1);
    expect((await call("POST", "/api/draft/publish", { expectedRevision: "stale" })).status).toBe(
      409,
    );
    expect(
      (await call("POST", "/api/draft/publish", { expectedRevision: draft.revision })).status,
    ).toBe(200);
    expect((await (await call("GET", "/api/draft")).json()).records).toEqual([]);
  });
});

describe("the print page", () => {
  test("prints a sent version as it went out, a draft with the current settings", async () => {
    const store = createMemoryStore(sampleData());
    const settings = await store.settings();
    await store.saveSettings(
      {
        ...settings.value,
        total_rounding: "whole",
        supplier: { ...settings.value.supplier, name: "Přejmenovaná s.r.o." },
      },
      settings.revision,
    );
    const print = createPrintHandler(store);
    const sent = (await (await print("/print/quotes/NAB-2026-0002-v2", "cs"))?.text()) ?? "";
    expect(sent).toContain("Example s.r.o.");
    expect(sent).not.toContain("Přejmenovaná");
    expect(sent).toContain("55\u00a0296,70\u00a0Kč");
    expect(sent).not.toContain("Zaokrouhlení");
    const draft = (await (await print("/print/quotes/NAB-2026-0004-v1", "cs"))?.text()) ?? "";
    expect(draft).toContain("Přejmenovaná s.r.o.");
    expect(draft).toContain("Zaokrouhlení");
  });

  test("renders the quote in the design system's look, in Czech or English, without internals", async () => {
    const print = createPrintHandler(createMemoryStore(sampleData()));
    const response = await print("/print/quotes/NAB-2026-0004-v1", null);
    expect(response?.status).toBe(200);
    const html = (await response?.text()) ?? "";
    expect(html).toContain('<html lang="cs" data-theme="light">');
    expect(html).toContain("Cenová nabídka");
    expect(html).toContain("Demo Logistika a.s.");
    expect(html).toContain("--accent: #2d4fd1");
    expect(html).toContain("Koncept");
    expect(html).not.toContain("Poptávka z 5. 11.");
    expect(html).not.toContain("Není v ceníku");
    expect(html).not.toContain("940000");

    const english = createPrintHandler(createMemoryStore(sampleData("en")));
    const page = await english("/print/quotes/Q-2026-0002-v2", "en");
    const text = (await page?.text()) ?? "";
    expect(text).toContain('<html lang="en" data-theme="light">');
    expect(text).toContain("Total incl. VAT");
    expect(text).toContain("CZK 55,296.70");
    expect(text).not.toMatch(/[ěščřžůú]/);
    expect(await english("/print/elsewhere", "en")).toBeNull();
    expect((await english("/print/quotes/Q-1-v1", "en"))?.status).toBe(404);
  });
});
