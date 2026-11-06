import { useState } from "react";
import { idOfQuote } from "../../domain/quote.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, fieldErrors, PageHeader } from "../components/common.tsx";
import { href, navigate } from "../routes.ts";

/** A new quote starts as a draft with the next number; the lines come in the editor. */
export function NewQuotePage({
  data,
  onChanged,
}: {
  data: AppData;
  onChanged: () => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState(data.customers[0]?.value.id ?? "");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errors = fieldErrors(error);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api.createQuote({ customer_id: customerId, title });
      await onChanged();
      navigate({ page: "edit-quote", id: idOfQuote(created.value) });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageHeader
        title="Nová nabídka"
        subtitle="Vyberte zákazníka a napište, čeho se nabídka týká. Číslo přidělí aplikace podle formátu z Nastavení; položky doplníte v dalším kroku."
      />
      {data.customers.length === 0 ? (
        <p className="notice notice-info">
          Zatím nemáte žádného zákazníka. <a href={href({ page: "new-customer" })}>Přidejte ho</a>{" "}
          a pak se sem vraťte.
        </p>
      ) : (
        <form className="form" onSubmit={submit}>
          <ErrorNotice error={error} />
          <Field label="Zákazník" error={errors.customer_id}>
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              {data.customers.map((entry) => (
                <option key={entry.value.id} value={entry.value.id}>
                  {entry.value.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Předmět nabídky" hint="Například „Vybavení zasedací místnosti“." error={errors.title}>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </Field>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={busy || !title.trim()}>
              Založit koncept
            </button>
            <a className="button" href={href({ page: "new-customer" })}>
              Nový zákazník
            </a>
          </div>
        </form>
      )}
    </section>
  );
}
