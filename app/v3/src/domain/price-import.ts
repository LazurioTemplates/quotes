import { type Category, type Item, ITEM_CODE, withPrice } from "./catalog.ts";
import { slugify } from "./common.ts";
import { parseCsv } from "./csv.ts";
import {
  parseMoney,
  parsePercent,
  percentToBasisPoints,
  roundTo,
  withMarkup,
} from "./money.ts";
import type { Settings } from "./settings.ts";

/**
 * The import of a supplier's price list. `previewImport` is pure: it reads
 * the CSV against the current price list and says, row by row, what would
 * change. Nothing is written until a person (or an agent on their
 * instruction) applies the rows they chose, and even then only as a draft
 * that someone publishes.
 */
export const IMPORT_FIELDS = [
  "code",
  "name",
  "unit",
  "purchase_price",
  "sale_price",
  "vat",
  "category",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportMapping = Partial<Record<ImportField, number>>;

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  code: "Kód dodavatele",
  name: "Název",
  unit: "Jednotka",
  purchase_price: "Nákupní cena",
  sale_price: "Prodejní cena",
  vat: "Sazba DPH",
  category: "Kategorie",
};

const HEADER_NAMES: Record<ImportField, readonly string[]> = {
  code: ["kod", "code", "sku", "katalogove cislo", "objednaci cislo", "cislo", "kod zbozi"],
  name: ["nazev", "name", "popis", "nazev zbozi", "description"],
  unit: ["jednotka", "mj", "merna jednotka", "unit"],
  purchase_price: [
    "nakupni cena",
    "cena",
    "price",
    "cena bez dph",
    "vo cena",
    "velkoobchodni cena",
    "purchase price",
  ],
  sale_price: ["prodejni cena", "moc", "doporucena cena", "mo cena", "sale price", "retail price"],
  vat: ["dph", "vat", "sazba dph", "sazba"],
  category: ["kategorie", "category", "skupina"],
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The columns of a header as the import understands them; unknown columns stay unmapped. */
export function guessMapping(header: readonly string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const names = header.map(normalize);
  for (const field of IMPORT_FIELDS) {
    const index = names.findIndex((name) => HEADER_NAMES[field].includes(name));
    if (index >= 0 && !Object.values(mapping).includes(index)) mapping[field] = index;
  }
  return mapping;
}

export interface ImportOptions {
  /** The supplier's name; rows match the items of this supplier by their supplier code. */
  supplier: string;
  /** The day the new prices apply from. */
  valid_from: string;
  /** The sale price as the purchase price plus this markup; without it the sale price column or the current sale price. */
  markup_percent?: number | undefined;
  /** Round a sale price computed from the markup to whole crowns. */
  round_to_crowns?: boolean | undefined;
  /** The category of new items whose row names none the price list knows. */
  category?: string | undefined;
  /** A note for the price history, e.g. the file name. */
  note?: string | undefined;
}

export type ImportRow =
  | { kind: "new"; line: number; supplierCode: string; item: Item }
  | {
      kind: "changed";
      line: number;
      supplierCode: string;
      before: Item;
      item: Item;
      fields: string[];
    }
  | { kind: "unchanged"; line: number; supplierCode: string; code: string }
  | { kind: "invalid"; line: number; supplierCode: string | null; problems: string[] };

export interface ImportPreview {
  header: string[];
  mapping: ImportMapping;
  rows: ImportRow[];
  /** Items of the supplier the file does not list: the import leaves them as they are. */
  missing: { code: string; name: string; supplierCode: string }[];
  counts: Record<ImportRow["kind"], number>;
}

export interface ImportInput {
  csv: string;
  mapping?: ImportMapping | undefined;
  options: ImportOptions;
  items: readonly Item[];
  categories: readonly Category[];
  settings: Settings;
}

/** A code of ours for a supplier's code: `ab/12 x` → `ab-12-x`, unique among `taken`. */
export function itemCodeFor(supplierCode: string, taken: ReadonlySet<string>): string {
  let base = supplierCode
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(0, 58);
  if (!ITEM_CODE.test(base)) base = "ITEM";
  let code = base;
  for (let suffix = 2; taken.has(code); suffix += 1) code = `${base}-${suffix}`;
  return code;
}

export function previewImport(input: ImportInput): ImportPreview {
  const { options, settings } = input;
  const [header = [], ...records] = parseCsv(input.csv);
  const mapping = input.mapping ?? guessMapping(header);
  const cell = (row: readonly string[], field: ImportField) => {
    const index = mapping[field];
    return index === undefined ? "" : (row[index] ?? "").trim();
  };
  const ofSupplier = input.items.filter((entry) => entry.supplier === options.supplier);
  const bySupplierCode = new Map(ofSupplier.map((entry) => [entry.supplier_code ?? "", entry]));
  const taken = new Set(input.items.map((entry) => entry.code));
  const seen = new Set<string>();
  const defaultCategory = options.category ?? input.categories[0]?.id;
  const markup =
    options.markup_percent === undefined ? null : percentToBasisPoints(options.markup_percent);

  const rows: ImportRow[] = [];
  records.forEach((record, index) => {
    const line = index + 2;
    const supplierCode = cell(record, "code");
    const problems: string[] = [];
    if (mapping.code === undefined) problems.push("chybí sloupec s kódem dodavatele");
    else if (!supplierCode) problems.push("řádek nemá kód");
    else if (seen.has(supplierCode)) problems.push("kód se v souboru opakuje");
    if (supplierCode) seen.add(supplierCode);

    const purchaseText = cell(record, "purchase_price");
    const purchase = purchaseText === "" ? undefined : parseMoney(purchaseText);
    if (purchase === null || (purchase !== undefined && purchase < 0)) {
      problems.push(`nákupní cena „${purchaseText}“ není částka`);
    }
    const saleText = cell(record, "sale_price");
    const saleColumn = saleText === "" ? undefined : parseMoney(saleText);
    if (saleColumn === null || (saleColumn !== undefined && saleColumn < 0)) {
      problems.push(`prodejní cena „${saleText}“ není částka`);
    }
    const vatText = cell(record, "vat");
    let vatRate: string | undefined;
    if (vatText !== "") {
      const percent = parsePercent(vatText);
      vatRate = settings.vat_rates.find(
        (rate) => percent !== null && percentToBasisPoints(rate.percent) === percentToBasisPoints(percent),
      )?.id;
      if (!vatRate) problems.push(`sazbu DPH „${vatText}“ Nastavení nezná`);
    }
    const existing = supplierCode ? bySupplierCode.get(supplierCode) : undefined;
    const name = cell(record, "name");
    if (!existing && !name) problems.push("nová položka potřebuje název");

    let sale: number | undefined;
    if (markup !== null && typeof purchase === "number") {
      sale = withMarkup(purchase, markup);
      if (options.round_to_crowns) sale = roundTo(sale, 100);
    } else if (typeof saleColumn === "number") sale = saleColumn;
    else if (existing) sale = existing.sale_price;
    else problems.push("chybí prodejní cena: zadejte přirážku nebo namapujte sloupec prodejní ceny");

    if (problems.length > 0 || sale === undefined) {
      rows.push({ kind: "invalid", line, supplierCode: supplierCode || null, problems });
      return;
    }
    const nextPurchase = typeof purchase === "number" ? purchase : existing?.purchase_price;

    if (!existing) {
      const categoryText = normalize(cell(record, "category"));
      const category =
        input.categories.find(
          (entry) => categoryText !== "" && (entry.id === slugify(categoryText) || normalize(entry.name) === categoryText),
        )?.id ?? defaultCategory;
      if (!category) {
        rows.push({ kind: "invalid", line, supplierCode, problems: ["ceník nemá žádnou kategorii"] });
        return;
      }
      const code = itemCodeFor(supplierCode, taken);
      taken.add(code);
      rows.push({
        kind: "new",
        line,
        supplierCode,
        item: {
          code,
          name,
          category,
          unit: cell(record, "unit") || "ks",
          ...(nextPurchase === undefined ? {} : { purchase_price: nextPurchase }),
          sale_price: sale,
          vat_rate: vatRate ?? settings.default_vat_rate,
          valid_from: options.valid_from,
          supplier: options.supplier,
          supplier_code: supplierCode,
        },
      });
      return;
    }

    const fields: string[] = [];
    let next: Item = { ...existing };
    if (name && name !== existing.name) {
      next.name = name;
      fields.push("name");
    }
    const unit = cell(record, "unit");
    if (unit && unit !== existing.unit) {
      next.unit = unit;
      fields.push("unit");
    }
    if (vatRate && vatRate !== existing.vat_rate) {
      next.vat_rate = vatRate;
      fields.push("vat_rate");
    }
    const priced = withPrice(
      next,
      { purchase_price: nextPurchase, sale_price: sale, valid_from: options.valid_from },
      "import",
      options.note ?? options.supplier,
    );
    if (priced !== next) {
      if ((existing.purchase_price ?? null) !== (nextPurchase ?? null)) fields.push("purchase_price");
      if (existing.sale_price !== sale) fields.push("sale_price");
      next = priced;
    }
    if (fields.length === 0) {
      rows.push({ kind: "unchanged", line, supplierCode, code: existing.code });
      return;
    }
    rows.push({ kind: "changed", line, supplierCode, before: existing, item: next, fields });
  });

  const listed = new Set(rows.map((row) => row.supplierCode));
  const missing = ofSupplier
    .filter((entry) => !entry.archived && !listed.has(entry.supplier_code ?? ""))
    .map((entry) => ({
      code: entry.code,
      name: entry.name,
      supplierCode: entry.supplier_code ?? "",
    }));
  const counts = { new: 0, changed: 0, unchanged: 0, invalid: 0 };
  for (const row of rows) counts[row.kind] += 1;
  return { header, mapping, rows, missing, counts };
}

/** The rows an import writes: new and changed items, optionally only the chosen lines. */
export function importedItems(
  preview: ImportPreview,
  lines?: readonly number[],
): { item: Item; existing: boolean; line: number }[] {
  const chosen = lines ? new Set(lines) : null;
  return preview.rows.flatMap((row) => {
    if (row.kind !== "new" && row.kind !== "changed") return [];
    if (chosen && !chosen.has(row.line)) return [];
    return [{ item: row.item, existing: row.kind === "changed", line: row.line }];
  });
}
