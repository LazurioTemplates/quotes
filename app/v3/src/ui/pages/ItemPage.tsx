import { useState } from "react";
import { type Item, marginPercent } from "../../domain/catalog.ts";
import { localToday } from "../../domain/common.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, fieldErrors, PageHeader } from "../components/common.tsx";
import { useFormat, useT } from "../i18n.tsx";
import { href, navigate } from "../routes.ts";

/** One item: its details, its price with the margin, and its price history. A new item without a code. */
export function ItemPage({
  data,
  code,
  onChanged,
  today = localToday(),
}: {
  data: AppData;
  code: string | null;
  onChanged: () => Promise<void>;
  today?: string;
}) {
  const t = useT();
  const f = useFormat();
  const settings = data.settings.value;
  const stored = code ? data.items.find((entry) => entry.value.code === code) : undefined;
  const blank: Item = {
    code: "",
    name: "",
    category: data.categories[0]?.value.id ?? "",
    unit: "ks",
    sale_price: 0,
    vat_rate: settings.default_vat_rate,
    valid_from: today,
  };
  const [form, setForm] = useState<Item>(() => (stored ? structuredClone(stored.value) : blank));
  const [purchaseText, setPurchaseText] = useState(
    stored?.value.purchase_price === undefined ? "" : f.amount(stored.value.purchase_price),
  );
  const [saleText, setSaleText] = useState(stored ? f.amount(stored.value.sale_price) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errors = fieldErrors(error);

  if (code && !stored) {
    return (
      <section>
        <PageHeader title={t("Položka neexistuje", "This item does not exist")} />
        <p>
          <a href={href({ page: "items", category: null })}>
            {t("Zpět na ceník", "Back to the price list")}
          </a>
        </p>
      </section>
    );
  }

  const purchase = purchaseText.trim() === "" ? undefined : f.parseMoney(purchaseText);
  const sale = f.parseMoney(saleText);
  const amountHint = t("částka, např. 1 290,50", "an amount, e.g. 1,290.50");
  const priceChanged =
    stored !== undefined &&
    (sale !== stored.value.sale_price ||
      (purchase ?? null) !== (stored.value.purchase_price ?? null));
  const margin = sale !== null && purchase !== null ? marginPercent(purchase, sale) : null;
  const invalid = purchase === null || sale === null || (purchase ?? 0) < 0 || sale < 0;
  const update = (patch: Partial<Item>) => setForm({ ...form, ...patch });
  const optional = (value: string) => (value.trim() === "" ? undefined : value);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (invalid || sale === null || purchase === null) return;
    setBusy(true);
    setError(null);
    const record: Item = { ...form, sale_price: sale };
    if (purchase === undefined) delete record.purchase_price;
    else record.purchase_price = purchase;
    for (const key of Object.keys(record) as (keyof Item)[]) {
      if (record[key] === undefined || record[key] === "") delete record[key];
    }
    if (!record.archived) delete record.archived;
    try {
      const saved = stored
        ? await api.saveItem(record, stored.revision, optional(note))
        : await api.createItem(record);
      await onChanged();
      navigate({ page: "item", code: saved.value.code });
      setNote("");
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const history = [...(stored?.value.price_history ?? [])].reverse();
  const money = (amount: number | undefined) =>
    amount === undefined ? "–" : f.money(amount, settings.currency);
  return (
    <section>
      <PageHeader
        eyebrow={stored ? t("Položka ceníku", "Price list item") : t("Ceník", "Price list")}
        title={
          stored ? (
            <>
              <span className="code-title">{stored.value.code}</span> {stored.value.name}
            </>
          ) : (
            t("Nová položka", "New item")
          )
        }
        actions={
          <a className="button" href={href({ page: "items", category: null })}>
            {t("Zpět na ceník", "Back to the price list")}
          </a>
        }
      />
      <div className="detail-grid">
        <form className="form" onSubmit={save}>
          <ErrorNotice error={error} />
          <article className="panel">
            <div className="form-row">
              {stored ? null : (
                <Field
                  label={t("Kód", "Code")}
                  hint={t(
                    "Písmena, číslice, tečka, podtržítko a pomlčka; později se nemění.",
                    "Letters, digits, dot, underscore and hyphen; it never changes later.",
                  )}
                  error={errors.code}
                >
                  <input
                    value={form.code}
                    onChange={(event) => update({ code: event.target.value.trim() })}
                    required
                  />
                </Field>
              )}
              <Field label={t("Název", "Name")} error={errors.name}>
                <input
                  value={form.name}
                  onChange={(event) => update({ name: event.target.value })}
                  required
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label={t("Kategorie", "Category")} error={errors.category}>
                <select
                  value={form.category}
                  onChange={(event) => update({ category: event.target.value })}
                >
                  {data.categories.map(({ value }) => (
                    <option key={value.id} value={value.id}>
                      {value.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Měrná jednotka", "Unit")} error={errors.unit}>
                <input
                  value={form.unit}
                  onChange={(event) => update({ unit: event.target.value })}
                  list="units"
                />
              </Field>
              <Field label={t("Sazba DPH", "VAT rate")} error={errors.vat_rate}>
                <select
                  value={form.vat_rate}
                  onChange={(event) => update({ vat_rate: event.target.value })}
                >
                  {settings.vat_rates.map((rate) => (
                    <option key={rate.id} value={rate.id}>
                      {rate.label} {f.percent(rate.percent)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <datalist id="units">
              {(f.locale === "en"
                ? ["pc", "h", "m", "m²", "pack", "flat", "person", "day"]
                : ["ks", "hod", "m", "m²", "bal.", "paušál", "os.", "den"]
              ).map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
          </article>

          <article className="panel">
            <h2>{t("Cena bez DPH", "Price excl. VAT")}</h2>
            <div className="form-row">
              <Field
                label={t("Nákupní cena", "Purchase price")}
                hint={t("Nepovinná; slouží k výpočtu marže.", "Optional; it gives the margin.")}
                error={purchase === null ? amountHint : errors.purchase_price}
              >
                <input
                  inputMode="decimal"
                  value={purchaseText}
                  onChange={(event) => setPurchaseText(event.target.value)}
                />
              </Field>
              <Field
                label={t("Prodejní cena", "Sale price")}
                error={sale === null ? amountHint : errors.sale_price}
              >
                <input
                  inputMode="decimal"
                  value={saleText}
                  onChange={(event) => setSaleText(event.target.value)}
                  required
                />
              </Field>
              <Field
                label={t("Marže", "Margin")}
                hint={t("Z prodejní ceny.", "Of the sale price.")}
              >
                <output
                  className={
                    margin !== null && margin < (settings.min_margin_percent ?? 0)
                      ? "warning"
                      : undefined
                  }
                >
                  {margin === null ? "–" : f.percent(margin)}
                </output>
              </Field>
            </div>
            <div className="form-row">
              <Field
                label={
                  stored
                    ? t("Nová cena platí od", "The new price applies from")
                    : t("Cena platí od", "The price applies from")
                }
                hint={
                  stored
                    ? t(
                        "Když datum nezměníte, nová cena platí od dneška.",
                        "Unless you change the date, a new price applies from today.",
                      )
                    : undefined
                }
                error={errors.valid_from}
              >
                <input
                  type="date"
                  value={form.valid_from}
                  onChange={(event) => update({ valid_from: event.target.value })}
                />
              </Field>
              <Field
                label={t("Cena platí do", "The price applies until")}
                hint={t(
                  "Nepovinné, např. do konce akce dodavatele.",
                  "Optional, e.g. until a supplier's offer ends.",
                )}
                error={errors.valid_to}
              >
                <input
                  type="date"
                  value={form.valid_to ?? ""}
                  onChange={(event) => update({ valid_to: optional(event.target.value) })}
                />
              </Field>
            </div>
            {priceChanged ? (
              <Field
                label={t("Důvod změny ceny", "Why the price changes")}
                hint={t("Zapíše se do historie cen.", "It goes into the price history.")}
              >
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t(
                    "Např. nový ceník dodavatele",
                    "E.g. the supplier's new price list",
                  )}
                />
              </Field>
            ) : null}
          </article>

          <article className="panel">
            <div className="form-row">
              <Field label={t("Dodavatel", "Supplier")} error={errors.supplier}>
                <input
                  value={form.supplier ?? ""}
                  onChange={(event) => update({ supplier: optional(event.target.value) })}
                />
              </Field>
              <Field
                label={t("Kód dodavatele", "Supplier's code")}
                hint={t(
                  "Podle něj import ceníku dodavatele položku najde.",
                  "The import of the supplier's price list finds the item by it.",
                )}
                error={errors.supplier_code}
              >
                <input
                  value={form.supplier_code ?? ""}
                  onChange={(event) => update({ supplier_code: optional(event.target.value) })}
                />
              </Field>
            </div>
            <Field label={t("Popis", "Description")} error={errors.description}>
              <textarea
                rows={2}
                value={form.description ?? ""}
                onChange={(event) => update({ description: optional(event.target.value) })}
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.archived === true}
                onChange={(event) => update({ archived: event.target.checked || undefined })}
              />
              {t(
                "Vyřazená položka (do nových nabídek se nenabízí)",
                "Retired item (not offered for new quotes)",
              )}
            </label>
          </article>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={busy || invalid}>
              {stored
                ? t("Uložit do konceptu", "Save to the draft")
                : t("Založit položku", "Create the item")}
            </button>
          </div>
        </form>

        {stored ? (
          <aside className="aside">
            <article className="panel">
              <h2>{t("Historie cen", "Price history")}</h2>
              {history.length === 0 ? (
                <p className="muted">
                  {t(
                    "Cena se od založení položky nezměnila.",
                    "The price has not changed since the item was created.",
                  )}
                </p>
              ) : (
                <ol className="history">
                  {history.map((change) => (
                    <li
                      key={`${change.valid_from}:${change.sale_price}:${change.sale_price_before}`}
                    >
                      <div className="history-head">
                        <strong>
                          {t("od", "from")} {f.date(change.valid_from)}
                        </strong>
                        <span className="chip">
                          {change.source === "import"
                            ? t("import", "import")
                            : t("ručně", "by hand")}
                        </span>
                      </div>
                      <div>
                        {t("Prodej", "Sale")} {money(change.sale_price_before)} →{" "}
                        <strong>{money(change.sale_price)}</strong>
                      </div>
                      {change.purchase_price !== undefined ||
                      change.purchase_price_before !== undefined ? (
                        <div className="muted">
                          {t("Nákup", "Purchase")} {money(change.purchase_price_before)} →{" "}
                          {money(change.purchase_price)}
                        </div>
                      ) : null}
                      {change.note ? <div className="muted small">{change.note}</div> : null}
                    </li>
                  ))}
                </ol>
              )}
              <p className="small muted">
                {t("Aktuální cena platí od", "The current price applies from")}{" "}
                {f.date(stored.value.valid_from)}.
              </p>
            </article>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
