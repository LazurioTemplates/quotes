import { useState } from "react";
import { localToday } from "../../domain/common.ts";
import { formatMoney, formatNumber, parsePercent } from "../../domain/money.ts";
import {
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  type ImportMapping,
  type ImportPreview,
  type ImportRow,
} from "../../domain/price-import.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, PageHeader } from "../components/common.tsx";
import { href } from "../routes.ts";

const KIND_LABELS: Record<ImportRow["kind"], string> = {
  new: "Nová",
  changed: "Změna",
  unchanged: "Beze změny",
  invalid: "Chyba",
};

const FIELD_NAMES: Record<string, string> = {
  name: "název",
  unit: "jednotka",
  vat_rate: "DPH",
  purchase_price: "nákupní cena",
  sale_price: "prodejní cena",
};

/**
 * The import of a supplier's price list: a CSV file, a preview of every
 * change, and only the rows a person keeps go into the draft.
 */
export function ImportPage({
  data,
  onChanged,
  today = localToday(),
}: {
  data: AppData;
  onChanged: () => Promise<void>;
  today?: string;
}) {
  const settings = data.settings.value;
  const suppliers = [...new Set(data.items.map((entry) => entry.value.supplier).filter(Boolean))] as string[];
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [encoding, setEncoding] = useState("utf-8");
  const [supplier, setSupplier] = useState(suppliers[0] ?? "");
  const [validFrom, setValidFrom] = useState(today);
  const [markupText, setMarkupText] = useState("");
  const [roundToCrowns, setRoundToCrowns] = useState(true);
  const [category, setCategory] = useState(data.categories[0]?.value.id ?? "");
  const [mapping, setMapping] = useState<ImportMapping | undefined>(undefined);
  const [result, setResult] = useState<{ preview: ImportPreview; revisions: Record<string, string | null> } | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const markup = markupText.trim() === "" ? undefined : parsePercent(markupText);
  const money = (amount: number | undefined) =>
    amount === undefined ? "–" : formatMoney(amount, settings.currency);

  const request = (nextMapping: ImportMapping | undefined) => ({
    csv,
    ...(nextMapping ? { mapping: nextMapping } : {}),
    options: {
      supplier: supplier.trim(),
      valid_from: validFrom,
      ...(markup !== undefined && markup !== null ? { markup_percent: markup, round_to_crowns: roundToCrowns } : {}),
      ...(category ? { category } : {}),
      ...(fileName ? { note: `${supplier.trim()}: ${fileName}` } : {}),
    },
  });

  async function readFile(file: File | undefined, chosenEncoding = encoding) {
    if (!file) return;
    const bytes = await file.arrayBuffer();
    setCsv(new TextDecoder(chosenEncoding).decode(bytes));
    setFileName(file.name);
    setResult(null);
  }

  async function preview(nextMapping: ImportMapping | undefined) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const next = await api.importPreview(request(nextMapping));
      setResult(next);
      setMapping(next.preview.mapping);
      setChosen(
        new Set(
          next.preview.rows
            .filter((row) => row.kind === "new" || row.kind === "changed")
            .map((row) => row.line),
        ),
      );
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const written = await api.importApply({
        ...request(mapping),
        lines: [...chosen],
        revisions: result.revisions,
      });
      setSaved(written.length);
      setResult(null);
      await onChanged();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (line: number) => {
    const next = new Set(chosen);
    if (next.has(line)) next.delete(line);
    else next.add(line);
    setChosen(next);
  };

  const ready = csv.trim() !== "" && supplier.trim() !== "" && markup !== null;
  return (
    <section>
      <PageHeader
        title="Import ceníku dodavatele"
        subtitle="Načtěte ceník dodavatele jako CSV (třeba export z Excelu). Než se cokoli uloží, uvidíte každou změnu a vyberete, které řádky převzít. Uložené změny jsou koncept, který pak publikujete."
      />
      <ErrorNotice error={error} />
      {saved !== null ? (
        <p className="notice notice-success">
          Do konceptu se uložilo {saved} položek. Zkontrolujte je a publikujte v části{" "}
          <a href={href({ page: "draft" })}>Koncept a publikování</a>.
        </p>
      ) : null}
      <article className="panel">
        <h2>1. Soubor a pravidla</h2>
        <div className="form-row">
          <Field label="Soubor CSV" hint={fileName ? `Načteno: ${fileName}` : "Oddělovač ; , nebo tabulátor se pozná sám."}>
            <input type="file" accept=".csv,.txt,text/csv" onChange={(event) => readFile(event.target.files?.[0])} />
          </Field>
          <Field label="Kódování" hint="Starší exporty z Excelu bývají ve Windows-1250.">
            <select value={encoding} onChange={(event) => setEncoding(event.target.value)}>
              <option value="utf-8">UTF-8</option>
              <option value="windows-1250">Windows-1250</option>
            </select>
          </Field>
        </div>
        <Field label="Nebo vložte obsah CSV">
          <textarea rows={5} className="mono" value={csv} onChange={(event) => { setCsv(event.target.value); setResult(null); }} />
        </Field>
        <div className="form-row">
          <Field label="Dodavatel" hint="Řádky se párují s položkami tohoto dodavatele podle kódu dodavatele.">
            <input value={supplier} onChange={(event) => setSupplier(event.target.value)} list="suppliers" />
          </Field>
          <Field label="Nové ceny platí od">
            <input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
          </Field>
        </div>
        <datalist id="suppliers">
          {suppliers.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="form-row">
          <Field
            label="Přirážka k nákupní ceně %"
            hint="Prázdné: prodejní cena ze sloupce souboru, jinak zůstane dosavadní."
            error={markup === null ? "procento, např. 45" : undefined}
          >
            <input inputMode="decimal" value={markupText} onChange={(event) => setMarkupText(event.target.value)} />
          </Field>
          <Field label="Kategorie nových položek">
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {data.categories.map(({ value }) => (
                <option key={value.id} value={value.id}>
                  {value.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={roundToCrowns} onChange={(event) => setRoundToCrowns(event.target.checked)} />
          Prodejní cenu z přirážky zaokrouhlit na celé koruny
        </label>
        <div className="form-actions">
          <button className="button button-primary" type="button" disabled={busy || !ready} onClick={() => preview(undefined)}>
            Zobrazit náhled změn
          </button>
        </div>
      </article>

      {result ? (
        <article className="panel">
          <h2>2. Náhled změn</h2>
          <p className="small muted">Sloupce souboru, jak je import pochopil. Když nesedí, opravte je a náhled se přepočítá.</p>
          <div className="mapping">
            {IMPORT_FIELDS.map((field) => (
              <Field key={field} label={IMPORT_FIELD_LABELS[field]}>
                <select
                  value={mapping?.[field] ?? ""}
                  onChange={(event) => {
                    const next: ImportMapping = { ...mapping };
                    if (event.target.value === "") delete next[field];
                    else next[field] = Number(event.target.value);
                    void preview(next);
                  }}
                >
                  <option value="">—</option>
                  {result.preview.header.map((column, index) => (
                    <option key={`${column}:${index}`} value={index}>
                      {column || `sloupec ${index + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <div className="stats">
            {(["new", "changed", "unchanged", "invalid"] as const).map((kind) => (
              <div key={kind} className={`stat stat-${kind}`}>
                <span className="stat-value">{result.preview.counts[kind]}</span>
                <span className="stat-label">{KIND_LABELS[kind]}</span>
              </div>
            ))}
          </div>
          <table className="table import-table">
            <thead>
              <tr>
                <th>Převzít</th>
                <th>Řádek</th>
                <th>Stav</th>
                <th>Kód</th>
                <th>Název</th>
                <th className="num">Nákup</th>
                <th className="num">Prodej</th>
                <th>Co se mění</th>
              </tr>
            </thead>
            <tbody>
              {result.preview.rows.map((row) => (
                <ImportRowView key={row.line} row={row} chosen={chosen.has(row.line)} onToggle={() => toggle(row.line)} money={money} />
              ))}
            </tbody>
          </table>
          {result.preview.missing.length > 0 ? (
            <div className="notice notice-info">
              <strong>V souboru chybí {result.preview.missing.length} položek tohoto dodavatele.</strong>{" "}
              Import je nemění; jestli je dodavatel už nevede, vyřaďte je v ceníku:{" "}
              {result.preview.missing.map((entry, index) => (
                <span key={entry.code}>
                  {index > 0 ? ", " : ""}
                  <a href={href({ page: "item", code: entry.code })}>{entry.code}</a>
                </span>
              ))}
            </div>
          ) : null}
          <div className="form-actions">
            <button className="button button-primary" type="button" disabled={busy || chosen.size === 0} onClick={apply}>
              Uložit {formatNumber(chosen.size)} vybraných do konceptu
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}

function ImportRowView({
  row,
  chosen,
  onToggle,
  money,
}: {
  row: ImportRow;
  chosen: boolean;
  onToggle: () => void;
  money: (amount: number | undefined) => string;
}) {
  const selectable = row.kind === "new" || row.kind === "changed";
  const item = row.kind === "new" || row.kind === "changed" ? row.item : null;
  const before = row.kind === "changed" ? row.before : null;
  const change = (old: number | undefined, next: number | undefined) =>
    before && old !== next ? (
      <>
        <span className="before">{money(old)}</span> → {money(next)}
      </>
    ) : (
      money(next)
    );
  return (
    <tr className={row.kind === "invalid" ? "row-warning" : row.kind === "unchanged" ? "row-muted" : undefined}>
      <td>
        {selectable ? <input type="checkbox" checked={chosen} onChange={onToggle} aria-label={`Převzít řádek ${row.line}`} /> : null}
      </td>
      <td className="muted">{row.line}</td>
      <td>
        <span className={`chip chip-import-${row.kind}`}>{KIND_LABELS[row.kind]}</span>
      </td>
      <td className="code-link">{item?.code ?? (row.kind === "unchanged" ? row.code : (row.supplierCode ?? ""))}</td>
      <td>{item?.name ?? ""}</td>
      <td className="num">{item ? change(before?.purchase_price, item.purchase_price) : ""}</td>
      <td className="num">{item ? change(before?.sale_price, item.sale_price) : ""}</td>
      <td className="small">
        {row.kind === "changed" ? row.fields.map((field) => FIELD_NAMES[field] ?? field).join(", ") : null}
        {row.kind === "new" ? `kód ${row.supplierCode} u dodavatele` : null}
        {row.kind === "invalid" ? <span className="danger">{row.problems.join("; ")}</span> : null}
      </td>
    </tr>
  );
}
