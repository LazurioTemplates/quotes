import { describe, expect, test } from "bun:test";
import { deriveDraftPanel } from "@lazurio/repository-db";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Locale } from "../src/i18n/locale.ts";
import type { AppData } from "../src/ui/App.tsx";
import { englishModel } from "../src/ui/components/DraftCard.tsx";
import { LocaleContext } from "../src/ui/i18n.tsx";
import { CustomerListPage } from "../src/ui/pages/CustomerListPage.tsx";
import { CustomerPage } from "../src/ui/pages/CustomerPage.tsx";
import { ImportPage } from "../src/ui/pages/ImportPage.tsx";
import { ItemListPage } from "../src/ui/pages/ItemListPage.tsx";
import { ItemPage } from "../src/ui/pages/ItemPage.tsx";
import { NewQuotePage } from "../src/ui/pages/NewQuotePage.tsx";
import { OverviewPage } from "../src/ui/pages/OverviewPage.tsx";
import { QuoteDetailPage } from "../src/ui/pages/QuoteDetailPage.tsx";
import { QuoteEditPage } from "../src/ui/pages/QuoteEditPage.tsx";
import { QuoteListPage } from "../src/ui/pages/QuoteListPage.tsx";
import { SettingsPage } from "../src/ui/pages/SettingsPage.tsx";
import { href, parseRoute } from "../src/ui/routes.ts";
import { sampleData } from "./support/seed.ts";

const TODAY = "2026-11-06";

function appData(locale: Locale): AppData {
  const sample = sampleData(locale);
  const stored = <T,>(value: T) => ({ value, revision: "r" });
  return {
    settings: stored(sample.settings),
    categories: sample.categories.map(stored),
    items: sample.items.map(stored),
    customers: sample.customers.map(stored),
    quotes: sample.quotes.map(stored),
  };
}

function render(locale: Locale, node: ReactNode): string {
  return renderToStaticMarkup(
    <LocaleContext.Provider value={locale}>{node}</LocaleContext.Provider>,
  );
}

const changed = async () => {};

/** Every page over the example data of a language. */
function pages(locale: Locale): Record<string, string> {
  const data = appData(locale);
  const prefix = locale === "en" ? "Q" : "NAB";
  return {
    overview: render(locale, <OverviewPage data={data} today={TODAY} />),
    quotes: render(locale, <QuoteListPage data={data} status={null} today={TODAY} />),
    newQuote: render(locale, <NewQuotePage data={data} onChanged={changed} />),
    detail: render(
      locale,
      <QuoteDetailPage
        data={data}
        id={`${prefix}-2026-0004-v1`}
        onChanged={changed}
        today={TODAY}
      />,
    ),
    sent: render(
      locale,
      <QuoteDetailPage
        data={data}
        id={`${prefix}-2026-0002-v2`}
        onChanged={changed}
        today={TODAY}
      />,
    ),
    edit: render(
      locale,
      <QuoteEditPage data={data} id={`${prefix}-2026-0004-v1`} onChanged={changed} />,
    ),
    items: render(
      locale,
      <ItemListPage data={data} category={null} onChanged={changed} today={TODAY} />,
    ),
    item: render(
      locale,
      <ItemPage data={data} code="NAB-ZIDLE-ERGO" onChanged={changed} today={TODAY} />,
    ),
    newItem: render(locale, <ItemPage data={data} code={null} onChanged={changed} today={TODAY} />),
    import: render(locale, <ImportPage data={data} onChanged={changed} today={TODAY} />),
    customers: render(locale, <CustomerListPage data={data} />),
    customer: render(locale, <CustomerPage data={data} id="C-0002" onChanged={changed} />),
    settings: render(locale, <SettingsPage data={data} onChanged={changed} today={TODAY} />),
  };
}

describe("routes", () => {
  test("every page round-trips through its hash", () => {
    for (const route of [
      { page: "overview" },
      { page: "quotes", status: null },
      { page: "quotes", status: "sent" },
      { page: "new-quote" },
      { page: "quote", id: "NAB-2026-0002-v2" },
      { page: "edit-quote", id: "NAB-2026-0004-v1" },
      { page: "items", category: null },
      { page: "items", category: "nabytek" },
      { page: "new-item" },
      { page: "item", code: "NAB-ZIDLE-ERGO" },
      { page: "import" },
      { page: "customers" },
      { page: "new-customer" },
      { page: "customer", id: "C-0001" },
      { page: "settings" },
      { page: "draft" },
    ] as const) {
      expect(parseRoute(href(route))).toEqual(route);
    }
    expect(parseRoute("#/nowhere/at/all").page).toBe("not-found");
  });
});

describe("pages in Czech", () => {
  const html = pages("cs");

  test("the overview, the list and the detail of a quote", () => {
    expect(html.overview).toContain("Přehled nabídek");
    expect(html.overview).toContain("Čekají na odpověď");
    expect(html.quotes).toContain("NAB-2026-0002");
    expect(html.detail).toContain("Kontrola před odesláním");
    expect(html.detail).toContain("Není v ceníku");
    expect(html.sent).toContain("55 296,70 Kč");
    expect(html.sent).toContain("Upravit jako novou verzi");
    expect(html.edit).toContain("Uložit koncept");
  });

  test("the price list with the price history", () => {
    expect(html.items).toContain("Ergonomická kancelářská židle");
    expect(html.item).toContain("Historie cen");
    expect(html.item).toContain("6 490,00 Kč");
  });
});

describe("pages in English", () => {
  const html = pages("en");

  test("say the same in English", () => {
    expect(html.overview).toContain("Quotes overview");
    expect(html.sent).toContain("CZK 55,296.70");
    expect(html.sent).toContain("Edit as a new version");
    expect(html.detail).toContain("Check before sending");
    expect(html.item).toContain("Price history");
    expect(html.settings).toContain("VAT rates");
  });

  test("mix no Czech into an English screen", () => {
    // Labels, hints, placeholders and accessible names included.
    for (const [page, markup] of Object.entries(html)) {
      expect({ page, czech: markup.match(/[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚ]+/g) ?? [] }).toEqual({
        page,
        czech: [],
      });
    }
  });
});

describe("the Draft & Publish card in English", () => {
  test("keeps the engine's state and actions and words them in English", () => {
    const model = deriveDraftPanel({
      status: {
        state: "draft",
        branch: "v3",
        ahead: 0,
        behind: 0,
        dirtyPaths: ["data/items/A.yaml"],
        head: null,
        conflict: false,
        fetched: true,
      },
      revision: "r1",
    });
    const english = englishModel(model);
    expect(english.tone).toBe("draft");
    expect(english.pill).toBe("Draft");
    expect(english.headline).toBe("One change waits to be published.");
    expect(english.actions.map((action) => [action.kind, action.label, action.enabled])).toEqual([
      ["publish", "Publish all", true],
      ["discard_draft", "Discard all", true],
    ]);
    expect(english.revision).toBe("r1");
  });
});
