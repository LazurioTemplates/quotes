import {
  parseYaml,
  REVIEW_SURFACE_CONTRACT_VERSION,
  type ReviewableResource,
  type ReviewFieldSummary,
  type ReviewInputChange,
  type ResourceChangeKind,
  type ReviewSurfaceAdapter,
  structuralDiff,
} from "@lazurio/repository-db";
import { COLLECTION_NAMES, type CollectionName } from "../domain/collections.ts";
import { formatMoney } from "../domain/money.ts";

/** Czech labels of the fields a reviewer sees; a field without one shows its key. */
const FIELD_LABELS: Record<string, string> = {
  name: "Název",
  title: "Předmět",
  status: "Stav",
  code: "Kód",
  category: "Kategorie",
  unit: "Jednotka",
  purchase_price: "Nákupní cena",
  sale_price: "Prodejní cena",
  vat_rate: "Sazba DPH",
  vat_rates: "Sazby DPH",
  valid_from: "Platí od",
  valid_to: "Platí do",
  price_history: "Historie cen",
  supplier: "Dodavatel",
  supplier_code: "Kód dodavatele",
  archived: "Vyřazená",
  description: "Popis",
  customer: "Zákazník",
  lines: "Řádky",
  discount_percent: "Sleva",
  issue_date: "Vystaveno",
  valid_until: "Platí do",
  introduction: "Úvodní text",
  terms: "Podmínky",
  internal_note: "Interní poznámka",
  sent_at: "Odesláno",
  closed_at: "Uzavřeno",
  email: "E-mail",
  phone: "Telefon",
  contact_person: "Kontaktní osoba",
  company_id: "IČO",
  vat_id: "DIČ",
  street: "Ulice",
  city: "Obec",
  postal_code: "PSČ",
  quote_number_format: "Formát čísla nabídky",
  validity_days: "Platnost (dní)",
  total_rounding: "Zaokrouhlení",
  min_margin_percent: "Minimální marže",
  default_vat_rate: "Výchozí sazba DPH",
  order: "Pořadí",
};

const MONEY_FIELDS = new Set([
  "purchase_price",
  "sale_price",
  "unit_price",
  "purchase_price_before",
  "sale_price_before",
]);

const TYPE_LABELS: Record<CollectionName, string> = {
  settings: "Nastavení",
  categories: "Kategorie",
  items: "Položka ceníku",
  customers: "Zákazník",
  quotes: "Nabídka",
};

/** Names changed fields as a reviewer knows them and shows amounts in crowns. */
export function labelFields(fields: readonly ReviewFieldSummary[]): ReviewFieldSummary[] {
  return fields.map((field) => {
    const segments = field.fieldPath.split("/").filter(Boolean);
    const key = segments[0] ?? "";
    const last = segments.at(-1) ?? "";
    const amount = (summary: string | undefined) =>
      summary !== undefined && MONEY_FIELDS.has(last) && /^[0-9]+$/.test(summary)
        ? formatMoney(Number(summary))
        : summary;
    return {
      ...field,
      label: FIELD_LABELS[key] ?? field.label,
      beforeSummary: amount(field.beforeSummary),
      afterSummary: amount(field.afterSummary),
    };
  });
}

/** How a person recognises a record: its type, a label and the page that shows it. */
export function describeRecord(collection: CollectionName, id: string, record: unknown) {
  const value = (record ?? {}) as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name : null;
  const typeLabel = TYPE_LABELS[collection];
  switch (collection) {
    case "settings":
      return { typeLabel, label: "Nastavení nabídek", href: "#/settings" };
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
      const head = version ? `${number} (verze ${version})` : number;
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
): ReviewableResource {
  const subject = describeRecord(collection, id, after ?? before);
  const diff = structuralDiff(before ?? {}, after ?? {}, { maxFields: 12 });
  const fields = labelFields(diff.fields);
  return {
    appId: "quotes",
    resourceType: collection,
    stableResourceId: `${collection}:${id}`,
    label: subject.label,
    routeTarget: { href: subject.href, label: "Otevřít" },
    changes: [
      {
        changeId: change.changeId,
        kind,
        summary:
          kind === "created"
            ? "Nový záznam"
            : kind === "deleted"
              ? "Smazaný záznam"
              : `Změněno polí: ${fields.length + diff.truncated}`,
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
export const quotesReviewAdapter: ReviewSurfaceAdapter = {
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
        ),
      );
    }
    return resources;
  },
};
