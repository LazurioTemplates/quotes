import { useState } from "react";
import { latestVersions } from "../../domain/quote.ts";
import type { AppData } from "../App.tsx";
import { PageHeader } from "../components/common.tsx";
import { href } from "../routes.ts";

export function CustomerListPage({ data }: { data: AppData }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const latest = latestVersions(data.quotes.map((entry) => entry.value));
  const customers = data.customers
    .map((entry) => entry.value)
    .filter((customer) =>
      [customer.name, customer.company_id, customer.contact_person, customer.email, customer.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  return (
    <section>
      <PageHeader
        title="Zákazníci"
        subtitle="Kontakty, kterým posíláte nabídky. Nabídka si údaje zákazníka zkopíruje, dokud je koncept."
        actions={
          <a className="button button-primary" href={href({ page: "new-customer" })}>
            Nový zákazník
          </a>
        }
      />
      <div className="toolbar-row">
        <input
          type="search"
          placeholder="Hledat název, IČO, kontakt, e-mail nebo město"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Hledat zákazníka"
        />
      </div>
      {customers.length === 0 ? (
        <p className="panel empty muted">Žádný zákazník.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Název</th>
              <th>IČO</th>
              <th>Kontaktní osoba</th>
              <th>E-mail</th>
              <th>Obec</th>
              <th className="num">Nabídky</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <a href={href({ page: "customer", id: customer.id })}>{customer.name}</a>
                </td>
                <td>{customer.company_id ?? ""}</td>
                <td>{customer.contact_person ?? ""}</td>
                <td>{customer.email ?? ""}</td>
                <td>{customer.city ?? ""}</td>
                <td className="num">
                  {latest.filter((quote) => quote.customer.id === customer.id).length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
