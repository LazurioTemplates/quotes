import { Button } from "design-system/react";
import { useState } from "react";
import { calculateQuote } from "../../domain/calculate.ts";
import type { Customer } from "../../domain/customer.ts";
import { idOfQuote, latestVersions } from "../../domain/quote.ts";
import type { Localized } from "../../i18n/locale.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, fieldErrors, PageHeader, StatusChip } from "../components/common.tsx";
import { useFormat, useT } from "../i18n.tsx";
import { href, navigate } from "../routes.ts";

const FIELDS: { key: keyof Omit<Customer, "id">; label: Localized; hint?: Localized }[] = [
  { key: "name", label: { cs: "Název nebo jméno", en: "Name" } },
  { key: "company_id", label: { cs: "IČO", en: "Company ID" } },
  { key: "vat_id", label: { cs: "DIČ", en: "VAT ID" } },
  { key: "street", label: { cs: "Ulice a číslo", en: "Street and number" } },
  { key: "postal_code", label: { cs: "PSČ", en: "Postal code" } },
  { key: "city", label: { cs: "Obec", en: "City" } },
  { key: "country", label: { cs: "Stát", en: "Country" } },
  { key: "contact_person", label: { cs: "Kontaktní osoba", en: "Contact person" } },
  {
    key: "email",
    label: { cs: "E-mail", en: "E-mail" },
    hint: { cs: "Sem půjde nabídka.", en: "The quote goes here." },
  },
  { key: "phone", label: { cs: "Telefon", en: "Phone" } },
];

export function CustomerPage({
  data,
  id,
  onChanged,
}: {
  data: AppData;
  id: string | null;
  onChanged: () => Promise<void>;
}) {
  const t = useT();
  const f = useFormat();
  const stored = id ? data.customers.find((entry) => entry.value.id === id) : undefined;
  const [form, setForm] = useState<Partial<Customer>>(() =>
    stored ? { ...stored.value } : { country: t("Česká republika", "Czech Republic") },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errors = fieldErrors(error);
  if (id && !stored) {
    return (
      <section>
        <PageHeader title={t("Zákazník neexistuje", "This customer does not exist")} />
      </section>
    );
  }
  const quotes = stored
    ? latestVersions(data.quotes.map((entry) => entry.value)).filter(
        (quote) => quote.customer.id === id,
      )
    : [];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const record = Object.fromEntries(
      Object.entries(form).filter(([, value]) => typeof value === "string" && value.trim() !== ""),
    ) as Customer;
    try {
      const saved = stored
        ? await api.saveCustomer({ ...record, id: stored.value.id }, stored.revision)
        : await api.createCustomer(record);
      await onChanged();
      navigate({ page: "customer", id: saved.value.id });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow={
          stored ? `${t("Zákazník", "Customer")} ${stored.value.id}` : t("Zákazníci", "Customers")
        }
        title={stored ? stored.value.name : t("Nový zákazník", "New customer")}
        actions={
          stored ? (
            <Button variant="primary" href={href({ page: "new-quote" })}>
              {t("Nová nabídka", "New quote")}
            </Button>
          ) : null
        }
      />
      <div className="detail-grid">
        <form className="form" onSubmit={save}>
          <ErrorNotice error={error} />
          <article className="ds-card">
            <div className="form-grid">
              {FIELDS.map((field) => (
                <Field
                  key={field.key}
                  label={t.of(field.label)}
                  hint={field.hint ? t.of(field.hint) : undefined}
                  error={errors[field.key]}
                  wide={field.key === "name"}
                >
                  <input
                    value={form[field.key] ?? ""}
                    required={field.key === "name"}
                    type={field.key === "email" ? "email" : "text"}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                  />
                </Field>
              ))}
              <Field
                label={t("Poznámka", "Note")}
                hint={t(
                  "Jen pro vás; do nabídky se nekopíruje.",
                  "For you only; never copied into a quote.",
                )}
                wide
              >
                <textarea
                  rows={2}
                  value={form.note ?? ""}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                />
              </Field>
            </div>
          </article>
          <div className="form-actions">
            <Button variant="primary" type="submit" disabled={busy || !form.name?.trim()}>
              {stored
                ? t("Uložit do konceptu", "Save to the draft")
                : t("Založit zákazníka", "Create the customer")}
            </Button>
          </div>
        </form>
        {stored ? (
          <aside className="aside">
            <article className="ds-card">
              <h2>{t("Nabídky", "Quotes")}</h2>
              {quotes.length === 0 ? (
                <p className="muted">{t("Zatím žádná.", "None yet.")}</p>
              ) : (
                <ul className="versions">
                  {quotes.map((quote) => (
                    <li key={quote.number}>
                      <a href={href({ page: "quote", id: idOfQuote(quote) })}>{quote.number}</a>{" "}
                      <StatusChip status={quote.status} />
                      <div className="small">{quote.title}</div>
                      <div className="small muted">
                        {f.date(quote.issue_date)} ·{" "}
                        {f.money(
                          calculateQuote(quote, data.settings.value).payable,
                          quote.currency,
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
