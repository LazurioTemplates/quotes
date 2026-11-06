import { useState } from "react";
import { type Item, marginPercent } from "../../domain/catalog.ts";
import { formatDate, localToday } from "../../domain/common.ts";
import { formatAmount, formatMoney, formatPercent, parseMoney } from "../../domain/money.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, fieldErrors, PageHeader } from "../components/common.tsx";
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
    stored?.value.purchase_price === undefined ? "" : formatAmount(stored.value.purchase_price),
  );
  const [saleText, setSaleText] = useState(stored ? formatAmount(stored.value.sale_price) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errors = fieldErrors(error);

  if (code && !stored) {
    return (
      <section>
        <PageHeader title="Položka neexistuje" />
        <p>
          <a href={href({ page: "items", category: null })}>Zpět na ceník</a>
        </p>
      </section>
    );
  }

  const purchase = purchaseText.trim() === "" ? undefined : parseMoney(purchaseText);
  const sale = parseMoney(saleText);
  const priceChanged =
    stored !== undefined &&
    (sale !== stored.value.sale_price || (purchase ?? null) !== (stored.value.purchase_price ?? null));
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
    amount === undefined ? "–" : formatMoney(amount, settings.currency);
  return (
    <section>
      <PageHeader
        eyebrow={stored ? "Položka ceníku" : "Ceník"}
        title={stored ? <><span className="code-title">{stored.value.code}</span> {stored.value.name}</> : "Nová položka"}
        actions={
          <a className="button" href={href({ page: "items", category: null })}>
            Zpět na ceník
          </a>
        }
      />
      <div className="detail-grid">
        <form className="form" onSubmit={save}>
          <ErrorNotice error={error} />
          <article className="panel">
            <div className="form-row">
              {stored ? null : (
                <Field label="Kód" hint="Písmena, číslice, tečka, podtržítko a pomlčka; později se nemění." error={errors.code}>
                  <input value={form.code} onChange={(event) => update({ code: event.target.value.trim() })} required />
                </Field>
              )}
              <Field label="Název" error={errors.name}>
                <input value={form.name} onChange={(event) => update({ name: event.target.value })} required />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Kategorie" error={errors.category}>
                <select value={form.category} onChange={(event) => update({ category: event.target.value })}>
                  {data.categories.map(({ value }) => (
                    <option key={value.id} value={value.id}>
                      {value.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Měrná jednotka" error={errors.unit}>
                <input value={form.unit} onChange={(event) => update({ unit: event.target.value })} list="units" />
              </Field>
              <Field label="Sazba DPH" error={errors.vat_rate}>
                <select value={form.vat_rate} onChange={(event) => update({ vat_rate: event.target.value })}>
                  {settings.vat_rates.map((rate) => (
                    <option key={rate.id} value={rate.id}>
                      {rate.label} {formatPercent(rate.percent)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <datalist id="units">
              {["ks", "hod", "m", "m²", "bal.", "paušál", "os.", "den"].map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
          </article>

          <article className="panel">
            <h2>Cena bez DPH</h2>
            <div className="form-row">
              <Field label="Nákupní cena" hint="Nepovinná; slouží k výpočtu marže." error={purchase === null ? "částka, např. 1 290,50" : errors.purchase_price}>
                <input inputMode="decimal" value={purchaseText} onChange={(event) => setPurchaseText(event.target.value)} />
              </Field>
              <Field label="Prodejní cena" error={sale === null ? "částka, např. 1 290,50" : errors.sale_price}>
                <input inputMode="decimal" value={saleText} onChange={(event) => setSaleText(event.target.value)} required />
              </Field>
              <Field label="Marže" hint="Z prodejní ceny.">
                <output className={margin !== null && margin < (settings.min_margin_percent ?? 0) ? "warning" : undefined}>
                  {margin === null ? "–" : formatPercent(margin)}
                </output>
              </Field>
            </div>
            <div className="form-row">
              <Field
                label={stored ? "Nová cena platí od" : "Cena platí od"}
                hint={stored ? "Když datum nezměníte, nová cena platí od dneška." : undefined}
                error={errors.valid_from}
              >
                <input type="date" value={form.valid_from} onChange={(event) => update({ valid_from: event.target.value })} />
              </Field>
              <Field label="Cena platí do" hint="Nepovinné, např. do konce akce dodavatele." error={errors.valid_to}>
                <input type="date" value={form.valid_to ?? ""} onChange={(event) => update({ valid_to: optional(event.target.value) })} />
              </Field>
            </div>
            {priceChanged ? (
              <Field label="Důvod změny ceny" hint="Zapíše se do historie cen.">
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Např. nový ceník dodavatele" />
              </Field>
            ) : null}
          </article>

          <article className="panel">
            <div className="form-row">
              <Field label="Dodavatel" error={errors.supplier}>
                <input value={form.supplier ?? ""} onChange={(event) => update({ supplier: optional(event.target.value) })} />
              </Field>
              <Field label="Kód dodavatele" hint="Podle něj import ceníku dodavatele položku najde." error={errors.supplier_code}>
                <input value={form.supplier_code ?? ""} onChange={(event) => update({ supplier_code: optional(event.target.value) })} />
              </Field>
            </div>
            <Field label="Popis" error={errors.description}>
              <textarea rows={2} value={form.description ?? ""} onChange={(event) => update({ description: optional(event.target.value) })} />
            </Field>
            <label className="checkbox">
              <input type="checkbox" checked={form.archived === true} onChange={(event) => update({ archived: event.target.checked || undefined })} />
              Vyřazená položka (do nových nabídek se nenabízí)
            </label>
          </article>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={busy || invalid}>
              {stored ? "Uložit do konceptu" : "Založit položku"}
            </button>
          </div>
        </form>

        {stored ? (
          <aside className="aside">
            <article className="panel">
              <h2>Historie cen</h2>
              {history.length === 0 ? (
                <p className="muted">Cena se od založení položky nezměnila.</p>
              ) : (
                <ol className="history">
                  {history.map((change) => (
                    <li key={`${change.valid_from}:${change.sale_price}:${change.sale_price_before}`}>
                      <div className="history-head">
                        <strong>od {formatDate(change.valid_from)}</strong>
                        <span className="chip">{change.source === "import" ? "import" : "ručně"}</span>
                      </div>
                      <div>
                        Prodej {money(change.sale_price_before)} → <strong>{money(change.sale_price)}</strong>
                      </div>
                      {change.purchase_price !== undefined || change.purchase_price_before !== undefined ? (
                        <div className="muted">
                          Nákup {money(change.purchase_price_before)} → {money(change.purchase_price)}
                        </div>
                      ) : null}
                      {change.note ? <div className="muted small">{change.note}</div> : null}
                    </li>
                  ))}
                </ol>
              )}
              <p className="small muted">Aktuální cena platí od {formatDate(stored.value.valid_from)}.</p>
            </article>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
