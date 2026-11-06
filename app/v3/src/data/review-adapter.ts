import {
  parseYaml,
  REVIEW_SURFACE_CONTRACT_VERSION,
  type ResourceChangeKind,
  type ReviewableResource,
  type ReviewFieldSummary,
  type ReviewInputChange,
  type ReviewSurfaceAdapter,
  structuralDiff,
} from "@lazurio/repository-db";
import { COLLECTION_NAMES, type CollectionName } from "../domain/collections.ts";
import { formatMoney } from "../domain/money.ts";
import { type Locale, type Localized, pick } from "../i18n/locale.ts";

/** Czech labels of the fields a reviewer sees; a field without one shows its key. */
const FIELD_LABELS: Record<string, Localized> = {
  name: { cs: "Název", en: "Name" },
  title: { cs: "Předmět", en: "Subject" },
  status: { cs: "Stav", en: "State" },
  code: { cs: "Kód", en: "Code" },
  category: { cs: "Kategorie", en: "Category" },
  unit: { cs: "Jednotka", en: "Unit" },
  purchase_price: { cs: "Nákupní cena", en: "Purchase price" },
  sale_price: { cs: "Prodejní cena", en: "Sale price" },
  vat_rate: { cs: "Sazba DPH", en: "VAT rate" },
  vat_rates: { cs: "Sazby DPH", en: "VAT rates" },
  valid_from: { cs: "Platí od", en: "Valid from" },
  valid_to: { cs: "Platí do", en: "Valid until" },
  price_history: { cs: "Historie cen", en: "Price history" },
  supplier: { cs: "Dodavatel", en: "Supplier" },
  supplier_code: { cs: "Kód dodavatele", en: "Supplier's code" },
  archived: { cs: "Vyřazená", en: "Retired" },
  description: { cs: "Popis", en: "Description" },
  customer: { cs: "Zákazník", en: "Customer" },
  lines: { cs: "Řádky", en: "Lines" },
  discount_percent: { cs: "Sleva", en: "Discount" },
  issue_date: { cs: "Vystaveno", en: "Issued" },
  valid_until: { cs: "Platí do", en: "Valid until" },
  introduction: { cs: "Úvodní text", en: "Introduction" },
  terms: { cs: "Podmínky", en: "Terms" },
  internal_note: { cs: "Interní poznámka", en: "Internal note" },
  sent_at: { cs: "Odesláno", en: "Sent" },
  closed_at: { cs: "Uzavřeno", en: "Closed" },
  email: { cs: "E-mail", en: "E-mail" },
  phone: { cs: "Telefon", en: "Phone" },
  contact_person: { cs: "Kontaktní osoba", en: "Contact person" },
  company_id: { cs: "IČO", en: "Company ID" },
  vat_id: { cs: "DIČ", en: "VAT ID" },
  street: { cs: "Ulice", en: "Street" },
  city: { cs: "Obec", en: "City" },
  postal_code: { cs: "PSČ", en: "Postal code" },
  quote_number_format: { cs: "Formát čísla nabídky", en: "Quote number format" },
  validity_days: { cs: "Platnost (dní)", en: "Validity (days)" },
  total_rounding: { cs: "Zaokrouhlení", en: "Rounding" },
  min_margin_percent: { cs: "Minimální marže", en: "Minimum margin" },
  default_vat_rate: { cs: "Výchozí sazba DPH", en: "Default VAT rate" },
  order: { cs: "Pořadí", en: "Order" },
};

const MONEY_FIELDS = new Set([
  "purchase_price",
  "sale_price",
  "unit_price",
  "purchase_price_before",
  "sale_price_before",
]);

const TYPE_LABELS: Record<CollectionName, Localized> = {
  settings: { cs: "Nastavení", en: "Settings" },
  categories: { cs: "Kategorie", en: "Category" },
  items: { cs: "Položka ceníku", en: "Price list item" },
  customers: { cs: "Zákazník", en: "Customer" },
  quotes: { cs: "Nabídka", en: "Quote" },
};

/** Names changed fields as a reviewer knows them and shows amounts in crowns. */
export function labelFields(
  fields: readonly ReviewFieldSummary[],
  locale: Locale = "cs",
): ReviewFieldSummary[] {
  return fields.map((field) => {
    const segments = field.fieldPath.split("/").filter(Boolean);
    const key = segments[0] ?? "";
    const last = segments.at(-1) ?? "";
    const amount = (summary: string | undefined) =>
      summary !== undefined && MONEY_FIELDS.has(last) && /^[0-9]+$/.test(summary)
        ? formatMoney(Number(summary), "CZK", locale)
        : summary;
    return {
      ...field,
      label: FIELD_LABELS[key]?.[locale] ?? field.label,
      beforeSummary: amount(field.beforeSummary),
      afterSummary: amount(field.afterSummary),
    };
  });
}

