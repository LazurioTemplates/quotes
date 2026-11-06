import { useState } from "react";
import { localToday } from "../../domain/common.ts";

import {
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  type ImportMapping,
  type ImportPreview,
  type ImportRow,
} from "../../domain/price-import.ts";
import type { Localized } from "../../i18n/locale.ts";
import type { AppData } from "../App.tsx";
import { api } from "../api.ts";
import { ErrorNotice, Field, PageHeader } from "../components/common.tsx";
import { useFormat, useT } from "../i18n.tsx";
import { href } from "../routes.ts";

const KIND_LABELS: Record<ImportRow["kind"], Localized> = {
  new: { cs: "Nová", en: "New" },
  changed: { cs: "Změna", en: "Change" },
  unchanged: { cs: "Beze změny", en: "Unchanged" },
  invalid: { cs: "Chyba", en: "Error" },
};

const FIELD_NAMES: Record<string, Localized> = {
  name: { cs: "název", en: "name" },
  unit: { cs: "jednotka", en: "unit" },
  vat_rate: { cs: "DPH", en: "VAT" },
  purchase_price: { cs: "nákupní cena", en: "purchase price" },
  sale_price: { cs: "prodejní cena", en: "sale price" },
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
  const t = useT();
  const f = useFormat();
  const settings = data.settings.value;
  const suppliers = [
    ...new Set(data.items.map((entry) => entry.value.supplier).filter(Boolean)),
  ] as string[];
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [encoding, setEncoding] = useState("utf-8");
  const [supplier, setSupplier] = useState(suppliers[0] ?? "");
  const [validFrom, setValidFrom] = useState(today);
  const [markupText, setMarkupText] = useState("");
  const [roundToCrowns, setRoundToCrowns] = useState(true);
  const [category, setCategory] = useState(data.categories[0]?.value.id ?? "");
  const [mapping, setMapping] = useState<ImportMapping | undefined>(undefined);
  const [result, setResult] = useState<{
    preview: ImportPreview;
    revisions: Record<string, string | null>;
  } | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const markup = markupText.trim() === "" ? undefined : f.parsePercent(markupText);
  const money = (amount: number | undefined) =>
    amount === undefined ? "–" : f.money(amount, settings.currency);

  const request = (nextMapping: ImportMapping | undefined) => ({
    csv,
    ...(nextMapping ? { mapping: nextMapping } : {}),
    options: {
      supplier: supplier.trim(),
      valid_from: validFrom,
      ...(markup !== undefined && markup !== null
        ? { markup_percent: markup, round_to_crowns: roundToCrowns }
        : {}),
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
        title={t("Import ceníku dodavatele", "Import a supplier's price list")}
        subtitle={t(
          "Načtěte ceník dodavatele jako CSV (třeba export z Excelu). Než se cokoli uloží, uvidíte každou změnu a vyberete, které řádky převzít. Uložené změny jsou koncept, který pak publikujete.",
          "Load a supplier's price list as CSV (an Excel export, say). Before anything is saved you see every change and choose the rows to take. Saved changes are a draft you then publish.",
        )}
      />
      <ErrorNotice error={error} />
      {saved !== null ? (
        <p className="notice notice-success">
          {t(
            `Do konceptu se uložilo ${saved} položek. Zkontrolujte je a publikujte v části`,
            `${saved} items were saved to the draft. Review and publish them in`,
          )}{" "}
          <a href={href({ page: "draft" })}>{t("Koncept a publikování", "Draft & publish")}</a>.
        </p>
      ) : null}
      <article className="panel">
        <h2>{t("1. Soubor a pravidla", "1. The file and the rules")}</h2>
        <div className="form-row">
          <Field
            label={t("Soubor CSV", "CSV file")}
            hint={
              fileName
                ? t(`Načteno: ${fileName}`, `Loaded: ${fileName}`)
                : t(
                    "Oddělovač ; , nebo tabulátor se pozná sám.",
                    "The separator ; , or tab is found by itself.",
                  )
            }
          >
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              onChange={(event) => readFile(event.target.files?.[0])}
            />
          </Field>
          <Field
            label={t("Kódování", "Encoding")}
            hint={t(
              "Starší exporty z Excelu bývají ve Windows-1250.",
              "Older Excel exports are often Windows-1250.",
            )}
          >
            <select value={encoding} onChange={(event) => setEncoding(event.target.value)}>
              <option value="utf-8">UTF-8</option>
              <option value="windows-1250">Windows-1250</option>
            </select>
          </Field>
        </div>
        <Field label={t("Nebo vložte obsah CSV", "Or paste the CSV")}>
          <textarea
            rows={5}
            className="mono"
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value);
              setResult(null);
            }}
          />
        </Field>
        <div className="form-row">
          <Field
            label={t("Dodavatel", "Supplier")}
            hint={t(
              "Řádky se párují s položkami tohoto dodavatele podle kódu dodavatele.",
              "Rows match this supplier's items by the supplier's code.",
            )}
          >
            <input
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
              list="suppliers"
            />
          </Field>
          <Field label={t("Nové ceny platí od", "The new prices apply from")}>
            <input
              type="date"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
            />
          </Field>
        </div>
        <datalist id="suppliers">
          {suppliers.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="form-row">
          <Field
            label={t("Přirážka k nákupní ceně %", "Markup on the purchase price %")}
            hint={t(
              "Prázdné: prodejní cena ze sloupce souboru, jinak zůstane dosavadní.",
              "Empty: the sale price from the file's column, else the current one stays.",
            )}
            error={markup === null ? t("procento, např. 45", "a percentage, e.g. 45") : undefined}
          >
            <input
              inputMode="decimal"
              value={markupText}
              onChange={(event) => setMarkupText(event.target.value)}
            />
          </Field>
          <Field label={t("Kategorie nových položek", "Category of new items")}>
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
          <input
            type="checkbox"
            checked={roundToCrowns}
            onChange={(event) => setRoundToCrowns(event.target.checked)}
          />
          {t(
            "Prodejní cenu z přirážky zaokrouhlit na celé koruny",
            "Round a sale price from the markup to whole crowns",
          )}
        </label>
        <div className="form-actions">
          <button
            className="button button-primary"
            type="button"
            disabled={busy || !ready}
            onClick={() => preview(undefined)}
          >
            {t("Zobrazit náhled změn", "Preview the changes")}
          </button>
        </div>
      </article>

      {result ? (
        <article className="panel">
          <h2>{t("2. Náhled změn", "2. Preview of the changes")}</h2>
          <p className="small muted">
            {t(
              "Sloupce souboru, jak je import pochopil. Když nesedí, opravte je a náhled se přepočítá.",
              "The file's columns as the import understood them. If one is wrong, fix it and the preview runs again.",
            )}
          </p>
          <div className="mapping">
            {IMPORT_FIELDS.map((field) => (
              <Field key={field} label={t.of(IMPORT_FIELD_LABELS[field])}>
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
                    // biome-ignore lint/suspicious/noArrayIndexKey: a header's columns are positional; two may share a name
                    <option key={index} value={index}>
                      {column || t(`sloupec ${index + 1}`, `column ${index + 1}`)}
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
                <span className="stat-label">{t.of(KIND_LABELS[kind])}</span>
              </div>
            ))}
          </div>
          <table className="table import-table">
            <thead>
              <tr>
                <th>{t("Převzít", "Take")}</th>
                <th>{t("Řádek", "Row")}</th>
                <th>{t("Stav", "State")}</th>
                <th>{t("Kód", "Code")}</th>
                <th>{t("Název", "Name")}</th>
                <th className="num">{t("Nákup", "Purchase")}</th>
                <th className="num">{t("Prodej", "Sale")}</th>
                <th>{t("Co se mění", "What changes")}</th>
              </tr>
            </thead>
            <tbody>
              {result.preview.rows.map((row) => (
                <ImportRowView
                  key={row.line}
                  row={row}
                  chosen={chosen.has(row.line)}
                  onToggle={() => toggle(row.line)}
                  money={money}
                />
              ))}
            </tbody>
          </table>
          {result.preview.missing.length > 0 ? (
            <div className="notice notice-info">
              <strong>
                {t(
                  `V souboru chybí ${result.preview.missing.length} položek tohoto dodavatele.`,
                  `The file lacks ${result.preview.missing.length} items of this supplier.`,
                )}
              </strong>{" "}
              {t(
                "Import je nemění; jestli je dodavatel už nevede, vyřaďte je v ceníku:",
                "The import leaves them as they are; if the supplier no longer sells them, retire them in the price list:",
              )}{" "}
              {result.preview.missing.map((entry, index) => (
                <span key={entry.code}>
                  {index > 0 ? ", " : ""}
                  <a href={href({ page: "item", code: entry.code })}>{entry.code}</a>
                </span>
              ))}
            </div>
          ) : null}
          <div className="form-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={busy || chosen.size === 0}
              onClick={apply}
            >
              {t(
                `Uložit ${f.number(chosen.size)} vybraných do konceptu`,
                `Save the ${f.number(chosen.size)} chosen to the draft`,
              )}
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
  const t = useT();
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
    <tr
      className={
        row.kind === "invalid" ? "row-warning" : row.kind === "unchanged" ? "row-muted" : undefined
      }
    >
      <td>
        {selectable ? (
          <input
            type="checkbox"
            checked={chosen}
            onChange={onToggle}
            aria-label={t(`Převzít řádek ${row.line}`, `Take row ${row.line}`)}
          />
        ) : null}
      </td>
      <td className="muted">{row.line}</td>
      <td>
        <span className={`chip chip-import-${row.kind}`}>{t.of(KIND_LABELS[row.kind])}</span>
      </td>
      <td className="code-link">
        {item?.code ?? (row.kind === "unchanged" ? row.code : (row.supplierCode ?? ""))}
      </td>
      <td>{item?.name ?? ""}</td>
      <td className="num">{item ? change(before?.purchase_price, item.purchase_price) : ""}</td>
      <td className="num">{item ? change(before?.sale_price, item.sale_price) : ""}</td>
      <td className="small">
        {row.kind === "changed"
          ? row.fields
              .map((field) => (FIELD_NAMES[field] ? t.of(FIELD_NAMES[field]) : field))
              .join(", ")
          : null}
        {row.kind === "new"
          ? t(`kód ${row.supplierCode} u dodavatele`, `the supplier's code ${row.supplierCode}`)
          : null}
        {row.kind === "invalid" ? <span className="danger">{row.problems.join("; ")}</span> : null}
      </td>
    </tr>
  );
}
