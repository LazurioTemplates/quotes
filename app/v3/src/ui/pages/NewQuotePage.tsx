import { Alert, Button } from "design-system/react";
import { useState } from "react";
import { idOfQuote } from "../../domain/quote.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, fieldErrors, PageHeader } from "../components/common.tsx";
import { useLocale, useT } from "../i18n.tsx";
import { href, navigate } from "../routes.ts";

/** A new quote starts as a draft with the next number; the lines come in the editor. */
export function NewQuotePage({
  data,
  onChanged,
}: {
  data: AppData;
  onChanged: () => Promise<void>;
}) {
  const t = useT();
  const locale = useLocale();
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
        title={t("Nová nabídka", "New quote")}
        subtitle={t(
          "Vyberte zákazníka a napište, čeho se nabídka týká. Číslo přidělí aplikace podle formátu z Nastavení; položky doplníte v dalším kroku.",
          "Choose the customer and say what the quote is about. The App gives it the next number in the format of Settings; the lines come in the next step.",
        )}
      />
      {data.customers.length === 0 ? (
        <Alert tone="info" locale={locale}>
          {t("Zatím nemáte žádného zákazníka.", "There is no customer yet.")}{" "}
          <a href={href({ page: "new-customer" })}>{t("Přidejte ho", "Add one")}</a>{" "}
          {t("a pak se sem vraťte.", "and come back here.")}
        </Alert>
      ) : (
        <form className="form" onSubmit={submit}>
          <ErrorNotice error={error} />
          <Field label={t("Zákazník", "Customer")} error={errors.customer_id}>
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              {data.customers.map((entry) => (
                <option key={entry.value.id} value={entry.value.id}>
                  {entry.value.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t("Předmět nabídky", "Subject of the quote")}
            hint={t(
              "Například „Vybavení zasedací místnosti“.",
              "For example “Meeting room furniture”.",
            )}
            error={errors.title}
          >
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </Field>
          <div className="form-actions">
            <Button variant="primary" type="submit" disabled={busy || !title.trim()}>
              {t("Založit koncept", "Create the draft")}
            </Button>
            <Button variant="secondary" href={href({ page: "new-customer" })}>
              {t("Nový zákazník", "New customer")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
