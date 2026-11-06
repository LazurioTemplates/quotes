import { useState } from "react";
import { latestVersions } from "../../domain/quote.ts";
import type { AppData } from "../App.tsx";
import { PageHeader } from "../components/common.tsx";
import { useT } from "../i18n.tsx";
import { href } from "../routes.ts";

export function CustomerListPage({ data }: { data: AppData }) {
  const t = useT();
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
        title={t("Zákazníci", "Customers")}
        subtitle={t(
          "Kontakty, kterým posíláte nabídky. Nabídka si údaje zákazníka zkopíruje, dokud je koncept.",
          "The contacts you send quotes to. A quote copies the customer's details while it is a draft.",
        )}
        actions={
          <a className="button button-primary" href={href({ page: "new-customer" })}>
            {t("Nový zákazník", "New customer")}
          </a>
        }
      />
      <div className="toolbar-row">
        <input
          type="search"
          placeholder={t(
            "Hledat název, IČO, kontakt, e-mail nebo město",
            "Search a name, company ID, contact, e-mail or city",
          )}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("Hledat zákazníka", "Search a customer")}
        />
      </div>
      {customers.length === 0 ? (
        <p className="panel empty muted">{t("Žádný zákazník.", "No customer.")}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("Název", "Name")}</th>
              <th>{t("IČO", "Company ID")}</th>
              <th>{t("Kontaktní osoba", "Contact person")}</th>
              <th>{t("E-mail", "E-mail")}</th>
              <th>{t("Obec", "City")}</th>
              <th className="num">{t("Nabídky", "Quotes")}</th>
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
