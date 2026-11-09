import { Badge, Button, Checkbox, EmptyState, Table } from "design-system/react";
import { useState } from "react";
import { marginPercent, priceExpired } from "../../domain/catalog.ts";
import { localToday } from "../../domain/common.ts";
import { vatRateById } from "../../domain/settings.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, PageHeader } from "../components/common.tsx";
import { useFormat, useT } from "../i18n.tsx";
import { href } from "../routes.ts";

export function ItemListPage({
  data,
  category,
  onChanged,
  today = localToday(),
}: {
  data: AppData;
  category: string | null;
  onChanged: () => Promise<void>;
  today?: string;
}) {
  const t = useT();
  const f = useFormat();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<unknown>(null);
  const settings = data.settings.value;
  const money = (amount: number) => f.money(amount, settings.currency);
  const categoryName = new Map(data.categories.map((entry) => [entry.value.id, entry.value.name]));
  const query = search.trim().toLowerCase();
  const items = data.items
    .map((entry) => entry.value)
    .filter((item) => (category ? item.category === category : true))
    .filter((item) => showArchived || !item.archived)
    .filter(
      (item) =>
        query === "" ||
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        (item.supplier ?? "").toLowerCase().includes(query),
    );
  const count = (id: string) =>
    data.items.filter((entry) => entry.value.category === id && !entry.value.archived).length;

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.createCategory(newCategory);
      setNewCategory("");
      await onChanged();
    } catch (caught) {
      setError(caught);
    }
  }

  return (
    <section>
      <PageHeader
        title={t("Ceník", "Price list")}
        subtitle={t(
          "Položky, ze kterých se skládají nabídky. Ceny jsou bez DPH; každá změna ceny se zapíše do historie položky.",
          "The items quotes are made of. Prices exclude VAT; every change of a price goes into the item's history.",
        )}
        actions={
          <>
            <Button variant="secondary" href={href({ page: "import" })}>
              {t("Import ceníku dodavatele", "Import a supplier's price list")}
            </Button>
            <Button variant="primary" href={href({ page: "new-item" })}>
              {t("Nová položka", "New item")}
            </Button>
          </>
        }
      />
      <nav className="filters" aria-label={t("Kategorie", "Categories")}>
        <a
          className={`filter${category === null ? " active" : ""}`}
          href={href({ page: "items", category: null })}
        >
          {t("Vše", "All")} ({data.items.filter((entry) => !entry.value.archived).length})
        </a>
        {data.categories.map(({ value }) => (
          <a
            key={value.id}
            className={`filter${category === value.id ? " active" : ""}`}
            href={href({ page: "items", category: value.id })}
          >
            {value.name} ({count(value.id)})
          </a>
        ))}
      </nav>
      <div className="toolbar-row">
        <input
          className="ds-input"
          type="search"
          placeholder={t(
            "Hledat kód, název nebo dodavatele",
            "Search a code, a name or a supplier",
          )}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("Hledat v ceníku", "Search the price list")}
        />
        <Checkbox
          id="items-retired"
          label={t("Zobrazit vyřazené", "Show retired items")}
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("Žádná položka tomu neodpovídá.", "No item matches.")}
          headingLevel={2}
        />
      ) : (
        <Table id="items" caption={t("Ceník", "Price list")} hideCaption>
          <thead>
            <tr>
              <th>{t("Kód", "Code")}</th>
              <th>{t("Název", "Name")}</th>
              <th>{t("Kategorie", "Category")}</th>
              <th>{t("MJ", "Unit")}</th>
              <th className="ds-table__num">{t("Nákup", "Purchase")}</th>
              <th className="ds-table__num">{t("Prodej", "Sale")}</th>
              <th className="ds-table__num">{t("Marže", "Margin")}</th>
              <th className="ds-table__num">{t("DPH", "VAT")}</th>
              <th>{t("Platnost ceny", "Price valid")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const margin = marginPercent(item.purchase_price, item.sale_price);
              const rate = vatRateById(settings, item.vat_rate);
              return (
                <tr key={item.code} className={item.archived ? "row-muted" : undefined}>
                  <td>
                    <a className="code-link" href={href({ page: "item", code: item.code })}>
                      {item.code}
                    </a>
                  </td>
                  <td>
                    <a href={href({ page: "item", code: item.code })}>{item.name}</a>
                    {item.supplier ? <div className="muted small">{item.supplier}</div> : null}
                  </td>
                  <td>{categoryName.get(item.category) ?? item.category}</td>
                  <td>{item.unit}</td>
                  <td className="ds-table__num">
                    {item.purchase_price === undefined ? "" : money(item.purchase_price)}
                  </td>
                  <td className="ds-table__num">{money(item.sale_price)}</td>
                  <td
                    className={`ds-table__num ${margin !== null && margin < (settings.min_margin_percent ?? 0) ? "warning" : "muted"}`}
                  >
                    {margin === null ? "" : f.percent(margin)}
                  </td>
                  <td className="ds-table__num">
                    {rate ? f.percent(rate.percent) : item.vat_rate}
                  </td>
                  <td>
                    {f.date(item.valid_from)}
                    {item.valid_to ? ` – ${f.date(item.valid_to)}` : " –"}
                    {priceExpired(item, today) ? (
                      <Badge tone="warning">{t("neplatná", "expired")}</Badge>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <article className="ds-card narrow">
        <h2>{t("Kategorie", "Categories")}</h2>
        <ErrorNotice error={error} />
        <ul className="plain">
          {data.categories.map(({ value }) => (
            <li key={value.id}>
              {value.name} <span className="muted small">({value.id})</span>
            </li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={addCategory}>
          <input
            className="ds-input"
            placeholder={t("Nová kategorie", "New category")}
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            aria-label={t("Název nové kategorie", "Name of the new category")}
          />
          <Button variant="secondary" type="submit" disabled={!newCategory.trim()}>
            {t("Přidat", "Add")}
          </Button>
        </form>
      </article>
    </section>
  );
}
