import { z } from "zod";
import { type QuotesStore, StoreError } from "../data/store.ts";
import { category, item } from "../domain/catalog.ts";
import { customer } from "../domain/customer.ts";
import { IMPORT_FIELDS } from "../domain/price-import.ts";
import { QUOTE_ACTIONS, quote } from "../domain/quote.ts";
import { settings } from "../domain/settings.ts";
import { percent } from "../domain/money.ts";
import { isoDate } from "../domain/common.ts";
import { createService, type QuotesService } from "../service/quotes-service.ts";

/**
 * The HTTP API of Quotes. The browser talks only to this API; the API talks
 * only to the service over the storage port, never to files or Git.
 */
export interface ApiOptions {
  /** Origins a writing request may come from (the App's own, loopback and hosted). */
  allowedOrigins: ReadonlySet<string>;
  /** Today's date for new records; injectable for tests. */
  today?: () => string;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const revision = z.string().min(1);
const save = <T extends z.ZodType>(schema: T) =>
  z.strictObject({ record: schema, baseRevision: revision });

const newQuoteInput = z.strictObject({
  customer_id: z.string().min(1),
  title: z.string().trim().min(1),
});

const actionInput = z.strictObject({ action: z.enum(QUOTE_ACTIONS), baseRevision: revision });

const importInput = z.strictObject({
  csv: z.string().min(1).max(5_000_000),
  mapping: z.partialRecord(z.enum(IMPORT_FIELDS), z.int().min(0)).optional(),
  options: z.strictObject({
    supplier: z.string().trim().min(1),
    valid_from: isoDate,
    markup_percent: percent.optional(),
    round_to_crowns: z.boolean().optional(),
    category: z.string().optional(),
    note: z.string().trim().min(1).optional(),
  }),
});

const publishInput = z.strictObject({
  expectedRevision: z.string().min(1),
  summary: z.string().trim().min(1).optional(),
});

const discardInput = z.strictObject({
  scope: z.union([
    z.strictObject({ kind: z.literal("draft") }),
    z.strictObject({ kind: z.literal("record"), path: z.string().min(1) }),
  ]),
  expectedRevision: z.string().min(1),
});

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function refusal(code: string, message: string, status: number, issues: unknown[] = []) {
  return json({ code, message, issues }, status);
}

const STATUS_BY_CODE: Record<string, number> = {
  bad_request: 400,
  not_found: 404,
  invalid_record: 422,
  quote_not_ready: 422,
  validation_failed: 422,
  materialize_failed: 422,
  not_editable: 409,
  not_allowed: 409,
  record_changed: 409,
  draft_changed: 409,
  draft_write_blocked: 409,
  conflict_active: 409,
  publish_conflict: 409,
  pull_blocked_by_draft: 409,
  send_pending: 409,
  publish_push_failed: 502,
  credentials: 401,
  identity_missing: 401,
  settings_missing: 503,
  mount_unavailable: 503,
  boundary_violation: 503,
  config_changed: 503,
};

function errorResponse(error: unknown): Response {
  if (error instanceof StoreError) {
    return refusal(error.code, error.message, STATUS_BY_CODE[error.code] ?? 409, [...error.issues]);
  }
  console.error(error);
  return refusal("unexpected", error instanceof Error ? error.message : String(error), 500);
}

async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new StoreError("bad_request", "Tělo požadavku není JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new StoreError(
      "invalid_record",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      parsed.error.issues.map((issue) => ({
        path: issue.path.filter((part) => part !== "record").join(".") || "(record)",
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

/** A write is accepted only as JSON from one of the App's own origins (no cross-site writes). */
function writeRefusal(req: Request, allowedOrigins: ReadonlySet<string>): Response | null {
  if (!WRITE_METHODS.has(req.method)) return null;
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) {
    return refusal("origin_refused", "Změnu lze poslat jen z aplikace Cenové nabídky.", 403);
  }
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) {
    return refusal("bad_request", "Změna se posílá jako application/json.", 415);
  }
  return null;
}

export function createApi(store: QuotesStore, options: ApiOptions) {
  const service: QuotesService = createService(store, options.today ? { today: options.today } : {});

  function events(req: Request): Response {
    let stop = () => {};
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(": connected\n\n");
        const unsubscribe = store.subscribe((event) => {
          controller.enqueue(`event: ${event.type}\ndata: {}\n\n`);
        });
        const keepAlive = setInterval(() => controller.enqueue(": keep-alive\n\n"), 25_000);
        stop = () => {
          clearInterval(keepAlive);
          unsubscribe();
        };
        req.signal.addEventListener("abort", () => {
          stop();
          controller.close();
        });
      },
      cancel() {
        stop();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive",
      },
    });
  }

