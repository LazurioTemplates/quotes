import { useMemo, useState } from "react";
import { calculateQuote } from "../../domain/calculate.ts";
import type { Item } from "../../domain/catalog.ts";
import {
  formatAmount,
  formatMoney,
  formatNumber,
  formatPercent,
  parseMoney,
  parsePercent,
  parseQuantity,
} from "../../domain/money.ts";
import { idOfQuote, nextLineId, type Quote, type QuoteLine } from "../../domain/quote.ts";
import { vatRateById } from "../../domain/settings.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, fieldErrors, PageHeader } from "../components/common.tsx";
import { Totals } from "../components/Totals.tsx";
import { href, navigate } from "../routes.ts";

/** The texts of a line's number fields as typed, so `2,` or `1 2` can be on the way to a value. */
interface LineTexts {
  quantity: string;
  unit_price: string;
  discount: string;
}

function textsOf(line: QuoteLine): LineTexts {
  return {
    quantity: formatNumber(line.quantity),
    unit_price: formatAmount(line.unit_price),
    discount: line.discount_percent ? formatNumber(line.discount_percent) : "",
  };
}

/** The values the texts stand for, or the fields that are not numbers. */
function parsedLine(line: QuoteLine, texts: LineTexts) {
  const quantity = parseQuantity(texts.quantity);
  const price = parseMoney(texts.unit_price);
  const discount = texts.discount.trim() === "" ? 0 : parsePercent(texts.discount);
  const problems: Partial<Record<keyof LineTexts, string>> = {};
  if (quantity === null || quantity <= 0) problems.quantity = "kladné číslo, nejvýš 3 desetinná místa";
  if (price === null || price < 0) problems.unit_price = "částka, např. 1 290,50";
  if (discount === null || discount < 0 || discount > 100) problems.discount = "0–100 %";
  const value: QuoteLine = {
    ...line,
    quantity: quantity && quantity > 0 ? quantity : line.quantity,
    unit_price: price !== null && price >= 0 ? price : line.unit_price,
  };
  delete value.discount_percent;
  if (discount) value.discount_percent = discount;
  return { value, problems };
}

