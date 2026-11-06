import { useState } from "react";
import { calculateQuote } from "../../domain/calculate.ts";
import { formatDate } from "../../domain/common.ts";
import type { Customer } from "../../domain/customer.ts";
import { formatMoney } from "../../domain/money.ts";
import { idOfQuote, latestVersions } from "../../domain/quote.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, fieldErrors, PageHeader, StatusChip } from "../components/common.tsx";
import { href, navigate } from "../routes.ts";

const FIELDS: { key: keyof Omit<Customer, "id">; label: string; hint?: string }[] = [
  { key: "name", label: "Název nebo jméno" },
  { key: "company_id", label: "IČO" },
  { key: "vat_id", label: "DIČ" },
  { key: "street", label: "Ulice a číslo" },
  { key: "postal_code", label: "PSČ" },
  { key: "city", label: "Obec" },
  { key: "country", label: "Stát" },
  { key: "contact_person", label: "Kontaktní osoba" },
  { key: "email", label: "E-mail", hint: "Sem půjde nabídka." },
  { key: "phone", label: "Telefon" },
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
  const stored = id ? data.customers.find((entry) => entry.value.id === id) : undefined;
  const [form, setForm] = useState<Partial<Customer>>(() =>
    stored ? { ...stored.value } : { country: "Česká republika" },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errors = fieldErrors(error);
  if (id && !stored) {
    return (
      <section>
        <PageHeader title="Zákazník neexistuje" />
      </section>
    );
  }
  const quotes = stored
    ? latestVersions(data.quotes.map((entry) => entry.value)).filter((quote) => quote.customer.id === id)
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
        eyebrow={stored ? `Zákazník ${stored.value.id}` : "Zákazníci"}
        title={stored ? stored.value.name : "Nový zákazník"}
        actions={
          stored ? (
            <a className="button button-primary" href={href({ page: "new-quote" })}>
              Nová nabídka
            </a>
          ) : null
        }
      />
      <div className="detail-grid">
        <form className="form" onSubmit={save}>
          <ErrorNotice error={error} />
          <article className="panel">
            <div className="form-grid">
              {FIELDS.map((field) => (
                <Field key={field.key} label={field.label} hint={field.hint} error={errors[field.key]} wide={field.key === "name"}>
                  <input
                    value={form[field.key] ?? ""}
                    required={field.key === "name"}
                    type={field.key === "email" ? "email" : "text"}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                  />
                </Field>
              ))}
              <Field label="Poznámka" hint="Jen pro vás; do nabídky se nekopíruje." wide>
                <textarea rows={2} value={form.note ?? ""} onChange={(event) => setForm({ ...form, note: event.target.value })} />
              </Field>
            </div>
          </article>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={busy || !form.name?.trim()}>
              {stored ? "Uložit do konceptu" : "Založit zákazníka"}
            </button>
          </div>
        </form>
        {stored ? (
          <aside className="aside">
            <article className="panel">
              <h2>Nabídky</h2>
              {quotes.length === 0 ? (
                <p className="muted">Zatím žádná.</p>
              ) : (
                <ul className="versions">
                  {quotes.map((quote) => (
                    <li key={quote.number}>
                      <a href={href({ page: "quote", id: idOfQuote(quote) })}>{quote.number}</a>{" "}
                      <StatusChip status={quote.status} />
                      <div className="small">{quote.title}</div>
                      <div className="small muted">
                        {formatDate(quote.issue_date)} ·{" "}
                        {formatMoney(calculateQuote(quote, data.settings.value).payable, quote.currency)}
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
