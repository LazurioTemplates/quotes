import { describe, expect, test } from "bun:test";
import { calculateQuote } from "../src/domain/calculate.ts";
import { sameImportRequest } from "../src/domain/canonical.ts";
import { withPrice } from "../src/domain/catalog.ts";
import { checkQuote } from "../src/domain/checks.ts";
import { addDays, formatDate, slugify } from "../src/domain/common.ts";
import { detectDelimiter, parseCsv } from "../src/domain/csv.ts";
import { nextCustomerId } from "../src/domain/customer.ts";
import { pdfFileName, quoteEmail } from "../src/domain/email.ts";
import {
  guessMapping,
  importedItems,
  itemCodeFor,
  previewImport,
} from "../src/domain/price-import.ts";
import {
  allowedActions,
  applyAction,
  canCreateVersion,
  isPastValidity,
  latestVersions,
  nextQuoteNumber,
  nextVersion,
  numberFormatProblem,
} from "../src/domain/quote.ts";
import { checkRules } from "../src/domain/rules.ts";
import { localeOfAcceptLanguage } from "../src/i18n/locale.ts";
import { newItem, newQuote, sampleData } from "./support/seed.ts";

describe("dates and ids", () => {
  test("dates in Czech and English", () => {
    expect(formatDate("2026-11-06")).toBe("6. 11. 2026");
    expect(formatDate("2026-11-06", "en")).toBe("6 Nov 2026");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(slugify("Kancelářský nábytek")).toBe("kancelarsky-nabytek");
    expect(nextCustomerId(["C-0001", "C-0009", "X"])).toBe("C-0010");
  });

  test("the language of a request", () => {
    expect(localeOfAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
    expect(localeOfAcceptLanguage("de, cs;q=0.5")).toBe("cs");
    expect(localeOfAcceptLanguage(null)).toBe("cs");
  });
});

describe("quote numbers", () => {
  test("continue after the highest number of the period", () => {
    const format = "NAB-{YYYY}-{NNNN}";
    expect(
      nextQuoteNumber(format, "2026-11-06", ["NAB-2026-0004", "NAB-2026-0001", "NAB-2025-0090"]),
    ).toBe("NAB-2026-0005");
    expect(nextQuoteNumber(format, "2027-01-02", ["NAB-2026-0004"])).toBe("NAB-2027-0001");
    expect(nextQuoteNumber("{YY}{MM}-{NNN}", "2026-11-06", ["2611-007", "2610-099"])).toBe(
      "2611-008",
    );
    expect(nextQuoteNumber("Q{NNNNN}", "2026-11-06", [])).toBe("Q00001");
  });

  test("a format needs exactly one counter and safe characters", () => {
    expect(numberFormatProblem("NAB-{YYYY}-{NNNN}")).toBeNull();
    expect(numberFormatProblem("NAB-{YYYY}")).toContain("počítadlo");
    expect(numberFormatProblem("{NN}-{NN}", "en")).toContain("counter");
    expect(numberFormatProblem("NAB/{NNNN}", "en")).toContain("may hold");
  });
});

describe("the lifecycle of a quote", () => {
  const quote = newQuote();

  test("a draft is sent, then accepted, rejected or expired", () => {
    expect(allowedActions(quote)).toEqual(["send"]);
    const sent = applyAction(quote, "send", "2026-11-07", sampleData().settings);
    if ("cs" in sent) throw new Error(sent.en);
    expect(sent.status).toBe("sent");
    expect(sent.sent_at).toBe("2026-11-07");
    expect(sent.sent_settings).toEqual({
      supplier: sampleData().settings.supplier,
      total_rounding: "none",
    });
    expect(allowedActions(sent)).toEqual(["accept", "reject", "expire"]);
    const accepted = applyAction(sent, "accept", "2026-11-10", sampleData().settings);
    if ("cs" in accepted) throw new Error(accepted.en);
    expect(accepted.closed_at).toBe("2026-11-10");
    expect(canCreateVersion(accepted)).toBe(false);
    const refused = applyAction(accepted, "send", "2026-11-11", sampleData().settings);
    expect("cs" in refused && refused.en).toContain("does not allow");
  });

  test("a version that went out keeps its rounding and must keep its settings", () => {
    const data = sampleData();
    const line = {
      id: "l1",
      name: "x",
      unit: "ks",
      quantity: 1,
      unit_price: 1005,
      vat_percent: 21,
    };
    const sent = applyAction({ ...newQuote(), lines: [line] }, "send", "2026-11-07", data.settings);
    if ("cs" in sent) throw new Error(sent.en);
    const rounded = { ...data.settings, total_rounding: "whole" as const };
    expect(calculateQuote({ ...newQuote(), lines: [line] }, rounded).payable).toBe(1200);
    expect(calculateQuote(sent, rounded).payable).toBe(1216);
    const { sent_settings: _kept, ...withoutSettings } = sent;
    const broken = { ...data, quotes: [...data.quotes, withoutSettings] };
    expect(checkRules(broken, "en").map((issue) => issue.message)).toContain(
      "a quote that went out does not keep the settings it went out with",
    );
  });

  test("a new version is a draft with the same number", () => {
    const sent = { ...quote, status: "sent" as const, sent_at: "2026-11-07" };
    expect(canCreateVersion(sent)).toBe(true);
    const next = nextVersion(sent, { validity_days: 30 }, "2026-11-20");
    expect(next).toMatchObject({
      number: quote.number,
      version: 2,
      status: "draft",
      previous_version: 1,
    });
    expect(next.valid_until).toBe("2026-12-20");
    expect("sent_at" in next).toBe(false);
    expect("sent_settings" in next).toBe(false);
    expect(isPastValidity({ status: "sent", valid_until: "2026-11-01" }, "2026-11-02")).toBe(true);
    expect(
      latestVersions([
        { number: "A", version: 1 },
        { number: "A", version: 2 },
        { number: "B", version: 1 },
      ]),
    ).toEqual([
      { number: "B", version: 1 },
      { number: "A", version: 2 },
    ]);
  });
});

describe("the price list", () => {
  test("a new price goes into the history with the price it replaced", () => {
    const item = newItem();
    expect(
      withPrice(
        item,
        { purchase_price: 110000, sale_price: 159000, valid_from: "2026-12-01" },
        "manual",
      ),
    ).toBe(item);
    const changed = withPrice(
      item,
      { purchase_price: 120000, sale_price: 169000, valid_from: "2026-12-01" },
      "import",
      "Ceník 12/2026",
    );
    expect(changed.valid_from).toBe("2026-12-01");
    expect(changed.price_history).toEqual([
      {
        valid_from: "2026-12-01",
        purchase_price_before: 110000,
        purchase_price: 120000,
        sale_price_before: 159000,
        sale_price: 169000,
        source: "import",
        note: "Ceník 12/2026",
      },
    ]);
  });

  test("rules across records name what is missing, in both languages", () => {
    const data = sampleData();
    expect(checkRules(data)).toEqual([]);
    const broken = {
      ...data,
      items: [...data.items, { ...newItem(), category: "nowhere", vat_rate: "none" }],
    };
    expect(checkRules(broken).map((issue) => issue.message)).toEqual([
      "kategorie nowhere neexistuje",
      "sazba DPH none neexistuje",
    ]);
    expect(checkRules(broken, "en")[0]?.message).toBe("the category nowhere does not exist");
    expect(checkRules({ ...data, settings: null }, "en")[0]?.message).toBe(
      "the data has no settings record",
    );
  });
});

describe("the check before sending", () => {
  const data = sampleData();
  const context = { ...data, versions: data.quotes, today: "2026-11-06" };

  test("a quote from the price list is ready", () => {
    expect(checkQuote(newQuote(), context)).toEqual([]);
  });

  test("names what stops it and what deserves a look", () => {
    const quote = data.quotes.find((entry) => entry.number === "NAB-2026-0004");
    if (!quote) throw new Error("NAB-2026-0004 missing");
    const issues = checkQuote(
      {
        ...quote,
        valid_until: "2026-11-01",
        issue_date: "2026-10-01",
        customer: { ...quote.customer, email: undefined },
        lines: [
          ...quote.lines,
          {
            id: "l9",
            item_code: "NAB-ZIDLE-ERGO",
            name: "Židle",
            unit: "ks",
            quantity: 1,
            unit_price: 300000,
            purchase_price: 430000,
            vat_percent: 15,
          },
        ],
      },
      context,
    );
    const codes = issues.map((issue) => `${issue.severity}:${issue.code}`);
    expect(codes).toContain("error:validity_passed");
    expect(codes).toContain("error:line_to_check");
    expect(codes).toContain("warning:zero_price");
    expect(codes).toContain("warning:customer_no_email");
    expect(codes).toContain("warning:customer_changed");
    expect(codes).toContain("warning:price_changed");
    expect(codes).toContain("warning:vat_unknown");
    expect(codes).toContain("warning:vat_changed");
    expect(codes).toContain("warning:below_cost");
    const english = checkQuote(
      { ...quote, lines: [] },
      { ...context, settings: { ...data.settings, supplier: { name: "REPLACE-WITH-ORG-NAME" } } },
      "en",
    );
    expect(english.map((issue) => issue.message)).toEqual([
      "The Organization's details in Settings are still placeholders (REPLACE-WITH-…); fill them in before the quote goes out.",
      "The quote has no line.",
    ]);
  });

  test("an older version and a low margin", () => {
    const old = data.quotes.find(
      (entry) => entry.number === "NAB-2026-0002" && entry.version === 1,
    );
    if (!old) throw new Error("NAB-2026-0002 v1 missing");
    const codes = checkQuote(
      { ...old, status: "draft" },
      { ...context, settings: { ...data.settings, min_margin_percent: 50 } },
    ).map((issue) => issue.code);
    expect(codes).toContain("newer_version");
    expect(codes).toContain("low_margin");
  });
});

describe("the e-mail with a quote", () => {
  test("fills the Organization's template with amounts and dates of the language", () => {
    const data = sampleData();
    const quote = data.quotes.find(
      (entry) => entry.number === "NAB-2026-0002" && entry.version === 2,
    );
    if (!quote) throw new Error("NAB-2026-0002 v2 missing");
    const email = quoteEmail(quote, data.settings);
    expect(email.to).toBe("sam.taylor@vzorova-ucetni.example");
    expect(email.subject).toBe(
      "Cenová nabídka NAB-2026-0002: Akustika a světlo zasedací místnosti",
    );
    expect(email.body).toContain("55 296,70 Kč včetně DPH");
    expect(email.body).toContain("platí do 11. 11. 2026");
    expect(email.attachment).toBe("Nabidka-NAB-2026-0002-v2.pdf");
    const english = sampleData("en");
    const englishQuote = english.quotes.find(
      (entry) => entry.number === "Q-2026-0002" && entry.version === 2,
    );
    if (!englishQuote) throw new Error("Q-2026-0002 v2 missing");
    const mail = quoteEmail(englishQuote, english.settings, "en");
    expect(mail.body).toContain("CZK 55,296.70 including VAT");
    expect(mail.body).toContain("valid until 11 Nov 2026");
    expect(pdfFileName(englishQuote, "en")).toBe("Quote-Q-2026-0002-v2.pdf");
  });
});

describe("a supplier's price list", () => {
  test("two import requests are the same when their CSV and options are", () => {
    const one = {
      csv: "a;b",
      options: { supplier: "S", valid_from: "2026-12-01", markup_percent: 45 },
    };
    const reordered = { markup_percent: 45, valid_from: "2026-12-01", supplier: "S" };
    expect(sameImportRequest(one, { csv: "a;b", options: reordered })).toBe(true);
    expect(
      sameImportRequest(one, { ...one, options: { ...one.options, markup_percent: 90 } }),
    ).toBe(false);
    expect(sameImportRequest(one, { ...one, csv: "a;c" })).toBe(false);
  });

  test("reads CSV the way Czech exports write it", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a,b\n1,2")).toBe(",");
    expect(detectDelimiter("a\tb")).toBe("\t");
    expect(parseCsv('﻿Kód;Název\n"A-1";"Stůl ""Pro""; dub"\r\n\nB-2;Lampa\n')).toEqual([
      ["Kód", "Název"],
      ["A-1", 'Stůl "Pro"; dub'],
      ["B-2", "Lampa"],
    ]);
    expect(parseCsv('a,b\n"line\nbreak",2')).toEqual([
      ["a", "b"],
      ["line\nbreak", "2"],
    ]);
    expect(guessMapping(["Kód zboží", "Název", "MJ", "Nákupní cena", "DPH"])).toEqual({
      code: 0,
      name: 1,
      unit: 2,
      purchase_price: 3,
      vat: 4,
    });
    expect(itemCodeFor("ab/12 x", new Set(["ab-12-x"]))).toBe("ab-12-x-2");
  });

  test("previews new, changed, unchanged and invalid rows and the items the file lacks", () => {
    const data = sampleData();
    const csv = [
      "Kód;Název;MJ;Nákupní cena;DPH",
      "UV-2160;Výškově nastavitelný stůl 160 × 80 cm;ks;9 800,00;21",
      "UV-3301;Ergonomická kancelářská židle;ks;4 300,00;21",
      "UV-7777;Odkládací stolek;ks;1 100;21",
      "UV-4103;Kontejner se třemi zásuvkami;ks;abc;21",
      ";bez kódu;ks;10;21",
      "UV-9999;Lampa;ks;100;15",
    ].join("\n");
    const preview = previewImport({
      csv,
      options: {
        supplier: "Ukázkový velkoobchod nábytku",
        valid_from: "2026-12-01",
        markup_percent: 45,
        round_to_crowns: true,
      },
      items: data.items,
      categories: data.categories,
      settings: data.settings,
    });
    expect(preview.counts).toEqual({ new: 1, changed: 2, unchanged: 0, invalid: 3 });
    const desk = preview.rows.find((row) => row.line === 2);
    expect(desk?.kind === "changed" && desk.item.sale_price).toBe(1421000);
    expect(desk?.kind === "changed" && desk.fields).toEqual(["purchase_price", "sale_price"]);
    const fresh = preview.rows.find((row) => row.line === 4);
    expect(fresh?.kind === "new" && fresh.item).toMatchObject({
      code: "UV-7777",
      sale_price: 159500,
      category: "nabytek",
      vat_rate: "standard",
    });
    expect(
      preview.rows
        .filter((row) => row.kind === "invalid")
        .map((row) => row.kind === "invalid" && row.problems[0]),
    ).toEqual([
      "nákupní cena „abc“ není částka",
      "řádek nemá kód",
      "sazbu DPH „15“ Nastavení nezná",
    ]);
    expect(preview.missing.map((entry) => entry.code)).toEqual(["NAB-SKRIN-80"]);
    expect(importedItems(preview, [4]).map((entry) => entry.item.code)).toEqual(["UV-7777"]);
    expect(importedItems(preview)).toHaveLength(3);
  });

  test("keeps the sale price without a markup and reads English numbers", () => {
    const data = sampleData("en");
    const preview = previewImport({
      csv: 'code,name,unit,purchase price\nUV-3301,Ergonomic office chair,pc,"4,500.00"\n',
      options: { supplier: "Sample Furniture Wholesale", valid_from: "2026-12-01" },
      items: data.items,
      categories: data.categories,
      settings: data.settings,
      locale: "en",
    });
    const chair = preview.rows[0];
    expect(chair?.kind === "changed" && [chair.item.purchase_price, chair.item.sale_price]).toEqual(
      [450000, 679000],
    );
  });
});
