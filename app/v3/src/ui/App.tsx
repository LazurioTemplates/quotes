import type { DraftPanelInput } from "@lazurio/repository-db";
import { useCallback, useEffect, useState } from "react";
import type { Category, Item } from "../domain/catalog.ts";
import type { Customer } from "../domain/customer.ts";
import type { Quote } from "../domain/quote.ts";
import type { Settings } from "../domain/settings.ts";
import { ApiError, api, type Stored, subscribe } from "./api.ts";
import { Layout } from "./components/Layout.tsx";
import { useT } from "./i18n.tsx";
import { CustomerListPage } from "./pages/CustomerListPage.tsx";
import { CustomerPage } from "./pages/CustomerPage.tsx";
import { DraftPage } from "./pages/DraftPage.tsx";
import { ImportPage } from "./pages/ImportPage.tsx";
import { ItemListPage } from "./pages/ItemListPage.tsx";
import { ItemPage } from "./pages/ItemPage.tsx";
import { NewQuotePage } from "./pages/NewQuotePage.tsx";
import { OverviewPage } from "./pages/OverviewPage.tsx";
import { QuoteDetailPage } from "./pages/QuoteDetailPage.tsx";
import { QuoteEditPage } from "./pages/QuoteEditPage.tsx";
import { QuoteListPage } from "./pages/QuoteListPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { parseRoute, type Route } from "./routes.ts";

/** Everything the pages read, loaded once and again whenever the data moves. */
export interface AppData {
  settings: Stored<Settings>;
  categories: Stored<Category>[];
  items: Stored<Item>[];
  customers: Stored<Customer>[];
  quotes: Stored<Quote>[];
}

function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const update = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}

export function App() {
  const t = useT();
  const route = useHashRoute();
  const [data, setData] = useState<AppData | null>(null);
  const [draft, setDraft] = useState<DraftPanelInput | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const reload = useCallback(async () => {
    try {
      const [settings, categories, items, customers, quotes] = await Promise.all([
        api.settings(),
        api.categories(),
        api.items(),
        api.customers(),
        api.quotes(),
      ]);
      setData({ settings, categories, items, customers, quotes });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    }
  }, []);
  const reloadDraft = useCallback(async () => {
    setDraft(await api.draft().catch(() => null));
  }, []);

  useEffect(() => {
    void reload();
    void reloadDraft();
    return subscribe((type) => {
      if (type === "records-changed") void reload();
      void reloadDraft();
    });
  }, [reload, reloadDraft]);

  const changed = async () => {
    await Promise.all([reload(), reloadDraft()]);
  };

  const quiet =
    error instanceof ApiError &&
    (error.code === "mount_unavailable" || error.code === "settings_missing");
  return (
    <Layout route={route} draft={draft}>
      {error ? (
        <div className={`notice ${quiet ? "notice-info" : "notice-danger"}`} role="alert">
          <strong>
            {quiet
              ? t("Data zatím nejsou k dispozici.", "The data is not available yet.")
              : t("Data se nepodařilo načíst.", "The data could not be loaded.")}
          </strong>{" "}
          {error.message}
        </div>
      ) : null}
      {data ? <Page route={route} data={data} onChanged={changed} /> : null}
      {!data && !error ? <p className="muted">{t("Načítám…", "Loading…")}</p> : null}
    </Layout>
  );
}

function Page({
  route,
  data,
  onChanged,
}: {
  route: Route;
  data: AppData;
  onChanged: () => Promise<void>;
}) {
  const t = useT();
  switch (route.page) {
    case "overview":
      return <OverviewPage data={data} />;
    case "quotes":
      return <QuoteListPage data={data} status={route.status} />;
    case "new-quote":
      return <NewQuotePage data={data} onChanged={onChanged} />;
    case "quote":
      return <QuoteDetailPage key={route.id} data={data} id={route.id} onChanged={onChanged} />;
    case "edit-quote":
      return <QuoteEditPage key={route.id} data={data} id={route.id} onChanged={onChanged} />;
    case "items":
      return <ItemListPage data={data} category={route.category} onChanged={onChanged} />;
    case "new-item":
      return <ItemPage key="new" data={data} code={null} onChanged={onChanged} />;
    case "item":
      return <ItemPage key={route.code} data={data} code={route.code} onChanged={onChanged} />;
    case "import":
      return <ImportPage data={data} onChanged={onChanged} />;
    case "customers":
      return <CustomerListPage data={data} />;
    case "new-customer":
      return <CustomerPage key="new" data={data} id={null} onChanged={onChanged} />;
    case "customer":
      return <CustomerPage key={route.id} data={data} id={route.id} onChanged={onChanged} />;
    case "settings":
      return <SettingsPage key={data.settings.revision} data={data} onChanged={onChanged} />;
    case "draft":
      return <DraftPage onChanged={onChanged} />;
    case "not-found":
      return (
        <section>
          <h1 className="page-title">{t("Stránka neexistuje", "This page does not exist")}</h1>
          <p>
            <a href="#/">{t("Zpět na přehled", "Back to the overview")}</a>
          </p>
        </section>
      );
  }
}
