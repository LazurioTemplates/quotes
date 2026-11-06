import { useState } from "react";
import { marginPercent, priceExpired } from "../../domain/catalog.ts";
import { formatDate, localToday } from "../../domain/common.ts";
import { formatMoney, formatPercent } from "../../domain/money.ts";
import { vatRateById } from "../../domain/settings.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, PageHeader } from "../components/common.tsx";
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
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<unknown>(null);
  const settings = data.settings.value;
  const money = (amount: number) => formatMoney(amount, settings.currency);
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
  const count = (id: string) => data.items.filter((entry) => entry.value.category === id && !entry.value.archived).length;

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
        title="Ceník"
        subtitle="Položky, ze kterých se skládají nabídky. Ceny jsou bez DPH; každá změna ceny se zapíše do historie položky."
        actions={
          <>
            <a className="button" href={href({ page: "import" })}>
              Import ceníku dodavatele
            </a>
            <a className="button button-primary" href={href({ page: "new-item" })}>
              Nová položka
            </a>
          </>
        }
      />
      <nav className="filters" aria-label="Kategorie">
        <a className={`filter${category === null ? " active" : ""}`} href={href({ page: "items", category: null })}>
          Vše ({data.items.filter((entry) => !entry.value.archived).length})
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
          type="search"
          placeholder="Hledat kód, název nebo dodavatele"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Hledat v ceníku"
        />
        <label className="checkbox">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
          Zobrazit vyřazené
        </label>
      </div>
      {items.length === 0 ? (
        <p className="panel empty muted">Žádná položka tomu neodpovídá.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Kód</th>
              <th>Název</th>
              <th>Kategorie</th>
              <th>MJ</th>
              <th className="num">Nákup</th>
              <th className="num">Prodej</th>
              <th className="num">Marže</th>
              <th className="num">DPH</th>
              <th>Platnost ceny</th>
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
                  <td className="num">{item.purchase_price === undefined ? "" : money(item.purchase_price)}</td>
                  <td className="num">{money(item.sale_price)}</td>
                  <td className={`num ${margin !== null && margin < (settings.min_margin_percent ?? 0) ? "warning" : "muted"}`}>
                    {margin === null ? "" : formatPercent(margin)}
                  </td>
                  <td className="num">{rate ? formatPercent(rate.percent) : item.vat_rate}</td>
                  <td>
                    {formatDate(item.valid_from)}
                    {item.valid_to ? ` – ${formatDate(item.valid_to)}` : " –"}
                    {priceExpired(item, today) ? <span className="chip chip-warning">neplatná</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <article className="panel narrow">
        <h2>Kategorie</h2>
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
            placeholder="Nová kategorie"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            aria-label="Název nové kategorie"
          />
          <button className="button" type="submit" disabled={!newCategory.trim()}>
            Přidat
          </button>
        </form>
      </article>
    </section>
  );
}
