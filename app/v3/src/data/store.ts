import type { DraftPanelInput } from "@lazurio/repository-db";
import type { Category, Item } from "../domain/catalog.ts";
import type { Customer } from "../domain/customer.ts";
import type { Quote } from "../domain/quote.ts";
import type { RuleIssue } from "../domain/rules.ts";
import type { Settings } from "../domain/settings.ts";
import type { Locale, Localized } from "../i18n/locale.ts";

/**
 * The storage port of Quotes: everything the server and the agent's command
 * line need from the data, named by the domain and never by files or Git.
 *
 * Generation v3 implements it over repository-db (`repository-db-store.ts`);
 * `memory-store.ts` implements it in memory for the demo and the tests.
 * Generation v4 implements the same port over Dolt; the server, the UI and
 * the shared test suite (`tests/store-contract.ts`) stay as they are. No path
 * of a YAML file and no Git term crosses this boundary: a record is addressed
 * by its id (an item by its code, a quote version by `<number>-v<version>`),
 * and a change is confirmed by an opaque revision.
 */

/** An opaque version of one stored record; a save names the one it was edited from. */
export type Revision = string;

export interface Stored<T> {
  value: T;
  revision: Revision;
}

/** A save of one record: the value and the revision it was edited from (`null` for a new one). */
export interface Save<T> {
  value: T;
  baseRevision: Revision | null;
}

/**
 * Draft & Publish is the contract of the UI: an edit is a draft, a person
 * reviews it and publishes it as one change. The card input is the shared
 * view model of `@lazurio/repository-db`, which a v4 store produces as well.
 */
export type DraftCard = DraftPanelInput;

export type DiscardScope = { kind: "draft" } | { kind: "record"; path: string };

export type StoreEvent =
  /** Records changed outside this process (a colleague's publish came in, a discard). */
  | { type: "records-changed" }
  /** The draft or the sync state changed; reload the card. */
  | { type: "draft-changed" };

export interface QuotesStore {
  /** False while the data cannot be read (not mounted yet, wrong repository). */
  available(): Promise<{ ok: true } | { ok: false; code: string; message: string }>;

  /** The settings; refused with `settings_missing` while the data has none. */
  settings(): Promise<Stored<Settings>>;
  saveSettings(value: Settings, baseRevision: Revision | null): Promise<Stored<Settings>>;

  /** Categories in their order. */
  listCategories(): Promise<Stored<Category>[]>;
  saveCategory(value: Category, baseRevision: Revision | null): Promise<Stored<Category>>;

  /** Every item of the price list, by category order and name. */
  listItems(): Promise<Stored<Item>[]>;
  getItem(code: string): Promise<Stored<Item> | null>;
  saveItem(value: Item, baseRevision: Revision | null): Promise<Stored<Item>>;
  /**
   * Save several items as one draft, as an import does. Every revision is
   * checked before the first write; one stale revision refuses them all.
   */
  saveItems(entries: readonly Save<Item>[]): Promise<Stored<Item>[]>;

  listCustomers(): Promise<Stored<Customer>[]>;
  getCustomer(id: string): Promise<Stored<Customer> | null>;
  saveCustomer(value: Customer, baseRevision: Revision | null): Promise<Stored<Customer>>;

  /** Every version of every quote, newest number first, versions ascending. */
  listQuotes(): Promise<Stored<Quote>[]>;
  /** One version by its id `<number>-v<version>`. */
  getQuote(id: string): Promise<Stored<Quote> | null>;
  /**
   * Save a version of a quote as a draft. `baseRevision` is the revision the
   * editor opened, `null` for a new version. A stale revision is refused with
   * `record_changed`.
   */
  saveQuote(value: Quote, baseRevision: Revision | null): Promise<Stored<Quote>>;

  /**
   * Every problem of the data as it stands (draft included): records that do
   * not match their schema and broken rules across records. Empty when valid.
   */
  check(locale?: Locale): Promise<RuleIssue[]>;

  /** The Draft & Publish card: state, the changed records and the draft revision, labelled in `locale`. */
  draft(locale?: Locale): Promise<DraftCard>;
  /** Publish the whole draft as shown; a changed draft is refused with `draft_changed`. */
  publish(input: { expectedRevision: string; actor?: string; summary?: string }): Promise<void>;
  /** Finish sending a publish that was saved but not sent. */
  finishSend(expectedHead: string): Promise<void>;
  discard(scope: DiscardScope, expectedRevision: string): Promise<void>;
  /** Take colleagues' published work. */
  pull(): Promise<void>;

  subscribe(listener: (event: StoreEvent) => void): () => void;
  close(): void;
}

/** A refusal the UI words for the person; `code` follows repository-db's error codes. */
export class StoreError extends Error {
  readonly code: string;
  readonly text: Localized;
  readonly localizedIssues: readonly { path: string; message: Localized }[];

  constructor(
    code: string,
    message: string | Localized,
    issues: { path: string; message: string | Localized }[] = [],
  ) {
    const text = typeof message === "string" ? { cs: message, en: message } : message;
    super(text.en);
    this.name = "StoreError";
    this.code = code;
    this.text = text;
    this.localizedIssues = issues.map((issue) => ({
      path: issue.path,
      message:
        typeof issue.message === "string"
          ? { cs: issue.message, en: issue.message }
          : issue.message,
    }));
  }

  /** The issues in English, as logs and tests read them. */
  get issues(): { path: string; message: string }[] {
    return this.issuesIn("en");
  }

  messageIn(locale: Locale): string {
    return this.text[locale];
  }

  issuesIn(locale: Locale): { path: string; message: string }[] {
    return this.localizedIssues.map((issue) => ({
      path: issue.path,
      message: issue.message[locale],
    }));
  }
}
