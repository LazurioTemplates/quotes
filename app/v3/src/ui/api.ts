import type { DraftPanelInput } from "@lazurio/repository-db";
import type { Category, Item } from "../domain/catalog.ts";
import type { QuoteIssue } from "../domain/checks.ts";
import type { Customer } from "../domain/customer.ts";
import type { QuoteEmail } from "../domain/email.ts";
import type { ImportMapping, ImportOptions, ImportPreview } from "../domain/price-import.ts";
import type { Quote, QuoteAction } from "../domain/quote.ts";
import type { RuleIssue } from "../domain/rules.ts";
import type { Settings } from "../domain/settings.ts";

/** What the server stores, as the browser receives it. */
export interface Stored<T> {
  value: T;
  revision: string;
}

export interface FieldIssue {
  path: string;
  message: string;
}

/** A refusal of the API, with the code the engine documents. */
export class ApiError extends Error {
  readonly code: string;
  readonly issues: FieldIssue[];

  constructor(code: string, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.code = code;
    this.issues = issues;
  }
}

/** Czech wording of the refusals a person can meet. */
const MESSAGES: Record<string, string> = {
  record_changed: "Záznam mezitím uložil někdo jiný. Načtěte ho znovu; vaše úpravy zůstávají ve formuláři.",
  draft_changed: "Koncept se od zobrazení změnil. Podívejte se na něj znovu a potvrďte.",
  draft_write_blocked: "Právě probíhá publikování. Zkuste to za chvíli znovu.",
  conflict_active: "Publikování zastavil konflikt; změny zůstávají vidět v konceptu.",
  publish_conflict:
    "Novější práci kolegy nešlo bezpečně spojit s vaší. Postup ukazuje karta konceptu.",
  pull_blocked_by_draft:
    "Kolega změnil stejný záznam, který upravujete. Vraťte ho, stáhněte a upravte znovu.",
  publish_push_failed: "Uloženo, ale server nebyl dostupný. Dokončete odeslání.",
  send_pending: "Publikování čeká na odeslání; nejdřív ho dokončete.",
  identity_missing:
    "Toto Prostředí nemá jméno a e-mail pro Git; přihlaste se ke GitHubu v Lazuriu.",
  credentials: "Toto Prostředí se k datovému repozitáři nedostane; přihlaste se.",
  validation_failed: "Data porušují pravidlo datového repozitáře. Nic se nepublikovalo.",
  mount_unavailable: "Data zatím nejsou k dispozici.",
  settings_missing: "Datový repozitář zatím nemá nastavení nabídek.",
  origin_refused: "Změnu lze poslat jen z aplikace Cenové nabídky.",
};

async function request<T>(path: string, init?: { method: string; body: unknown }): Promise<T> {
  const response = await fetch(
    path,
    init
      ? {
          method: init.method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(init.body),
        }
      : { headers: { accept: "application/json" } },
  );
  const data = (await response.json().catch(() => null)) as
    | (T & { code?: string; message?: string; issues?: FieldIssue[] })
    | null;
  if (!response.ok) {
    const code = data?.code ?? "unexpected";
    throw new ApiError(code, MESSAGES[code] ?? data?.message ?? response.statusText, data?.issues);
  }
  return data as T;
}

const put = <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body });
const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body });
const at = (base: string, id: string) => `${base}/${encodeURIComponent(id)}`;

export interface ImportRequest {
  csv: string;
  mapping?: ImportMapping | undefined;
  options: ImportOptions;
}

export const api = {
  status: () => request<{ ok: boolean; code?: string; message?: string }>("/api/status"),
  settings: () => request<Stored<Settings>>("/api/settings"),
  saveSettings: (record: Settings, baseRevision: string) =>
    put<Stored<Settings>>("/api/settings", { record, baseRevision }),
  categories: () => request<Stored<Category>[]>("/api/categories"),
  createCategory: (name: string) => post<Stored<Category>>("/api/categories", { name }),
  saveCategory: (record: Category, baseRevision: string) =>
    put<Stored<Category>>(at("/api/categories", record.id), { record, baseRevision }),
  items: () => request<Stored<Item>[]>("/api/items"),
  createItem: (record: Item) => post<Stored<Item>>("/api/items", { record }),
  saveItem: (record: Item, baseRevision: string, note?: string) =>
    put<Stored<Item>>(at("/api/items", record.code), {
      record,
      baseRevision,
      ...(note ? { note } : {}),
    }),
  importPreview: (input: ImportRequest) =>
    post<{ preview: ImportPreview; revisions: Record<string, string | null> }>(
      "/api/import/preview",
      input,
    ),
  importApply: (
    input: ImportRequest & { lines: number[]; revisions: Record<string, string | null> },
  ) => post<Stored<Item>[]>("/api/import/apply", input),
  customers: () => request<Stored<Customer>[]>("/api/customers"),
  createCustomer: (record: Omit<Customer, "id">) =>
    post<Stored<Customer>>("/api/customers", { record }),
  saveCustomer: (record: Customer, baseRevision: string) =>
    put<Stored<Customer>>(at("/api/customers", record.id), { record, baseRevision }),
  quotes: () => request<Stored<Quote>[]>("/api/quotes"),
  quote: (id: string) => request<Stored<Quote>>(at("/api/quotes", id)),
  createQuote: (input: { customer_id: string; title: string }) =>
    post<Stored<Quote>>("/api/quotes", input),
  saveQuote: (id: string, record: Quote, baseRevision: string) =>
    put<Stored<Quote>>(at("/api/quotes", id), { record, baseRevision }),
  act: (id: string, action: QuoteAction, baseRevision: string) =>
    post<Stored<Quote>>(`${at("/api/quotes", id)}/action`, { action, baseRevision }),
  newVersion: (id: string) => post<Stored<Quote>>(`${at("/api/quotes", id)}/version`, {}),
  checkQuote: (id: string) => request<QuoteIssue[]>(`${at("/api/quotes", id)}/check`),
  email: (id: string) => request<QuoteEmail>(`${at("/api/quotes", id)}/email`),
  check: () => request<RuleIssue[]>("/api/check"),
  draft: () => request<DraftPanelInput>("/api/draft"),
  publish: (expectedRevision: string) =>
    post<{ ok: true }>("/api/draft/publish", { expectedRevision }),
  finishSend: (expectedHead: string) =>
    post<{ ok: true }>("/api/draft/finish-send", { expectedHead }),
  discard: (
    scope: { kind: "draft" } | { kind: "record"; path: string },
    expectedRevision: string,
  ) => post<{ ok: true }>("/api/draft/discard", { scope, expectedRevision }),
  pull: () => post<{ ok: true }>("/api/draft/pull", {}),
};

/** The print page of a quote version; the browser prints it to PDF. */
export function printUrl(id: string): string {
  return `/print/quotes/${encodeURIComponent(id)}`;
}

/** Server events: records came in or the draft moved. Returns the unsubscribe function. */
export function subscribe(onChange: (type: "records-changed" | "draft-changed") => void) {
  if (typeof EventSource === "undefined") return () => {};
  const source = new EventSource("/api/events");
  source.addEventListener("records-changed", () => onChange("records-changed"));
  source.addEventListener("draft-changed", () => onChange("draft-changed"));
  return () => source.close();
}
