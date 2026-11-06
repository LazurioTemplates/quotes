import { useState } from "react";
import { localToday, slugify } from "../../domain/common.ts";
import { EMAIL_PLACEHOLDERS } from "../../domain/email.ts";
import { formatNumber, parsePercent } from "../../domain/money.ts";
import { nextQuoteNumber, numberFormatProblem } from "../../domain/quote.ts";
import { hasPlaceholders, type Settings, type Supplier } from "../../domain/settings.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, fieldErrors, PageHeader } from "../components/common.tsx";

const SUPPLIER_FIELDS: { key: keyof Supplier; label: string }[] = [
  { key: "name", label: "Název Organizace" },
  { key: "company_id", label: "IČO" },
  { key: "vat_id", label: "DIČ" },
  { key: "street", label: "Ulice a číslo" },
  { key: "postal_code", label: "PSČ" },
  { key: "city", label: "Obec" },
  { key: "country", label: "Stát" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefon" },
  { key: "web", label: "Web" },
  { key: "bank_account", label: "Číslo účtu" },
  { key: "registration", label: "Zápis v rejstříku" },
];

interface RateRow {
  id: string;
  label: string;
  percent: string;
}

export function SettingsPage({
  data,
  onChanged,
  today = localToday(),
}: {
  data: AppData;
  onChanged: () => Promise<void>;
  today?: string;
}) {
  const stored = data.settings;
  const [form, setForm] = useState<Settings>(() => structuredClone(stored.value));
  const [rates, setRates] = useState<RateRow[]>(() =>
    stored.value.vat_rates.map((rate) => ({ ...rate, percent: formatNumber(rate.percent) })),
  );
  const [marginText, setMarginText] = useState(
    stored.value.min_margin_percent === undefined ? "" : formatNumber(stored.value.min_margin_percent),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errors = fieldErrors(error);

  const usedRates = new Set(data.items.map((entry) => entry.value.vat_rate));
  const parsedRates = rates.map((rate) => ({ ...rate, value: parsePercent(rate.percent) }));
  const margin = marginText.trim() === "" ? undefined : parsePercent(marginText);
  const formatProblem = numberFormatProblem(form.quote_number_format);
  const preview = formatProblem
    ? null
    : nextQuoteNumber(
        form.quote_number_format,
        today,
        data.quotes.map((entry) => entry.value.number),
      );
  const invalid =
    parsedRates.some((rate) => rate.value === null || !rate.label.trim()) ||
    margin === null ||
    formatProblem !== null;

  const update = (patch: Partial<Settings>) => setForm({ ...form, ...patch });
  const updateSupplier = (key: keyof Supplier, value: string) => {
    const supplier = { ...form.supplier, [key]: value };
    if (value.trim() === "" && key !== "name") delete supplier[key];
    update({ supplier });
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const record: Settings = {
      ...form,
      vat_rates: parsedRates.map((rate) => ({
        id: rate.id || slugify(rate.label) || "sazba",
        label: rate.label.trim(),
        percent: rate.value ?? 0,
      })),
    };
    delete record.min_margin_percent;
    if (margin !== undefined && margin !== null) record.min_margin_percent = margin;
    for (const key of ["default_introduction", "default_terms"] as const) {
      if (!record[key]?.trim()) delete record[key];
    }
    try {
      await api.saveSettings(record, stored.revision);
      await onChanged();
      setSaved(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageHeader
        title="Nastavení nabídek"
        subtitle="Údaje Organizace na nabídce, sazby DPH, číslování a texty. Změna se uloží jako koncept; odeslaných nabídek se netýká."
      />
      <form className="form form-wide" onSubmit={save}>
        <ErrorNotice error={error} />
        {saved ? <p className="notice notice-success">Uloženo do konceptu.</p> : null}
        {hasPlaceholders(form.supplier) ? (
          <p className="notice notice-warning">
            Údaje Organizace jsou zatím zástupné (REPLACE-WITH-…). Doplňte je, jinak kontrola
            nepustí žádnou nabídku k odeslání.
          </p>
        ) : null}

        <article className="panel">
          <h2>Organizace na nabídce</h2>
          <div className="form-grid">
            {SUPPLIER_FIELDS.map((field) => (
              <Field key={field.key} label={field.label} error={errors[`supplier.${field.key}`]} wide={field.key === "registration"}>
                <input value={form.supplier[field.key] ?? ""} onChange={(event) => updateSupplier(field.key, event.target.value)} />
              </Field>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Sazby DPH</h2>
          <p className="small muted">
            Výchozí jsou české sazby 21, 12 a 0 %. Když se sazba změní zákonem, upravte procento tady;
            položky ceníku se sazbou odkazují, nabídky si procento pamatují.
          </p>
          <table className="table compact">
            <thead>
              <tr>
                <th>Název</th>
                <th>Procento</th>
                <th>Id</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {parsedRates.map((rate, index) => (
                <tr key={rate.id || `new-${index}`}>
                  <td>
                    <input aria-label="Název sazby" value={rate.label} onChange={(event) => setRates(rates.map((row, at) => (at === index ? { ...row, label: event.target.value } : row)))} />
                  </td>
                  <td>
                    <input aria-label="Procento sazby" inputMode="decimal" className={rate.value === null ? "invalid" : undefined} value={rate.percent} onChange={(event) => setRates(rates.map((row, at) => (at === index ? { ...row, percent: event.target.value } : row)))} />
                  </td>
                  <td className="muted small">{rate.id || "vznikne z názvu"}</td>
                  <td>
                    <button
                      type="button"
                      className="link danger"
                      disabled={usedRates.has(rate.id) || rate.id === form.default_vat_rate}
                      title={usedRates.has(rate.id) ? "Sazbu používají položky ceníku" : undefined}
                      onClick={() => setRates(rates.filter((_, at) => at !== index))}
                    >
                      Odebrat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="form-row">
            <Field label="Výchozí sazba nových položek" error={errors.default_vat_rate}>
              <select value={form.default_vat_rate} onChange={(event) => update({ default_vat_rate: event.target.value })}>
                {rates.filter((rate) => rate.id).map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.label} {rate.percent} %
                  </option>
                ))}
              </select>
            </Field>
            <div className="field">
              <span className="field-label">&nbsp;</span>
              <button type="button" className="button" onClick={() => setRates([...rates, { id: "", label: "", percent: "" }])}>
                Přidat sazbu
              </button>
            </div>
          </div>
        </article>

        <article className="panel">
          <h2>Číslování a platnost</h2>
          <div className="form-row">
            <Field
              label="Formát čísla nabídky"
              hint={preview ? `Další číslo bude ${preview}. Značky: {YYYY} rok, {YY}, {MM} měsíc, {NNNN} pořadí.` : undefined}
              error={formatProblem ?? errors.quote_number_format}
            >
              <input className="mono" value={form.quote_number_format} onChange={(event) => update({ quote_number_format: event.target.value })} />
            </Field>
            <Field label="Platnost nové nabídky (dní)" error={errors.validity_days}>
              <input type="number" min={1} max={365} value={form.validity_days} onChange={(event) => update({ validity_days: Number(event.target.value) })} />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Měna" error={errors.currency}>
              <select value={form.currency} onChange={(event) => update({ currency: event.target.value })}>
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
              </select>
            </Field>
            <Field label="Zaokrouhlení celkové částky" error={errors.total_rounding}>
              <select value={form.total_rounding} onChange={(event) => update({ total_rounding: event.target.value as Settings["total_rounding"] })}>
                <option value="none">Na haléře (bez zaokrouhlení)</option>
                <option value="whole">Na celé koruny</option>
              </select>
            </Field>
            <Field label="Minimální marže %" hint="Kontrola upozorní na nabídku pod ní." error={margin === null ? "procento" : undefined}>
              <input inputMode="decimal" value={marginText} onChange={(event) => setMarginText(event.target.value)} />
            </Field>
          </div>
        </article>

        <article className="panel">
          <h2>Výchozí texty nabídky</h2>
          <Field label="Úvodní text">
            <textarea rows={2} value={form.default_introduction ?? ""} onChange={(event) => update({ default_introduction: event.target.value })} />
          </Field>
          <Field label="Podmínky">
            <textarea rows={3} value={form.default_terms ?? ""} onChange={(event) => update({ default_terms: event.target.value })} />
          </Field>
        </article>

        <article className="panel">
          <h2>E-mail k nabídce</h2>
          <p className="small muted">
            Text, který aplikace a agent připraví k odeslání. Značky:{" "}
            {EMAIL_PLACEHOLDERS.map((name) => `{${name}}`).join(" ")}
          </p>
          <Field label="Předmět" error={errors["email.subject"]}>
            <input value={form.email.subject} onChange={(event) => update({ email: { ...form.email, subject: event.target.value } })} />
          </Field>
          <Field label="Text" error={errors["email.body"]}>
            <textarea rows={9} value={form.email.body} onChange={(event) => update({ email: { ...form.email, body: event.target.value } })} />
          </Field>
        </article>

        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={busy || invalid}>
            Uložit nastavení do konceptu
          </button>
        </div>
      </form>
    </section>
  );
}