/** How a person recognises a record: its type, a label and the page that shows it. */
export function describeRecord(
  collection: CollectionName,
  id: string,
  record: unknown,
  locale: Locale = "cs",
) {
  const value = (record ?? {}) as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name : null;
  const typeLabel = TYPE_LABELS[collection][locale];
  switch (collection) {
    case "settings":
      return {
        typeLabel,
        label: pick(locale, "Nastavení nabídek", "Quote settings"),
        href: "#/settings",
      };
    case "categories":
      return { typeLabel, label: name ?? id, href: `#/items?category=${encodeURIComponent(id)}` };
    case "items":
      return {
        typeLabel,
        label: name ? `${id} · ${name}` : id,
        href: `#/items/${encodeURIComponent(id)}`,
      };
    case "customers":
      return {
        typeLabel,
        label: name ? `${name} (${id})` : id,
        href: `#/customers/${encodeURIComponent(id)}`,
      };
    case "quotes": {
      const number = typeof value.number === "string" ? value.number : id;
      const version = typeof value.version === "number" ? value.version : null;
      const title = typeof value.title === "string" ? value.title : null;
      const head = version ? `${number} (${pick(locale, "verze", "version")} ${version})` : number;
      return {
        typeLabel,
        label: title ? `${head} · ${title}` : head,
        href: `#/quotes/${encodeURIComponent(id)}`,
      };
    }
  }
}

/** `data/items/NAB-ZIDLE.yaml` → the collection and the id, or null for another file. */
export function recordAt(path: string): { collection: CollectionName; id: string } | null {
  const match = /(?:^|\/)data\/([a-z]+)\/([^/]+)\.yaml$/.exec(path);
  if (!match?.[1] || !match[2]) return null;
  const collection = match[1] as CollectionName;
  if (!COLLECTION_NAMES.includes(collection)) return null;
  try {
    return { collection, id: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

function recordOf(text: string | undefined): Record<string, unknown> | undefined {
  if (text === undefined) return undefined;
  try {
    const document = parseYaml(text) as { record?: unknown } | null;
    const record = document?.record;
    return record && typeof record === "object" && !Array.isArray(record)
      ? (record as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** One change of one record as the Draft & Publish card shows it. */
export function reviewResource(
  collection: CollectionName,
  id: string,
  kind: ResourceChangeKind,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  change: Pick<ReviewInputChange, "changeId" | "technicalRefs">,
  locale: Locale = "cs",
): ReviewableResource {
  const subject = describeRecord(collection, id, after ?? before, locale);
  const diff = structuralDiff(before ?? {}, after ?? {}, { maxFields: 12 });
  const fields = labelFields(diff.fields, locale);
  return {
    appId: "quotes",
    resourceType: collection,
    stableResourceId: `${collection}:${id}`,
    label: subject.label,
    routeTarget: { href: subject.href, label: pick(locale, "Otevřít", "Open") },
    changes: [
      {
        changeId: change.changeId,
        kind,
        summary:
          kind === "created"
            ? pick(locale, "Nový záznam", "New record")
            : kind === "deleted"
              ? pick(locale, "Smazaný záznam", "Deleted record")
              : pick(
                  locale,
                  `Změněno polí: ${fields.length + diff.truncated}`,
                  `Fields changed: ${fields.length + diff.truncated}`,
                ),
        technicalRefs: change.technicalRefs,
        fields,
      },
    ],
    fallback: { activeLevel: "resource_adapter", steps: [] },
    metadata: { typeLabel: subject.typeLabel },
  };
}

/**
 * Turns changed data files into the records a person recognises: an item by
 * its code and name, a quote by its number and version, with the changed
 * fields named in Czech. A file this adapter does not know falls through to
 * the engine's generic review.
 */
export const quotesReviewAdapter = (locale: Locale = "cs"): ReviewSurfaceAdapter => ({
  id: "quotes-v3",
  appId: "quotes",
  contractVersion: REVIEW_SURFACE_CONTRACT_VERSION,
  adapterVersion: "1.0.0",
  supportedPathGlobs: COLLECTION_NAMES.map((name) => `data/${name}/*.yaml`),
  toReviewableResources(changes: readonly ReviewInputChange[]): ReviewableResource[] {
    const resources: ReviewableResource[] = [];
    for (const change of changes) {
      const path = change.technicalRefs[0]?.path ?? "";
      const at = recordAt(path);
      if (!at) continue;
      const kind = change.kind === "renamed" ? "modified" : change.kind;
      resources.push(
        reviewResource(
          at.collection,
          at.id,
          kind,
          recordOf(change.baselineText),
          recordOf(change.draftText),
          change,
          locale,
        ),
      );
    }
    return resources;
  },
});
