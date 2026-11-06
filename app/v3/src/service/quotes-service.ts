import { type Category, type Item, withPrice } from "../domain/catalog.ts";
import { checkQuote, type QuoteIssue, readyToSend } from "../domain/checks.ts";
import { addDays, localToday, slugify } from "../domain/common.ts";
import { type Customer, nextCustomerId } from "../domain/customer.ts";
import { quoteEmail } from "../domain/email.ts";
import {
  type ImportMapping,
  type ImportOptions,
  type ImportPreview,
  importedItems,
  previewImport,
} from "../domain/price-import.ts";
import {
  applyAction,
  canCreateVersion,
  idOfQuote,
  isEditable,
  nextQuoteNumber,
  nextVersion,
  type Quote,
  type QuoteAction,
  type QuoteCustomer,
  type QuoteLine,
} from "../domain/quote.ts";
import type { Settings } from "../domain/settings.ts";
import { type QuotesStore, type Revision, type Stored, StoreError } from "../data/store.ts";

/**
 * The operations of Quotes over the storage port, shared by the HTTP API and
 * the agent's command line (`bun run quotes`). Each one reads what it needs,
 * applies the domain rules and saves drafts; none of them publishes.
 */
export interface ServiceOptions {
  /** Today's date for new records; injectable for tests. */
  today?: () => string;
}

export interface NewQuoteInput {
  customer_id: string;
  title: string;
  lines?: Omit<QuoteLine, "id">[] | undefined;
  discount_percent?: number | undefined;
  introduction?: string | undefined;
  terms?: string | undefined;
  internal_note?: string | undefined;
  prepared_by?: string | undefined;
}

export interface ImportRequest {
  csv: string;
  mapping?: ImportMapping | undefined;
  options: ImportOptions;
}

function notFound(what: string): never {
  throw new StoreError("not_found", `${what} neexistuje.`);
}

/** The customer as a quote names them: a copy of the contact without its internal note. */
export function customerSnapshot(contact: Customer): QuoteCustomer {
  const { note: _note, ...snapshot } = contact;
  return snapshot;
}

