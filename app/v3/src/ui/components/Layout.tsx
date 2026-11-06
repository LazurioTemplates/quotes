import type { DraftPanelInput } from "@lazurio/repository-db";
import type { ReactNode } from "react";
import type { Localized } from "../../i18n/locale.ts";
import { quotesBrand } from "../../instance/brand.ts";
import { useT } from "../i18n.tsx";
import { href, type Route } from "../routes.ts";

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
  const count = draftCount(draft);
  return (
    <div className="shell">
      <nav className="sidebar" aria-label={t("Hlavní navigace", "Main navigation")}>
        <div className="sidebar-header">
          <span className="sidebar-product">{t("Cenové nabídky", "Quotes")}</span>
          <span className="sidebar-context">{quotesBrand.organization}</span>
        </div>
        <ul className="sidebar-items">
          {NAV.map((item) => {
            const active = item.matches.includes(route.page);
            return (
              <li key={item.label.en}>
                <a
                  className={`sidebar-item${active ? " active" : ""}`}
                  href={href(item.route)}
                  aria-current={active ? "page" : undefined}
                >
                  <span>{t.of(item.label)}</span>
                  {item.route.page === "draft" && count !== null ? (
                    <span
                      className="badge badge-draft"
                      title={t("Nepublikované změny", "Unpublished changes")}
                    >
                      {count}
                    </span>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="content-area">{children}</main>
    </div>
  );
}