export function QuoteEditPage({
  data,
  id,
  onChanged,
}: {
  data: AppData;
  id: string;
  onChanged: () => Promise<void>;
}) {
  const stored = data.quotes.find((entry) => idOfQuote(entry.value) === id);
  const settings = data.settings.value;
  const [form, setForm] = useState<Quote | null>(() => (stored ? structuredClone(stored.value) : null));
  const [texts, setTexts] = useState<Record<string, LineTexts>>(() =>
    Object.fromEntries((stored?.value.lines ?? []).map((line) => [line.id, textsOf(line)])),
  );
  const [discountText, setDiscountText] = useState(
    stored?.value.discount_percent ? formatNumber(stored.value.discount_percent) : "",
  );
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errors = fieldErrors(error);

  const lines = useMemo(
    () =>
      (form?.lines ?? []).map((line) =>
        parsedLine(line, texts[line.id] ?? textsOf(line)),
      ),
    [form, texts],
  );
  const quoteDiscount = discountText.trim() === "" ? 0 : parsePercent(discountText);
  const record: Quote | null = form
    ? (() => {
        const next: Quote = { ...form, lines: lines.map((line) => line.value) };
        delete next.discount_percent;
        if (quoteDiscount) next.discount_percent = quoteDiscount;
        return next;
      })()
    : null;
  const invalid =
    lines.some((line) => Object.keys(line.problems).length > 0) ||
    quoteDiscount === null ||
    quoteDiscount > 100;

  if (!stored || !form || !record) {
    return (
      <section>
        <PageHeader title="Nabídka neexistuje" />
      </section>
    );
  }
  if (stored.value.status !== "draft") {
    return (
      <section>
        <PageHeader title="Tuto verzi už měnit nelze" />
        <p>
          Nabídka už odešla. <a href={href({ page: "quote", id })}>Otevřete ji</a> a vytvořte
          novou verzi.
        </p>
      </section>
    );
  }

  const totals = calculateQuote(record, settings);
  const update = (patch: Partial<Quote>) => setForm({ ...form, ...patch });
  const updateLine = (lineId: string, patch: Partial<QuoteLine>) =>
    setForm({
      ...form,
      lines: form.lines.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch };
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) delete next[key as keyof QuoteLine];
        }
        return next;
      }),
    });
  const updateText = (lineId: string, key: keyof LineTexts, value: string) =>
    setTexts({ ...texts, [lineId]: { ...(texts[lineId] as LineTexts), [key]: value } });
  const addLine = (line: QuoteLine) => {
    setForm({ ...form, lines: [...form.lines, line] });
    setTexts({ ...texts, [line.id]: textsOf(line) });
  };
  const addItem = (item: Item) => {
    const rate = vatRateById(settings, item.vat_rate);
    addLine({
      id: nextLineId(form.lines),
      item_code: item.code,
      name: item.name,
      unit: item.unit,
      quantity: 1,
      unit_price: item.sale_price,
      ...(item.purchase_price === undefined ? {} : { purchase_price: item.purchase_price }),
      vat_percent: rate?.percent ?? 0,
    });
    setSearch("");
  };
  const addFree = () => {
    const rate = vatRateById(settings, settings.default_vat_rate);
    addLine({
      id: nextLineId(form.lines),
      name: "",
      unit: "ks",
      quantity: 1,
      unit_price: 0,
      vat_percent: rate?.percent ?? 0,
    });
  };
  const removeLine = (lineId: string) =>
    setForm({ ...form, lines: form.lines.filter((line) => line.id !== lineId) });
  const moveLine = (index: number, by: number) => {
    const next = [...form.lines];
    const [line] = next.splice(index, 1);
    if (!line) return;
    next.splice(index + by, 0, line);
    setForm({ ...form, lines: next });
  };

  const query = search.trim().toLowerCase();
  const found =
    query.length < 2
      ? []
      : data.items
          .map((entry) => entry.value)
          .filter(
            (item) =>
              !item.archived &&
              (item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query)),
          )
          .slice(0, 8);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!stored || !record) return;
    setBusy(true);
    setError(null);
    try {
      await api.saveQuote(id, record, stored.revision);
      await onChanged();
      navigate({ page: "quote", id });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const rates = settings.vat_rates;
  return (
    <section>
      <PageHeader
        eyebrow={`Koncept · verze ${form.version}`}
        title={
          <>
            <span className="code-title">{form.number}</span> {form.title || "Bez předmětu"}
          </>
        }
        subtitle="Úpravy se uloží jako koncept. Zákazník je uvidí, až nabídku vytisknete a pošlete."
      />
      <form className="editor" onSubmit={save}>
        <ErrorNotice error={error} />
        <div className="editor-grid">
          <div className="editor-main">
            <article className="panel">
              <div className="form-row">
                <Field label="Zákazník" error={errors["customer.id"]}>
                  <select
                    value={form.customer.id}
                    onChange={(event) => {
                      const contact = data.customers.find((entry) => entry.value.id === event.target.value);
                      if (!contact) return;
                      const { note: _note, ...snapshot } = contact.value;
                      update({ customer: snapshot });
                    }}
                  >
                    {data.customers.map((entry) => (
                      <option key={entry.value.id} value={entry.value.id}>
                        {entry.value.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Předmět" error={errors.title}>
                  <input value={form.title} onChange={(event) => update({ title: event.target.value })} />
                </Field>
              </div>
              <div className="form-row">
                <Field label="Vystaveno" error={errors.issue_date}>
                  <input
                    type="date"
                    value={form.issue_date}
                    onChange={(event) => update({ issue_date: event.target.value })}
                  />
                </Field>
                <Field label="Platí do" error={errors.valid_until}>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(event) => update({ valid_until: event.target.value })}
                  />
                </Field>
                <Field label="Vypracoval(a)" error={errors.prepared_by}>
                  <input
                    value={form.prepared_by ?? ""}
                    onChange={(event) => update({ prepared_by: event.target.value || undefined })}
                  />
                </Field>
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <h2>Položky</h2>
                <button className="button" type="button" onClick={addFree}>
                  Přidat řádek mimo ceník
                </button>
              </div>
              <div className="item-search">
                <input
                  type="search"
                  placeholder="Přidat z ceníku: hledejte kód nebo název (aspoň 2 znaky)"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Hledat v ceníku"
                />
                {found.length > 0 ? (
                  <ul className="search-results">
                    {found.map((item) => (
                      <li key={item.code}>
                        <button type="button" className="search-result" onClick={() => addItem(item)}>
                          <span className="code-link">{item.code}</span>
                          <span>{item.name}</span>
                          <span className="num">
                            {formatMoney(item.sale_price, settings.currency)} / {item.unit}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : query.length >= 2 ? (
                  <p className="small muted">
                    V ceníku nic takového není. Přidejte řádek mimo ceník, nebo položku nejdřív{" "}
                    <a href={href({ page: "new-item" })}>založte v ceníku</a>.
                  </p>
                ) : null}
              </div>

              <div className="line-editor">
                {form.lines.length === 0 ? (
                  <p className="muted">Zatím žádná položka. Přidejte ji z ceníku nebo jako řádek mimo ceník.</p>
                ) : null}
                {form.lines.map((line, index) => {
                  const parsed = lines[index];
                  const lineTexts = texts[line.id] ?? textsOf(line);
                  const amounts = totals.lines[index];
                  return (
                    <div key={line.id} className={`line${line.to_check ? " line-warning" : ""}`}>
                      <div className="line-head">
                        <span className="muted small">
                          {index + 1}. {line.item_code ? `z ceníku · ${line.item_code}` : "mimo ceník"}
                        </span>
                        <span className="line-tools">
                          <button type="button" className="link" disabled={index === 0} onClick={() => moveLine(index, -1)} aria-label="Posunout nahoru">
                            ↑
                          </button>
                          <button type="button" className="link" disabled={index === form.lines.length - 1} onClick={() => moveLine(index, 1)} aria-label="Posunout dolů">
                            ↓
                          </button>
                          <button type="button" className="link danger" onClick={() => removeLine(line.id)}>
                            Odebrat
                          </button>
                        </span>
                      </div>
                      {line.to_check ? (
                        <div className="line-check">
                          <span>⚠ {line.to_check}</span>
                          <button type="button" className="link" onClick={() => updateLine(line.id, { to_check: undefined })}>
                            Vyřešeno
                          </button>
                        </div>
                      ) : null}
                      <div className="line-fields">
                        <Field label="Název" wide>
                          <input value={line.name} onChange={(event) => updateLine(line.id, { name: event.target.value })} />
                        </Field>
                        <Field label="Množství" error={parsed?.problems.quantity}>
                          <input inputMode="decimal" value={lineTexts.quantity} onChange={(event) => updateText(line.id, "quantity", event.target.value)} />
                        </Field>
                        <Field label="MJ">
                          <input value={line.unit} onChange={(event) => updateLine(line.id, { unit: event.target.value })} />
                        </Field>
                        <Field label="Cena za MJ bez DPH" error={parsed?.problems.unit_price}>
                          <input inputMode="decimal" value={lineTexts.unit_price} onChange={(event) => updateText(line.id, "unit_price", event.target.value)} />
                        </Field>
                        <Field label="Sleva %" error={parsed?.problems.discount}>
                          <input inputMode="decimal" value={lineTexts.discount} placeholder="0" onChange={(event) => updateText(line.id, "discount", event.target.value)} />
                        </Field>
                        <Field label="DPH">
                          <select value={line.vat_percent} onChange={(event) => updateLine(line.id, { vat_percent: Number(event.target.value) })}>
                            {rates.map((rate) => (
                              <option key={rate.id} value={rate.percent}>
                                {formatPercent(rate.percent)} {rate.label.toLowerCase()}
                              </option>
                            ))}
                            {rates.some((rate) => rate.percent === line.vat_percent) ? null : (
                              <option value={line.vat_percent}>{formatPercent(line.vat_percent)}</option>
                            )}
                          </select>
                        </Field>
                      </div>
                      <div className="line-total">
                        <span className="muted small">
                          Celkem bez DPH <strong>{formatMoney(amounts?.net ?? 0, form.currency)}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="panel">
              <Field label="Úvodní text pro zákazníka" error={errors.introduction}>
                <textarea rows={3} value={form.introduction ?? ""} onChange={(event) => update({ introduction: event.target.value || undefined })} />
              </Field>
              <Field label="Podmínky (dodání, platba)" error={errors.terms}>
                <textarea rows={3} value={form.terms ?? ""} onChange={(event) => update({ terms: event.target.value || undefined })} />
              </Field>
              <Field label="Interní poznámka" hint="Jen pro vás a kolegy; do dokumentu se netiskne." error={errors.internal_note}>
                <textarea rows={2} value={form.internal_note ?? ""} onChange={(event) => update({ internal_note: event.target.value || undefined })} />
              </Field>
            </article>
          </div>

          <aside className="editor-aside">
            <article className="panel sticky">
              <h2>Souhrn</h2>
              <Field label="Sleva na celou nabídku %" error={quoteDiscount === null || quoteDiscount > 100 ? "0–100 %" : undefined}>
                <input inputMode="decimal" value={discountText} placeholder="0" onChange={(event) => setDiscountText(event.target.value)} />
              </Field>
              <Totals totals={totals} currency={form.currency} discountPercent={quoteDiscount ?? 0} />
              <div className="stack">
                <button className="button button-primary" type="submit" disabled={busy || invalid}>
                  Uložit koncept
                </button>
                <a className="button" href={href({ page: "quote", id })}>
                  Zahodit úpravy
                </a>
              </div>
            </article>
          </aside>
        </div>
      </form>
    </section>
  );
}