export function createService(store: QuotesStore, options: ServiceOptions = {}) {
  const today = options.today ?? (() => localToday());

  async function quoteOrFail(id: string): Promise<Stored<Quote>> {
    return (await store.getQuote(id)) ?? notFound(`Nabídka ${id}`);
  }

  /** A quote by its id, or the latest version of a number. */
  async function findQuote(reference: string): Promise<Stored<Quote> | null> {
    const exact = await store.getQuote(reference);
    if (exact) return exact;
    const versions = (await store.listQuotes()).filter((entry) => entry.value.number === reference);
    return versions.sort((left, right) => right.value.version - left.value.version)[0] ?? null;
  }

  async function check(value: Quote): Promise<QuoteIssue[]> {
    const [settings, items, customers, quotes] = await Promise.all([
      store.settings(),
      store.listItems(),
      store.listCustomers(),
      store.listQuotes(),
    ]);
    return checkQuote(value, {
      settings: settings.value,
      items: items.map((entry) => entry.value),
      customers: customers.map((entry) => entry.value),
      versions: quotes.map((entry) => entry.value),
      today: today(),
    });
  }

  async function createQuote(input: NewQuoteInput): Promise<Stored<Quote>> {
    const [settings, contact] = await Promise.all([
      store.settings(),
      store.getCustomer(input.customer_id),
    ]);
    if (!contact) notFound(`Zákazník ${input.customer_id}`);
    const date = today();
    const draft = (number: string): Quote => ({
      number,
      version: 1,
      status: "draft",
      title: input.title,
      customer: customerSnapshot(contact.value),
      issue_date: date,
      valid_until: addDays(date, settings.value.validity_days),
      currency: settings.value.currency,
      lines: (input.lines ?? []).map((line, index) => ({ ...line, id: `l${index + 1}` })),
      ...(input.discount_percent ? { discount_percent: input.discount_percent } : {}),
      ...optional("introduction", input.introduction ?? settings.value.default_introduction),
      ...optional("terms", input.terms ?? settings.value.default_terms),
      ...optional("internal_note", input.internal_note),
      ...optional("prepared_by", input.prepared_by),
      created_at: date,
      updated_at: date,
    });
    // Two people may take the same number at once; the second save is
    // refused as `record_changed` and takes the next number instead.
    for (let attempt = 0; ; attempt += 1) {
      const numbers = (await store.listQuotes()).map((entry) => entry.value.number);
      const number = nextQuoteNumber(settings.value.quote_number_format, date, numbers);
      try {
        return await store.saveQuote(draft(number), null);
      } catch (error) {
        if (attempt < 2 && error instanceof StoreError && error.code === "record_changed") continue;
        throw error;
      }
    }
  }

  async function saveQuote(id: string, record: Quote, baseRevision: Revision) {
    const current = await quoteOrFail(id);
    if (!isEditable(current.value)) {
      throw new StoreError(
        "not_editable",
        "Odeslanou nabídku už měnit nelze; vytvořte z ní novou verzi.",
      );
    }
    const contact = await store.getCustomer(record.customer?.id ?? "");
    if (!contact) notFound(`Zákazník ${record.customer?.id ?? ""}`);
    const value: Quote = {
      ...record,
      number: current.value.number,
      version: current.value.version,
      status: current.value.status,
      created_at: current.value.created_at,
      customer: customerSnapshot(contact.value),
      updated_at: today(),
    };
    return store.saveQuote(value, baseRevision);
  }

  async function act(id: string, action: QuoteAction, baseRevision: Revision) {
    const current = await quoteOrFail(id);
    if (action === "send") {
      const issues = await check(current.value);
      if (!readyToSend(issues)) {
        throw new StoreError(
          "quote_not_ready",
          "Nabídka ještě nemůže odejít; opravte chyby z kontroly.",
          issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => ({ path: issue.line ?? "quote", message: issue.message })),
        );
      }
    }
    const next = applyAction(current.value, action, today());
    if (typeof next === "string") throw new StoreError("not_allowed", next);
    return store.saveQuote(next, baseRevision);
  }

  async function createVersion(id: string) {
    const current = await quoteOrFail(id);
    const versions = (await store.listQuotes()).filter(
      (entry) => entry.value.number === current.value.number,
    );
    if (versions.some((entry) => entry.value.version > current.value.version)) {
      throw new StoreError("not_allowed", "Novou verzi lze vytvořit jen z poslední verze nabídky.");
    }
    if (!canCreateVersion(current.value)) {
      throw new StoreError(
        "not_allowed",
        current.value.status === "draft"
          ? "Koncept se upravuje přímo; novou verzi nepotřebuje."
          : "Přijatá nabídka je uzavřená; novou verzi z ní vytvořit nelze.",
      );
    }
    const settings = await store.settings();
    return store.saveQuote(nextVersion(current.value, settings.value, today()), null);
  }

  /**
   * Saves an edit of an item. A new purchase or sale price goes into the
   * price history; it applies from the date in the form when that is later
   * than the current price's, otherwise from today. The history itself is
   * always the stored one, never what the browser sent back.
   */
  async function saveItem(code: string, record: Item, baseRevision: Revision, note?: string) {
    const current = (await store.getItem(code)) ?? notFound(`Položka ${code}`);
    if (record.code !== code) throw new StoreError("bad_request", "Kód položky se nemění.");
    const stored = current.value;
    const {
      purchase_price: purchase,
      sale_price: sale,
      valid_from: from,
      price_history: _history,
      ...details
    } = record;
    const kept: Item = {
      ...details,
      sale_price: stored.sale_price,
      valid_from: stored.valid_from,
      ...(stored.purchase_price === undefined ? {} : { purchase_price: stored.purchase_price }),
      ...(stored.price_history ? { price_history: stored.price_history } : {}),
    };
    const latest = [today(), stored.valid_from].sort().at(-1) as string;
    const next = withPrice(
      kept,
      { purchase_price: purchase, sale_price: sale, valid_from: from > latest ? from : latest },
      "manual",
      note,
    );
    return store.saveItem(next, baseRevision);
  }

  async function importPreview(request: ImportRequest): Promise<{
    preview: ImportPreview;
    revisions: Record<string, string | null>;
  }> {
    const [settings, items, categories] = await Promise.all([
      store.settings(),
      store.listItems(),
      store.listCategories(),
    ]);
    const preview = previewImport({
      ...request,
      items: items.map((entry) => entry.value),
      categories: categories.map((entry) => entry.value),
      settings: settings.value,
    });
    const revisionOf = new Map(items.map((entry) => [entry.value.code, entry.revision]));
    const revisions: Record<string, string | null> = {};
    for (const row of preview.rows) {
      if (row.kind === "new") revisions[row.item.code] = null;
      if (row.kind === "changed") revisions[row.item.code] = revisionOf.get(row.item.code) ?? null;
    }
    return { preview, revisions };
  }

  /**
   * Writes the chosen rows of an import as one draft. `revisions` are the
   * ones the preview showed: when the price list changed since, nothing is
   * written and the person looks at a fresh preview.
   */
  async function importApply(
    request: ImportRequest & { lines?: number[]; revisions: Record<string, string | null> },
  ) {
    const { preview, revisions } = await importPreview(request);
    const chosen = importedItems(preview, request.lines);
    for (const { item } of chosen) {
      if (!(item.code in request.revisions) || request.revisions[item.code] !== revisions[item.code]) {
        throw new StoreError(
          "record_changed",
          `Ceník se od náhledu změnil (${item.code}); načtěte náhled znovu.`,
        );
      }
    }
    if (chosen.length === 0) return [];
    return store.saveItems(
      chosen.map(({ item }) => ({ value: item, baseRevision: revisions[item.code] ?? null })),
    );
  }

  async function createCustomer(record: Omit<Customer, "id">) {
    const customers = await store.listCustomers();
    const id = nextCustomerId(customers.map((entry) => entry.value.id));
    return store.saveCustomer({ ...record, id }, null);
  }

  async function createCategory(name: string) {
    const categories = await store.listCategories();
    const taken = new Set(categories.map((entry) => entry.value.id));
    const base = slugify(name) || "kategorie";
    let id = base;
    for (let suffix = 2; taken.has(id); suffix += 1) id = `${base}-${suffix}`;
    const order = categories.reduce((max, entry) => Math.max(max, entry.value.order ?? 0), 0) + 1;
    const value: Category = { id, name: name.trim(), order };
    return store.saveCategory(value, null);
  }

  return {
    today,
    findQuote,
    quote: quoteOrFail,
    async checkQuote(id: string) {
      const found = await quoteOrFail(id);
      return { quote: found, issues: await check(found.value) };
    },
    async email(id: string) {
      const [found, settings] = await Promise.all([quoteOrFail(id), store.settings()]);
      return quoteEmail(found.value, settings.value);
    },
    createQuote,
    saveQuote,
    act,
    createVersion,
    saveItem,
    async createItem(record: Item) {
      return store.saveItem({ ...record, valid_from: record.valid_from || today() }, null);
    },
    importPreview,
    importApply,
    createCustomer,
    createCategory,
    idOf: idOfQuote,
  };
}

export type QuotesService = ReturnType<typeof createService>;

function optional<K extends string>(key: K, value: string | undefined) {
  return value ? ({ [key]: value } as Record<K, string>) : {};
}

export type { Settings };
