import type { DraftPanelInput } from "@lazurio/repository-db";
import { Alert, Nav } from "design-system/react";
import type { ReactNode } from "react";
import type { Localized } from "../../i18n/locale.ts";
import { quotesBrand } from "../../instance/brand.ts";
import { useLocale, useT } from "../i18n.tsx";
import { href, type Route } from "../routes.ts";
import { useCanWrite, useReadOnly } from "../write.tsx";

const NAV: { label: Localized; route: Route; matches: Route["page"][] }[] = [
  { label: { cs: "Přehled", en: "Overview" }, route: { page: "overview" }, matches: ["overview"] },
  {
    label: { cs: "Nabídky", en: "Quotes" },
    route: { page: "quotes", status: null },
    matches: ["quotes", "quote", "edit-quote"],
  },
  {
    label: { cs: "Nová nabídka", en: "New quote" },
    route: { page: "new-quote" },
    matches: ["new-quote"],
  },
  {
    label: { cs: "Ceník", en: "Price list" },
    route: { page: "items", category: null },
    matches: ["items", "item", "new-item"],
  },
  {
    label: { cs: "Import ceníku", en: "Price list import" },
    route: { page: "import" },
    matches: ["import"],
  },
  {
    label: { cs: "Zákazníci", en: "Customers" },
    route: { page: "customers" },
    matches: ["customers", "customer", "new-customer"],
  },
  {
    label: { cs: "Nastavení", en: "Settings" },
    route: { page: "settings" },
    matches: ["settings"],
  },
  {
    label: { cs: "Koncept a publikování", en: "Draft & publish" },
    route: { page: "draft" },
    matches: ["draft"],
  },
];

/** How many records the unpublished draft changes; null when there is no draft. */
function draftCount(draft: DraftPanelInput | null): number | null {
  if (!draft?.status) return null;
  const count = draft.records?.length ?? draft.status.dirtyPaths.length;
  return count > 0 ? count : null;
}

export function Layout({
  route,
  draft,
  children,
}: {
  route: Route;
  draft: DraftPanelInput | null;
  children: ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  const count = draftCount(draft);
  const canWrite = useCanWrite();
  const readOnly = useReadOnly();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-product">{t("Cenové nabídky", "Quotes")}</span>
          <span className="sidebar-context">{quotesBrand.organization}</span>
        </div>
        <Nav
          label={t("Hlavní navigace", "Main navigation")}
          items={NAV.filter(
            (item) => canWrite || (item.route.page !== "new-quote" && item.route.page !== "import"),
          ).map((item) => ({
            href: href(item.route),
            label: t.of(item.label),
            current: item.matches.includes(route.page),
            ...(item.route.page === "draft" && count !== null ? { badge: String(count) } : {}),
          }))}
        />
      </aside>
      <main className="content-area">
        {readOnly ? (
          <Alert tone="warning" live="polite" locale={locale}>
            <p>
              {t(
                "Tato kopie Cenových nabídek je teď jen ke čtení: nabídky, ceník, zákazníky ani koncept tu změnit nejde.",
                "This copy of Quotes is read-only now: quotes, the price list, customers and the draft cannot be changed here.",
              )}
            </p>
          </Alert>
        ) : null}
        {children}
      </main>
    </div>
  );
}
