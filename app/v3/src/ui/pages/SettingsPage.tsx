import { useState } from "react";
import { localToday, slugify } from "../../domain/common.ts";
import { EMAIL_PLACEHOLDERS } from "../../domain/email.ts";

import { nextQuoteNumber, numberFormatProblem } from "../../domain/quote.ts";
import { hasPlaceholders, type Settings, type Supplier } from "../../domain/settings.ts";
import type { Localized } from "../../i18n/locale.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, fieldErrors, PageHeader } from "../components/common.tsx";
import { useFormat, useT } from "../i18n.tsx";

const SUPPLIER_FIELDS: { key: keyof Supplier; label: Localized }[] = [
  { key: "name", label: { cs: "Název Organizace", en: "Name of the Organization" } },
  { key: "company_id", label: { cs: "IČO", en: "Company ID" } },
  { key: "vat_id", label: { cs: "DIČ", en: "VAT ID" } },
  { key: "street", label: { cs: "Ulice a číslo", en: "Street and number" } },
  { key: "postal_code", label: { cs: "PSČ", en: "Postal code" } },
  { key: "city", label: { cs: "Obec", en: "City" } },
  { key: "country", label: { cs: "Stát", en: "Country" } },
  { key: "email", label: { cs: "E-mail", en: "E-mail" } },
  { key: "phone", label: { cs: "Telefon", en: "Phone" } },
  { key: "web", label: { cs: "Web", en: "Website" } },
  { key: "bank_account", label: { cs: "Číslo účtu", en: "Bank account" } },
  { key: "registration", label: { cs: "Zápis v rejstříku", en: "Registration" } },
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
  const t = useT();
  const f = useFormat();
  const stored = data.settings;
  const [form, setForm] = useState<Settings>(() => structuredClone(stored.value));
  const [rates, setRates] = useState<RateRow[]>(() =>
    stored.value.vat_rates.map((rate) => ({ ...rate, percent: f.number(rate.percent) })),
  );
  const [marginText, setMarginText] = useState(
    stored.value.min_margin_percent === undefined ? "" : f.number(stored.value.min_margin_percent),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errors = fieldErrors(error);

  const usedRates = new Set(data.items.map((entry) => entry.value.vat_rate));
  const parsedRates = rates.map((rate) => ({ ...rate, value: f.parsePercent(rate.percent) }));
  const margin = marginText.trim() === "" ? undefined : f.parsePercent(marginText);
  const formatProblem = numberFormatProblem(form.quote_number_format, f.locale);
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
        id: rate.id || slugify(rate.label) || "rate",
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
        title={t("Nastavení nabídek", "Quote settings")}
        subtitle={t(
          "Údaje Organizace na nabídce, sazby DPH, číslování a texty. Změna se uloží jako koncept; odeslaných nabídek se netýká.",
          "The Organization's details on a quote, VAT rates, numbering and texts. A change is saved as a draft; quotes that went out stay as they are.",
        )}
      />
      <form className="form form-wide" onSubmit={save}>
        <ErrorNotice error={error} />
        {saved ? (
          <p className="notice notice-success">
            {t("Uloženo do konceptu.", "Saved to the draft.")}
          </p>
        ) : null}
        {hasPlaceholders(form.supplier) ? (
          <p className="notice notice-warning">
            {t(
              "Údaje Organizace jsou zatím zástupné (REPLACE-WITH-…). Doplňte je, jinak kontrola nepustí žádnou nabídku k odeslání.",
              "The Organization's details are still placeholders (REPLACE-WITH-…). Fill them in, or the check lets no quote go out.",
            )}
          </p>
        ) : null}

        <article className="panel">
          <h2>{t("Organizace na nabídce", "The Organization on a quote")}</h2>
          <div className="form-grid">
            {SUPPLIER_FIELDS.map((field) => (
              <Field
                key={field.key}
                label={t.of(field.label)}
                error={errors[`supplier.${field.key}`]}
                wide={field.key === "registration"}
              >
                <input
                  value={form.supplier[field.key] ?? ""}
                  onChange={(event) => updateSupplier(field.key, event.target.value)}
                />
              </Field>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>{t("Sazby DPH", "VAT rates")}</h2>
          <p className="small muted">
            {t(
              "Výchozí jsou české sazby 21, 12 a 0 %. Když se sazba změní zákonem, upravte procento tady; položky ceníku se sazbou odkazují, nabídky si procento pamatují.",
              "The defaults are the Czech rates of 21, 12 and 0%. When the law changes a rate, change its percentage here; price list items name the rate, quotes keep the percentage.",
            )}
          </p>
          <table className="table compact">
            <thead>
              <tr>
                <th>{t("Název", "Name")}</th>
                <th>{t("Procento", "Percentage")}</th>
                <th>Id</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {parsedRates.map((rate, index) => (
                <tr key={rate.id || `new-${index}`}>
                  <td>
                    <input
                      aria-label={t("Název sazby", "Name of the rate")}
                      value={rate.label}
                      onChange={(event) =>
                        setRates(
                          rates.map((row, at) =>
                            at === index ? { ...row, label: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={t("Procento sazby", "Percentage of the rate")}
                      inputMode="decimal"
                      className={rate.value === null ? "invalid" : undefined}
                      value={rate.percent}
                      onChange={(event) =>
                        setRates(
                          rates.map((row, at) =>
                            at === index ? { ...row, percent: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="muted small">
                    {rate.id || t("vznikne z názvu", "made from the name")}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link danger"
                      disabled={usedRates.has(rate.id) || rate.id === form.default_vat_rate}
                      title={
                        usedRates.has(rate.id)
                          ? t("Sazbu používají položky ceníku", "Price list items use the rate")
                          : undefined
                      }
                      onClick={() => setRates(rates.filter((_, at) => at !== index))}
                    >
                      {t("Odebrat", "Remove")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="form-row">
            <Field
              label={t("Výchozí sazba nových položek", "Default rate of new items")}
              error={errors.default_vat_rate}
            >
              <select
                value={form.default_vat_rate}
                onChange={(event) => update({ default_vat_rate: event.target.value })}
              >
                {rates
                  .filter((rate) => rate.id)
                  .map((rate) => (
                    <option key={rate.id} value={rate.id}>
                      {rate.label} {rate.percent}%
                    </option>
                  ))}
              </select>
            </Field>
            <div className="field">
              <span className="field-label">&nbsp;</span>
              <button
                type="button"
                className="button"
                onClick={() => setRates([...rates, { id: "", label: "", percent: "" }])}
              >
                {t("Přidat sazbu", "Add a rate")}
              </button>
            </div>
          </div>
        </article>

        <article className="panel">
          <h2>{t("Jazyk, číslování a platnost", "Language, numbering and validity")}</h2>
          <Field
            label={t("Jazyk aplikace", "Language of the App")}
            hint={t(
              "Platí, dokud Lazurio aplikaci nepředá jazyk vašeho profilu.",
              "It applies while Lazurio does not hand the App the language of your profile.",
            )}
          >
            <select
              value={form.language ?? "cs"}
              onChange={(event) => update({ language: event.target.value === "en" ? "en" : "cs" })}
            >
              <option value="cs">{t("Čeština", "Czech")}</option>
              <option value="en">{t("Angličtina", "English")}</option>
            </select>
          </Field>
          <div className="form-row">
            <Field
              label={t("Formát čísla nabídky", "Quote number format")}
              hint={
                preview
                  ? t(
                      `Další číslo bude ${preview}. Značky: {YYYY} rok, {YY}, {MM} měsíc, {NNNN} pořadí.`,
                      `The next number will be ${preview}. Tokens: {YYYY} year, {YY}, {MM} month, {NNNN} counter.`,
                    )
                  : undefined
              }
              error={formatProblem ?? errors.quote_number_format}
            >
              <input
                className="mono"
                value={form.quote_number_format}
                onChange={(event) => update({ quote_number_format: event.target.value })}
              />
            </Field>
            <Field
              label={t("Platnost nové nabídky (dní)", "Validity of a new quote (days)")}
              error={errors.validity_days}
            >
              <input
                type="number"
                min={1}
                max={365}
                value={form.validity_days}
                onChange={(event) => update({ validity_days: Number(event.target.value) })}
              />
            </Field>
          </div>
          <div className="form-row">
            <Field label={t("Měna", "Currency")} error={errors.currency}>
              <select
                value={form.currency}
                onChange={(event) => update({ currency: event.target.value })}
              >
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
              </select>
            </Field>
            <Field
              label={t("Zaokrouhlení celkové částky", "Rounding of the total")}
              error={errors.total_rounding}
            >
              <select
                value={form.total_rounding}
                onChange={(event) =>
                  update({ total_rounding: event.target.value as Settings["total_rounding"] })
                }
              >
                <option value="none">
                  {t("Na haléře (bez zaokrouhlení)", "Exact (no rounding)")}
                </option>
                <option value="whole">{t("Na celé koruny", "To whole crowns")}</option>
              </select>
            </Field>
            <Field
              label={t("Minimální marže %", "Minimum margin %")}
              hint={t(
                "Kontrola upozorní na nabídku pod ní.",
                "The check warns about a quote below it.",
              )}
              error={margin === null ? t("procento", "a percentage") : undefined}
            >
              <input
                inputMode="decimal"
                value={marginText}
                onChange={(event) => setMarginText(event.target.value)}
              />
            </Field>
          </div>
        </article>

        <article className="panel">
          <h2>{t("Výchozí texty nabídky", "Default texts of a quote")}</h2>
          <Field label={t("Úvodní text", "Introduction")}>
            <textarea
              rows={2}
              value={form.default_introduction ?? ""}
              onChange={(event) => update({ default_introduction: event.target.value })}
            />
          </Field>
          <Field label={t("Podmínky", "Terms")}>
            <textarea
              rows={3}
              value={form.default_terms ?? ""}
              onChange={(event) => update({ default_terms: event.target.value })}
            />
          </Field>
        </article>

        <article className="panel">
          <h2>{t("E-mail k nabídce", "The e-mail with a quote")}</h2>
          <p className="small muted">
            {t(
              "Text, který aplikace a agent připraví k odeslání. Značky:",
              "The text the App and the agent prepare for sending. Tokens:",
            )}{" "}
            {EMAIL_PLACEHOLDERS.map((name) => `{${name}}`).join(" ")}
          </p>
          <Field label={t("Předmět", "Subject")} error={errors["email.subject"]}>
            <input
              value={form.email.subject}
              onChange={(event) =>
                update({ email: { ...form.email, subject: event.target.value } })
              }
            />
          </Field>
          <Field label={t("Text", "Text")} error={errors["email.body"]}>
            <textarea
              rows={9}
              value={form.email.body}
              onChange={(event) => update({ email: { ...form.email, body: event.target.value } })}
            />
          </Field>
        </article>

        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={busy || invalid}>
            {t("Uložit nastavení do konceptu", "Save the settings to the draft")}
          </button>
        </div>
      </form>
    </section>
  );
}