  const one = (pattern: RegExp, pathname: string) => {
    const match = pattern.exec(pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  };

  async function route(req: Request, url: URL): Promise<Response> {
    const { pathname } = url;
    const method = req.method;
    const get = method === "GET";

    if (pathname === "/api/status" && get) return json(await store.available());
    if (pathname === "/api/settings" && get) return json(await store.settings());
    if (pathname === "/api/settings" && method === "PUT") {
      const input = await body(req, save(settings));
      return json(await store.saveSettings(input.record, input.baseRevision));
    }

    if (pathname === "/api/categories" && get) return json(await store.listCategories());
    if (pathname === "/api/categories" && method === "POST") {
      const input = await body(req, z.strictObject({ name: z.string().trim().min(1) }));
      return json(await service.createCategory(input.name), 201);
    }
    const categoryId = one(/^\/api\/categories\/([^/]+)$/, pathname);
    if (categoryId && method === "PUT") {
      const input = await body(req, save(category));
      if (input.record.id !== categoryId) throw new StoreError("bad_request", "Id kategorie se nemění.");
      return json(await store.saveCategory(input.record, input.baseRevision));
    }

    if (pathname === "/api/items" && get) return json(await store.listItems());
    if (pathname === "/api/items" && method === "POST") {
      const input = await body(req, z.strictObject({ record: item }));
      return json(await service.createItem(input.record), 201);
    }
    const code = one(/^\/api\/items\/([^/]+)$/, pathname);
    if (code && get) {
      const found = await store.getItem(code);
      return found ? json(found) : refusal("not_found", `Položka ${code} neexistuje.`, 404);
    }
    if (code && method === "PUT") {
      const input = await body(
        req,
        z.strictObject({ record: item, baseRevision: revision, note: z.string().trim().min(1).optional() }),
      );
      return json(await service.saveItem(code, input.record, input.baseRevision, input.note));
    }

    if (pathname === "/api/import/preview" && method === "POST") {
      return json(await service.importPreview(await body(req, importInput)));
    }
    if (pathname === "/api/import/apply" && method === "POST") {
      const input = await body(
        req,
        importInput.extend({
          lines: z.array(z.int().min(1)).optional(),
          revisions: z.record(z.string(), z.string().nullable()),
        }),
      );
      return json(await service.importApply(input));
    }

    if (pathname === "/api/customers" && get) return json(await store.listCustomers());
    if (pathname === "/api/customers" && method === "POST") {
      const input = await body(req, z.strictObject({ record: customer.omit({ id: true }) }));
      return json(await service.createCustomer(input.record), 201);
    }
    const customerId = one(/^\/api\/customers\/([^/]+)$/, pathname);
    if (customerId && get) {
      const found = await store.getCustomer(customerId);
      return found ? json(found) : refusal("not_found", `Zákazník ${customerId} neexistuje.`, 404);
    }
    if (customerId && method === "PUT") {
      const input = await body(req, save(customer));
      if (input.record.id !== customerId) throw new StoreError("bad_request", "Id zákazníka se nemění.");
      return json(await store.saveCustomer(input.record, input.baseRevision));
    }

    if (pathname === "/api/quotes" && get) return json(await store.listQuotes());
    if (pathname === "/api/quotes" && method === "POST") {
      return json(await service.createQuote(await body(req, newQuoteInput)), 201);
    }
    const quoteId = one(/^\/api\/quotes\/([^/]+)(?:\/[a-z]+)?$/, pathname);
    if (quoteId) {
      const tail = pathname.slice(pathname.lastIndexOf("/") + 1);
      if (tail === "check" && get) {
        const { issues } = await service.checkQuote(quoteId);
        return json(issues);
      }
      if (tail === "email" && get) return json(await service.email(quoteId));
      if (tail === "action" && method === "POST") {
        const input = await body(req, actionInput);
        return json(await service.act(quoteId, input.action, input.baseRevision));
      }
      if (tail === "version" && method === "POST") {
        return json(await service.createVersion(quoteId), 201);
      }
      if (get) {
        const found = await store.getQuote(quoteId);
        return found ? json(found) : refusal("not_found", `Nabídka ${quoteId} neexistuje.`, 404);
      }
      if (method === "PUT") {
        const input = await body(req, save(quote));
        return json(await service.saveQuote(quoteId, input.record, input.baseRevision));
      }
    }

    if (pathname === "/api/check" && get) return json(await store.check());
    if (pathname === "/api/draft" && get) return json(await store.draft());
    if (pathname === "/api/draft/publish" && method === "POST") {
      const input = await body(req, publishInput);
      await store.publish(input.summary ? input : { expectedRevision: input.expectedRevision });
      return json({ ok: true });
    }
    if (pathname === "/api/draft/finish-send" && method === "POST") {
      const input = await body(req, z.strictObject({ expectedHead: z.string().min(1) }));
      await store.finishSend(input.expectedHead);
      return json({ ok: true });
    }
    if (pathname === "/api/draft/discard" && method === "POST") {
      const input = await body(req, discardInput);
      await store.discard(input.scope, input.expectedRevision);
      return json({ ok: true });
    }
    if (pathname === "/api/draft/pull" && method === "POST") {
      await store.pull();
      return json({ ok: true });
    }
    if (pathname === "/api/events" && get) return events(req);
    return refusal("not_found", `${method} ${pathname} není součást API.`, 404);
  }

  /** Answers an `/api/…` request; every other path is not the API's. */
  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const refused = writeRefusal(req, options.allowedOrigins);
    if (refused) return refused;
    try {
      return await route(req, url);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
